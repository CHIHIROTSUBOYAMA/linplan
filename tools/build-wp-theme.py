#!/usr/bin/env python3
"""静的サイトから WordPress テーマ（見本・ローカル確認用）を生成して Zip にする。

    python tools/build-wp-theme.py

出力：
    wordpress/linplan/      テーマ一式（生成物。直接編集しない）
    wordpress/linplan.zip   WordPress 管理画面「外観 → テーマ → 新規追加 → テーマのアップロード」で入れる Zip

しくみ：
  - tools/wp-theme/ の手書きファイル（functions.php / single.php など）をコピー
  - 各 HTML を「head・ナビ前・main・フッター後のスクリプト」に切り分けて parts/{key}/*.php に書き出す
    （リンクは home_url()、画像はテーマ内 assets/ を指すよう書き換える）
  - ナビとフッターは about.html のものを header.php / footer.php にする
  - blog/*.html の記事は data/posts.json にまとめ、テーマ有効化時に「投稿」として取り込む
    （段落と見出しは WordPress のブロック、表・リスト・FAQ などはカスタム HTML ブロック）
  - GTM（計測タグ）は入れない（ローカル確認のアクセスを本番の計測に混ぜないため）

標準ライブラリだけで動く。サイトの文章やデザインを変えたら、もう一度実行すれば Zip が作り直される。
"""

import html as html_lib
import json
import posixpath
import re
import shutil
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'tools' / 'wp-theme'
OUT_DIR = ROOT / 'wordpress'
OUT = OUT_DIR / 'linplan'
ZIP = OUT_DIR / 'linplan.zip'

SITE = 'https://linplan.jp'

# (HTML ファイル, parts のフォルダ名, WordPress 上の固定ページのパス, 管理画面でのページ名)
PAGES = [
    ('index.html', 'index', 'home', 'トップページ'),
    ('about.html', 'about', 'about', '私について'),
    ('services.html', 'services', 'services', 'サービス'),
    ('aeo-geo.html', 'aeo-geo', 'aeo-geo', 'AEO・GEO'),
    ('works.html', 'works', 'works', '制作実績'),
    ('pricing.html', 'pricing', 'pricing', '料金'),
    ('faq.html', 'faq', 'faq', 'よくある質問'),
    ('contact.html', 'contact', 'contact', 'お問い合わせ'),
    ('privacy.html', 'privacy', 'privacy', 'プライバシーポリシー'),
    ('tokushoho.html', 'tokushoho', 'tokushoho', '特定商取引法に基づく表記'),
    ('area/funabashi.html', 'funabashi', 'area/funabashi', '対応エリア・対面サポート（船橋）'),
    ('blog/index.html', 'blog', None, None),
    ('404.html', '404', None, None),
]
# 固定ページとして作るが parts を持たないもの
EXTRA_PAGES = [
    {'path': 'blog', 'title': '相談室', 'part': ''},
    {'path': 'area', 'title': '対応エリア', 'part': '', 'redirect': '/area/funabashi/'},
]
COMMON_FROM = 'about.html'               # header.php / footer.php の元
POST_TYPE_ARTICLE = 'blog/funabashi-seitai.html'   # 記事ページ共通の CSS・JS・著者欄の元

ASSET_DIRS = ('images/', 'insta/', 'blog/img/', 'fonts/')
ASSET_FILES = ('favicon.ico', 'favicon.svg', 'base.css', 'theme.css', 'theme.js')

warnings = []


def warn(msg):
    warnings.append(msg)


def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')


def write(rel, text):
    path = OUT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding='utf-8', newline='\n')


# ------------------------------------------------------------
# URL の書き換え
# ------------------------------------------------------------

def resolve(url, srcdir):
    """静的サイトの URL を ('page', '/about/', tail) / ('asset', 'images/x.webp', tail) に変換。対象外は None。"""
    u = url.strip()
    if u.startswith(SITE):
        path, base = u[len(SITE):] or '/', ''
    elif u == '' or re.match(r'^(?:[a-z][a-z0-9+.-]*:|//|#|\?)', u, re.I):
        return None
    else:
        path, base = u, srcdir
    p, tail = re.match(r'^([^?#]*)(.*)$', path).groups()
    if p.startswith('/'):
        res = posixpath.normpath(p)[1:]
    else:
        res = posixpath.normpath(posixpath.join(base, p))
    if res in ('', '.'):
        return ('page', '/', tail)
    if res in ASSET_FILES or res.startswith(ASSET_DIRS):
        return ('asset', res, tail)
    if res in ('blog', 'area'):
        return ('page', '/' + res + '/', tail)
    if res.endswith('.html'):
        name = res[:-5]
        if name == 'index':
            return ('page', '/', tail)
        if name.endswith('/index'):
            return ('page', '/' + name[:-5], tail)
        if not (ROOT / res).exists():
            warn(f'リンク先が見つかりません: {url}（{srcdir or "/"}）')
        return ('page', '/' + name + '/', tail)
    warn(f'書き換えできない URL: {url}（{srcdir or "/"}）')
    return None


def convert(url, srcdir, mode):
    """mode='php'：テンプレート用（PHP で出力）／ mode='content'：投稿本文用（{{home}} {{theme}} プレースホルダー）"""
    r = resolve(url, srcdir)
    if r is None:
        return None
    kind, path, tail = r
    if mode == 'php':
        if kind == 'page':
            return f"<?php linplan_url( '{path}' ); ?>{tail}"
        return f"<?php linplan_asset( '{path}' ); ?>{tail}"
    if kind == 'page':
        return '{{home}}' + path + tail
    return '{{theme}}/assets/' + path + tail


RAW_BLOCK = re.compile(r'(<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>)', re.S)
URL_ATTR = re.compile(r'(?<![\w-])(href|src|poster)="([^"]*)"')
SITE_URL = re.compile(re.escape(SITE) + r'[^"\'\s<>\\]*')


def rewrite_attrs(html, srcdir, mode):
    """href / src を書き換える（<script> <style> の中身は触らない）"""
    def rep(m):
        new = convert(m.group(2), srcdir, mode)
        return m.group(0) if new is None else f'{m.group(1)}="{new}"'
    parts = RAW_BLOCK.split(html)
    for i in range(0, len(parts), 2):
        parts[i] = URL_ATTR.sub(rep, parts[i])
    return ''.join(parts)


def rewrite_site_urls(text, mode):
    """JSON-LD や og:url に書かれた https://linplan.jp/... を書き換える"""
    return SITE_URL.sub(lambda m: convert(m.group(0), '', mode) or m.group(0), text)


def no_php(text, where):
    if '<?' in text:
        sys.exit(f'{where}: "<?" を含むため PHP テンプレートにできません')
    return text


# ------------------------------------------------------------
# HTML の切り分け
# ------------------------------------------------------------

TAG = re.compile(r'<!--.*?-->|<(/?)([a-zA-Z][\w:-]*)((?:[^>"\']|"[^"]*"|\'[^\']*\')*)>', re.S)
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}


def top_level(html):
    """html 直下の要素を [(tag, attrs, raw)] で返す（要素の外のテキスト・コメントは捨てる。空白以外があれば警告）"""
    out, depth, start, pos = [], 0, None, 0
    tag0 = attrs0 = None
    stray = []
    for m in TAG.finditer(html):
        if m.group(0).startswith('<!--'):
            if depth == 0:
                pos = m.end()
            continue
        closing, tag, attrs = m.group(1), m.group(2).lower(), m.group(3)
        if depth == 0 and not closing:
            stray.append(html[pos:m.start()])
            start, tag0, attrs0 = m.start(), tag, attrs.strip()
        if closing:
            depth -= 1
        elif tag in VOID or attrs.rstrip().endswith('/'):
            if depth == 0:
                out.append((tag0, attrs0, html[start:m.end()]))
                pos = m.end()
            continue
        else:
            depth += 1
        if depth == 0 and closing:
            out.append((tag0, attrs0, html[start:m.end()]))
            pos = m.end()
    stray.append(html[pos:])
    if depth != 0 or ''.join(stray).strip():
        warn('要素の外にテキストがあるか、タグの対応が取れていません: ' + repr(''.join(stray).strip()[:60]))
    return out


def element_at(html, start):
    """start から始まる要素の (開始タグの終わり, 閉じタグの始まり, 要素の終わり)"""
    depth, inner_start = 0, None
    for m in TAG.finditer(html, start):
        if m.group(0).startswith('<!--'):
            continue
        closing, tag, attrs = m.group(1), m.group(2).lower(), m.group(3)
        if closing:
            depth -= 1
            if depth == 0:
                return inner_start, m.start(), m.end()
        elif tag in VOID or attrs.rstrip().endswith('/'):
            continue
        else:
            if depth == 0:
                inner_start = m.end()
            depth += 1
    sys.exit('要素の終わりが見つかりません')


def replace_inner(html, open_tag_pattern, new_inner, where):
    m = re.search(open_tag_pattern, html)
    if not m:
        sys.exit(f'{where}: {open_tag_pattern} が見つかりません')
    a, b, _ = element_at(html, m.start())
    return html[:a] + new_inner + html[b:]


def slices(html, rel):
    """ページを head / body-start / nav / main / after-main / footer / scripts に切り分ける"""
    try:
        i_head, i_head_end = html.index('<head>') + 6, html.index('</head>')
        i_body = html.index('>', html.index('<body')) + 1
        i_nav = html.index('<nav class="site-nav')
        i_main, i_main_end = html.index('<main'), html.index('</main>') + 7
        i_foot, i_foot_end = html.index('<footer class="site-footer"'), html.index('</footer>') + 9
        i_body_end = html.index('</body>')
    except ValueError as e:
        sys.exit(f'{rel}: 想定した構造（nav → main → footer）になっていません（{e}）')
    return {
        'head': html[i_head:i_head_end],
        'body-start': html[i_body:i_nav],
        'nav': html[i_nav:i_main],
        'main': html[i_main:i_main_end],
        'after-main': html[i_main_end:i_foot],
        'footer': html[i_foot:i_foot_end],
        'scripts': html[i_foot_end:i_body_end],
    }


HEAD_TOKEN = re.compile(
    r'<!--.*?-->|<script\b[^>]*>.*?</script>|<style\b[^>]*>.*?</style>|<noscript>.*?</noscript>'
    r'|<title>.*?</title>|<(?:meta|link)\b[^>]*>', re.S)


def parse_head(head, rel, srcdir):
    """<head> を {title, meta[], jsonld[], styles[]} に分ける（GTM・canonical・共有 CSS・フォント preload は捨てる）"""
    info = {'title': '', 'meta': [], 'jsonld': [], 'styles': []}
    for m in HEAD_TOKEN.finditer(head):
        tok = m.group(0)
        if tok.startswith('<!--'):
            continue
        if tok.startswith('<title>'):
            info['title'] = tok[7:-8].strip()
        elif tok.startswith('<script'):
            if 'application/ld+json' in tok:
                info['jsonld'].append(tok)
            elif 'googletagmanager' not in tok:
                warn(f'{rel}: <head> 内の未対応 <script> を捨てました')
        elif tok.startswith('<style'):
            info['styles'].append(tok)
        elif tok.startswith('<meta'):
            if 'charset=' in tok or 'name="viewport"' in tok:
                continue
            info['meta'].append(tok)
        elif tok.startswith('<link'):
            rel_attr = re.search(r'rel="([^"]*)"', tok)
            kind = rel_attr.group(1) if rel_attr else ''
            if kind in ('canonical', 'stylesheet', 'icon') or (kind == 'preload' and 'as="font"' in tok):
                continue
            info['meta'].append(rewrite_attrs(tok, srcdir, 'php'))
            if kind != 'preload':
                warn(f'{rel}: <head> 内の <link rel="{kind}"> をそのまま残しました')
        else:
            warn(f'{rel}: <head> 内の未対応タグ: {tok[:60]}')
    return info


def head_part(info, with_seo=True):
    lines = []
    if with_seo:
        lines += [rewrite_site_urls(t, 'php') for t in info['meta']]
        lines += [rewrite_site_urls(t, 'php') for t in info['jsonld']]
    lines += info['styles']
    return '\n'.join(lines) + '\n'


def clean_body_start(html):
    html = re.sub(r'<noscript><iframe[^>]*googletagmanager.*?</noscript>\s*', '', html, flags=re.S)
    return html.strip() + '\n'


def clean_scripts(html):
    html = re.sub(r'<script src="[^"]*theme\.js"></script>\s*', '', html)
    return html.strip() + '\n'


def norm(text):
    return re.sub(r'\s+', ' ', text).strip()


def norm_tags(text):
    """タグ間の空白の有無を無視して比較するための正規化（ナビ・フッターはフレックス配置なので見た目に影響しない）"""
    return re.sub(r'>\s+<', '><', norm(text))


# ------------------------------------------------------------
# 記事 → 投稿データ
# ------------------------------------------------------------

def block(name, html, attrs=''):
    return f'<!-- wp:{name}{attrs} -->\n{html}\n<!-- /wp:{name} -->'


def body_blocks(inner):
    """.post-body の中身。段落と見出しは WordPress のブロックに、それ以外はカスタム HTML ブロックにする"""
    out = []
    for tag, attrs, raw in top_level(inner):
        if tag == 'p' and attrs == '':
            out.append(block('paragraph', raw))
        elif tag in ('h2', 'h3') and re.fullmatch(r'(id="[\w-]+")?', attrs):
            raw = raw.replace(f'<{tag}', f'<{tag} class="wp-block-heading"', 1)
            out.append(block('heading', raw, ' {"level":3}' if tag == 'h3' else ''))
        else:
            out.append(block('html', raw))
    return '\n\n'.join(out)


def post_content(region):
    """記事の本文領域（結論ボックス・目次・.post-body・FAQ）を投稿本文にする"""
    out = []
    for tag, attrs, raw in top_level(region):
        if tag == 'div' and attrs == 'class="post-body"':
            a, b, _ = element_at(raw, 0)
            inner = body_blocks(raw[a:b])
            out.append(block('group', '<div class="wp-block-group post-body">' + inner + '</div>', ' {"className":"post-body"}'))
        else:
            out.append(block('html', raw))
    return '\n\n'.join(out)


def one(pattern, text, where, default=None):
    m = re.search(pattern, text, re.S)
    if not m:
        if default is not None:
            return default
        sys.exit(f'{where}: {pattern} が見つかりません')
    return m.group(1).strip()


def strip_tags(html):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', html)).strip()


def build_post(rel, type_styles):
    html = read(rel)
    slug = Path(rel).stem
    s = slices(html, rel)
    head = parse_head(s['head'], rel, 'blog')
    main = s['main']

    article = None
    extra_ld = []
    for tok in head['jsonld']:
        raw = one(r'<script[^>]*>(.*)</script>', tok, rel)
        data = json.loads(raw)
        if data.get('@type') == 'Article' and article is None:
            article = data
        else:
            extra_ld.append(rewrite_site_urls(json.dumps(data, ensure_ascii=False), 'content'))
    if article is None:
        sys.exit(f'{rel}: Article の JSON-LD がありません')

    title_html = one(r'<h1 class="post-head__title">(.*?)</h1>', main, rel)
    title = html_unescape(strip_tags(title_html))
    i_head_end = main.index('</header>') + 9
    i_author = main.index('<!-- 著者 -->')
    region = rewrite_attrs(main[i_head_end:i_author], 'blog', 'content')

    cta = main[main.index('<div class="post-cta">'):]
    related = main[main.index('<section class="post-related">'):] if '<section class="post-related">' in main else ''

    og_image = one(r'<meta property="og:image" content="([^"]*)"', s['head'], rel)
    og_image = '' if og_image == SITE + '/images/ogp.png' else convert(og_image, '', 'content')

    extra_css = [t for t in head['styles'] if norm(t) not in type_styles]
    extra_css = '\n'.join(one(r'<style[^>]*>(.*)</style>', t, rel) for t in extra_css)

    meta = {
        '_linplan_seo_title': head['title'],
        '_linplan_description': one(r'<meta name="description" content="([^"]*)"', s['head'], rel),
        '_linplan_og_description': one(r'<meta property="og:description" content="([^"]*)"', s['head'], rel),
        '_linplan_og_image': og_image,
        '_linplan_title_html': title_html if '<' in title_html else '',
        '_linplan_headline': article['headline'] if article['headline'] != title else '',
        '_linplan_head_cat': one(r'<span class="post-head__cat">(.*?)</span>', main, rel),
        '_linplan_minutes': int(one(r'約(\d+)分で読めます', main, rel)),
        '_linplan_crumb': one(r'<nav class="post-breadcrumb">.*／\s*([^<／]+?)\s*</nav>', main, rel),
        '_linplan_cta_title': one(r'<p class="post-cta__ttl">(.*?)</p>', cta, rel),
        '_linplan_cta_text': one(r'<p class="post-cta__txt">(.*?)</p>', cta, rel),
        '_linplan_cta_button': strip_tags(one(r'<a href="[^"]*" class="btn btn--primary">(.*?)</a>', cta, rel)),
        '_linplan_related': re.findall(r'<a href="([\w-]+)\.html" class="post-card', related),
        '_linplan_jsonld': extra_ld,
        '_linplan_css': extra_css,
    }
    meta = {k: (html_unescape(v) if k in ('_linplan_description', '_linplan_og_description') else v) for k, v in meta.items()}

    return {
        'slug': slug,
        'title': title,
        'date': article['datePublished'],
        'modified': article.get('dateModified', article['datePublished']),
        'content': post_content(region),
        'meta': {k: v for k, v in meta.items() if v not in ('', [], None)},
    }


def html_unescape(text):
    return html_lib.unescape(text)


CARD = re.compile(r'<a href="(?:blog/)?([\w-]+)\.html" class="(post-card[^"]*)"(?: data-cat="([\w-]+)")?>(.*?)</a>', re.S)


def read_cards(html):
    cards = []
    for slug, cls, cat, inner in CARD.findall(html):
        thumb = re.search(r'<div class="(post-card__thumb[^"]*)">(.*?)</div>\s*<div class="post-card__body">', inner, re.S)
        cards.append({
            'slug': slug, 'class': cls, 'cat': cat,
            'thumb_class': thumb.group(1), 'thumb': thumb.group(2).strip(),
            'title': html_unescape(strip_tags(one(r'<h[23] class="post-card__title">(.*?)</h[23]>', inner, slug))),
            'excerpt': html_unescape(strip_tags(one(r'<p class="post-card__excerpt">(.*?)</p>', inner, slug, default=''))),
        })
    return cards


# ------------------------------------------------------------
# 生成
# ------------------------------------------------------------

def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    shutil.copytree(SRC, OUT)

    # ---- assets ----
    assets = OUT / 'assets'
    assets.mkdir(parents=True, exist_ok=True)
    for name in ASSET_FILES:
        shutil.copy2(ROOT / name, assets / name)
    for d in ASSET_DIRS:
        files = [p for p in (ROOT / d).iterdir() if p.is_file() and p.suffix.lower() in ('.webp', '.png', '.jpg', '.jpeg', '.svg', '.woff2')]
        (assets / d).mkdir(parents=True, exist_ok=True)
        for p in files:
            shutil.copy2(p, assets / d / p.name)
    shutil.copy2(ROOT / 'images' / 'ogp.png', OUT / 'screenshot.png')

    # ---- 共通：header.php / footer.php ----
    common = slices(read(COMMON_FROM), COMMON_FROM)
    nav = rewrite_attrs(no_php(common['nav'], COMMON_FROM), '', 'php').rstrip()
    footer = rewrite_attrs(no_php(common['footer'], COMMON_FROM), '', 'php')

    # PC ナビの現在ページ表示（CTA ボタン以外）
    a, b, _ = element_at(nav, nav.index('<div class="site-nav__links">'))
    links = re.sub(r'<a href="<\?php linplan_url\( \'([^\']*)\' \); \?>">',
                   lambda m: f"<a href=\"<?php linplan_url( '{m.group(1)}' ); ?>\"<?php linplan_current( '{m.group(1)}' ); ?>>", nav[a:b])
    nav_php = nav[:a] + links + nav[b:]
    # トップだけ、ナビに登場アニメーション用の .anim が付く
    nav_php = nav_php.replace('<nav class="site-nav">', '<nav class="site-nav<?php echo is_front_page() ? \' anim\' : \'\'; ?>">', 1)

    write('header.php', f'''<?php
/**
 * 共通ヘッダー（ナビ・モバイルメニュー）
 * tools/build-wp-theme.py が {COMMON_FROM} から生成。
 */
?><!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
<?php linplan_part( 'body-start' ); ?>

{nav_php}

''')
    write('footer.php', f'''<?php
/**
 * 共通フッター
 * tools/build-wp-theme.py が {COMMON_FROM} から生成。
 */
?>
{footer}

<?php wp_footer(); ?>
</body>
</html>
''')

    # ---- 各ページ ----
    titles, pages = {}, []
    blog_ld = None
    for rel, key, wp_path, wp_title in PAGES:
        srcdir = posixpath.dirname(rel)
        html = no_php(read(rel), rel)
        s = slices(html, rel)

        # ナビ・フッターが共通のものと同じか（リンク先を書き換えたうえで比較）
        got_nav = norm_tags(rewrite_attrs(s['nav'], srcdir, 'php')).replace('<nav class="site-nav anim">', '<nav class="site-nav">')
        if got_nav != norm_tags(nav):
            warn(f'{rel}: ナビが {COMMON_FROM} と違います（WordPress 版は {COMMON_FROM} のナビに統一）')
        if norm_tags(rewrite_attrs(s['footer'], srcdir, 'php')) != norm_tags(footer):
            warn(f'{rel}: フッターが {COMMON_FROM} と違います（WordPress 版は {COMMON_FROM} のフッターに統一）')
        if re.sub(r'<!--.*?-->', '', s['after-main'], flags=re.S).strip():
            warn(f'{rel}: </main> と <footer> の間の内容を捨てました')

        head = parse_head(s['head'], rel, srcdir)
        titles[key] = head['title']
        body = rewrite_attrs(s['main'], srcdir, 'php')

        if key == 'blog':
            body = replace_inner(body, r'<div class="blog-cats"[^>]*>', '\n        <?php linplan_cat_chips(); ?>      ', rel)
            body = replace_inner(body, r'<div class="blog-grid">', '\n<?php linplan_post_cards(); ?>\n      ', rel)
            keep = []
            for tok in head['jsonld']:
                data = json.loads(one(r'<script[^>]*>(.*)</script>', tok, rel))
                if data.get('@type') == 'Blog':
                    data.pop('blogPost', None)
                    blog_ld = json.loads(rewrite_site_urls(json.dumps(data, ensure_ascii=False), 'content'))
                else:
                    keep.append(tok)
            head['jsonld'] = keep

        write(f'parts/{key}/head.php', head_part(head))
        write(f'parts/{key}/body-start.php', clean_body_start(s['body-start']))
        write(f'parts/{key}/main.php', body + '\n')
        write(f'parts/{key}/scripts.php', clean_scripts(s['scripts']))
        if wp_path:
            pages.append({'path': wp_path, 'title': wp_title, 'part': key})

    # 親ページ（area）は子より先に作る
    pages = [p for p in EXTRA_PAGES if p['path'] == 'area'] + pages + [p for p in EXTRA_PAGES if p['path'] != 'area']

    # ---- 記事ページ共通（CSS・JS・著者欄） ----
    type_html = no_php(read(POST_TYPE_ARTICLE), POST_TYPE_ARTICLE)
    ts = slices(type_html, POST_TYPE_ARTICLE)
    type_head = parse_head(ts['head'], POST_TYPE_ARTICLE, 'blog')
    write('parts/single/head.php', head_part(type_head, with_seo=False))
    write('parts/single/body-start.php', clean_body_start(ts['body-start']))
    write('parts/single/scripts.php', clean_scripts(ts['scripts']))
    m = re.search(r'<div class="post-author">', ts['main'])
    _, _, end = element_at(ts['main'], m.start())
    write('parts/single/author.php', '    ' + rewrite_attrs(ts['main'][m.start():end], 'blog', 'php') + '\n')
    type_styles = {norm(t) for t in type_head['styles']}

    # ---- 記事 ----
    blog_index = read('blog/index.html')
    cards = read_cards(slices(blog_index, 'blog/index.html')['main'])
    order = [c['slug'] for c in cards]
    card_by_slug = {c['slug']: c for c in cards}
    categories = [{'slug': s_, 'name': n} for s_, n in re.findall(r'data-filter="([\w-]+)"[^>]*>([^<]+)<', blog_index) if s_ != 'all']

    # サムネイルの短いラベル（トップと各記事の関連記事カードから集める）
    labels = {}
    for rel in ['index.html'] + sorted(str(p.relative_to(ROOT)).replace('\\', '/') for p in (ROOT / 'blog').glob('*.html')):
        for c in read_cards(read(rel)):
            m = re.fullmatch(r'<span class="post-card__cat">([^<]*)</span><span>([^<]*)</span>', c['thumb'])
            if m:
                labels.setdefault(c['slug'], (m.group(1), m.group(2)))

    posts = []
    for path in sorted((ROOT / 'blog').glob('*.html')):
        if path.name == 'index.html':
            continue
        rel = 'blog/' + path.name
        post = build_post(rel, type_styles)
        card = card_by_slug.get(post['slug'])
        if not card:
            warn(f'{rel}: blog/index.html にカードがないため取り込みません')
            continue
        idx = order.index(post['slug'])
        # 同じ日の記事は、一覧の並び順どおりになるよう時刻をずらす
        post['date'] = f"{post['date']} 12:{59 - idx:02d}:00"
        post['modified'] = f"{post['modified']} 12:{59 - idx:02d}:00"
        post['category'] = card['cat']
        post['excerpt'] = card['excerpt']
        post['featured'] = 'post-card--featured' in card['class']
        post['meta']['_linplan_card_thumb'] = rewrite_attrs(card['thumb'], 'blog', 'content')
        if 'post-card__thumb--photo' in card['thumb_class']:
            post['meta']['_linplan_card_photo'] = 1
        if card['title'] != post['title']:
            post['meta']['_linplan_card_title'] = card['title']
        cat_label = one(r'<span class="post-card__cat">([^<]*)</span>', card['thumb'], rel)
        post['meta']['_linplan_card_cat'] = cat_label
        if post['slug'] in labels:
            post['meta']['_linplan_label'] = labels[post['slug']][1]
        for slug in post['meta'].get('_linplan_related', []):
            if slug not in card_by_slug:
                warn(f'{rel}: 関連記事 {slug} が一覧にありません')
        posts.append(post)
    posts.sort(key=lambda p: order.index(p['slug']))

    write('data/posts.json', json.dumps(posts, ensure_ascii=False, indent=1))
    write('data/site.json', json.dumps({'titles': titles, 'pages': pages, 'categories': categories, 'blog_jsonld': blog_ld}, ensure_ascii=False, indent=1))

    # ---- Zip ----
    if ZIP.exists():
        ZIP.unlink()
    with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED) as z:
        for p in sorted(OUT.rglob('*')):
            if p.is_file():
                z.write(p, 'linplan/' + p.relative_to(OUT).as_posix())

    print(f'固定ページ {len(pages)} 件 / 記事 {len(posts)} 件 / カテゴリ {len(categories)} 件')
    for p in posts:
        print(f"  {p['date'][:10]}  {p['category']:<7} {p['slug']}")
    if warnings:
        print('\n確認が必要な点:')
        for w in dict.fromkeys(warnings):
            print('  - ' + w)
    print(f'\n{ZIP.relative_to(ROOT).as_posix()}  ({ZIP.stat().st_size / 1024 / 1024:.1f} MB)')


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    main()
