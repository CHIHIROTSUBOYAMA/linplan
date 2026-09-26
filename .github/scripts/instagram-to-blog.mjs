// Instagram の投稿を Claude で記事化し、ブログの下書き（HTML）を生成する
// 生成物は GitHub Actions がプルリクエストとして出す。人が確認してからマージ＝公開。
import fs from "node:fs";
import path from "node:path";
import { linkedSlug } from "./insta-blog-link.mjs";

const IG_TOKEN = process.env.IG_ACCESS_TOKEN;
const AI_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";
const POST_ID = (process.env.POST_ID || "").trim();            // 空なら未記事化の最新投稿
const SKIP_IDS = new Set((process.env.SKIP_IDS || "").split(/\s+/).filter(Boolean)); // 下書きPRが開いている投稿
const MIN_CHARS = 40;                                             // 本文がこれ未満の投稿は材料不足として対象外
const SITE = "https://linplan.jp";
const ROOT = process.cwd();
const BLOG = path.join(ROOT, "blog");
const TEMPLATE = path.join(BLOG, "funabashi-seitai.html");        // デザインの型として使う既存記事
const REGISTRY = path.join(BLOG, "insta-articles.json");
const OUT = process.env.GITHUB_OUTPUT;
const PR_BODY = process.env.PR_BODY || "/tmp/pr-body.md";

const log = (...a) => console.log(...a);
function fail(m) { console.error("✗ " + m); process.exit(1); }
function setOutput(k, v) { if (OUT) fs.appendFileSync(OUT, `${k}=${String(v).replace(/\n/g, " ")}\n`); }
if (!IG_TOKEN) fail("IG_ACCESS_TOKEN が未設定です");
if (!AI_KEY) fail("ANTHROPIC_API_KEY が未設定です");
if (!fs.existsSync(TEMPLATE)) fail(`型にする記事 ${path.basename(TEMPLATE)} が見つかりません`);

const esc = (t = "") => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rich = t => esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");   // **強調** だけ許可
const plain = t => String(t).replace(/\*\*/g, "");
const cleanCaption = c => (c || "").replace(/#[^\s#]+/g, "").trim();
const jstDate = d => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(d); // YYYY-MM-DD
const CATS = { local: "地域・集客", aeo: "AEO/GEO", choice: "選び方・比較", money: "お金・相場" };
const SHORT = { local: "地域", aeo: "AEO", choice: "選び方", money: "お金" };   // 関連カード用の短いラベル
const shortWord = t => (t.split(/[？?【（(｜|]/)[0] || t).slice(0, 10);

// ---------- 1. 対象の投稿を決める ----------
const registry = fs.existsSync(REGISTRY) ? JSON.parse(fs.readFileSync(REGISTRY, "utf8")) : {};
const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
const res = await fetch(`https://graph.instagram.com/me/media?fields=${fields}&limit=25&access_token=${IG_TOKEN}`);
const json = await res.json();
if (json.error) fail(`Instagram APIエラー: ${json.error.message}`);
const media = json.data ?? [];

let post;
if (POST_ID) {
  post = media.find(m => m.id === POST_ID);
  if (!post) fail(`投稿ID ${POST_ID} が最新25件の中に見つかりません`);
  if (registry[POST_ID]) fail(`投稿ID ${POST_ID} は記事化済みです（blog/${registry[POST_ID]}.html）`);
  if (linkedSlug(post.caption)) fail(`投稿ID ${POST_ID} はブログ記事（blog/${linkedSlug(post.caption)}.html）の告知投稿なので記事化しません`);
} else {
  // 本文に linplan.jp/blog/… を書いた投稿は既存記事の告知なので対象外（同じテーマの記事が二重にできるのを防ぐ）
  post = media.find(m => !registry[m.id] && !SKIP_IDS.has(m.id) && !linkedSlug(m.caption) && cleanCaption(m.caption).length >= MIN_CHARS);
}
if (!post) { log("記事化できる新しい投稿はありません（すべて記事化済み、または本文が短すぎます）"); setOutput("created", "false"); process.exit(0); }
const caption = cleanCaption(post.caption);
if (caption.length < MIN_CHARS) fail(`本文が短すぎて記事にできません（${caption.length}文字）`);
log(`✓ 対象の投稿: ${post.id}（${post.timestamp}）`);

// ---------- 2. 画像を保存（media_url は期限付き） ----------
fs.mkdirSync(path.join(BLOG, "img"), { recursive: true });
const imgFile = `insta-${post.id}.jpg`;
const imgPath = path.join(BLOG, "img", imgFile);
const imgSrc = post.media_type === "VIDEO" ? post.thumbnail_url : post.media_url;
let imgB64 = null;
if (imgSrc) {
  const r = await fetch(imgSrc);
  if (r.ok) { const buf = Buffer.from(await r.arrayBuffer()); fs.writeFileSync(imgPath, buf); imgB64 = buf.toString("base64"); log(`✓ 画像保存 blog/img/${imgFile}`); }
  else log(`! 画像を取得できませんでした（HTTP ${r.status}）。画像なしで続行します`);
}

// ---------- 3. 既存記事の一覧（関連記事の候補） ----------
const blogIndex = fs.readFileSync(path.join(BLOG, "index.html"), "utf8");
const existing = [...blogIndex.matchAll(/<a href="([a-z0-9-]+)\.html" class="post-card[^"]*" data-cat="(\w+)">([\s\S]*?)<\/a>/g)]
  .map(m => {
    const inner = m[3];
    const title = (inner.match(/<h2 class="post-card__title">([^<]+)<\/h2>/) || [])[1];
    const word = (inner.match(/<span class="post-card__art-word">([^<]+)<\/span>/) || [])[1];
    const dates = [...inner.matchAll(/<span class="post-card__meta-dates"><span>([\d.]+)<\/span><span>([^<]+)<\/span>/g)][0];
    return title && { slug: m[1], cat: m[2], title, word, date: dates?.[1] || "", mins: dates?.[2] || "" };
  }).filter(Boolean);

// ---------- 4. Claude で記事化 ----------
const system = `あなたは千葉県船橋市のWeb制作事務所「Linplan」代表・坪山ちひろとして、自社ブログ「中小企業のHP・IT・AI 相談室」の記事を書きます。
読者は船橋の店舗オーナー・中小企業の経営者で、ITに詳しくない人です。

【文体】ですます調。親しみやすく、経営者の目線で。専門用語は使うなら一言で説明する。売り込み臭を出さない。

【絶対に守ること】
- 投稿本文と画像から読み取れる事実だけを使う。数字・料金・実績・お客様の声・固有名詞を創作しない。
- 一般論で補うのは構わないが、断定できない内容は review_notes に書き出す。
- 「必ず」「絶対」「〇位になる」などの保証表現、医療・健康効果の断定はしない。
- 画像に写っている人物を特定・推測しない。

【記事の型（AI検索に引用されやすい構成）】
- 見出しは読者の疑問そのもの（質問形）にする。
- answer は記事全体への結論を2〜3文で。最初の1文で問いに答える。
- 本文は3〜4セクション。各セクションは2〜4段落、必要なら箇条書き。
- FAQは3問。回答は2〜3文で完結させる。

【出力】次のJSONだけを返す。前置き・コードブロック記号は付けない。強調は **ここ** の形のみ使う。
{
  "slug": "英小文字とハイフンのURL用（40文字以内）",
  "category": "local | aeo | choice | money のどれか",
  "title": "記事タイトル（40文字以内）",
  "seo_title": "検索結果用タイトル（32文字以内）",
  "description": "検索結果の説明文（80〜120文字）",
  "answer": "結論（2〜3文）",
  "intro": "導入段落（2〜3文）",
  "sections": [{ "heading": "質問形の見出し", "paragraphs": ["段落"], "bullets": ["任意"] }],
  "faq": [{ "q": "質問", "a": "回答" }],
  "cta_title": "記事末の相談の呼びかけ（25文字以内）",
  "related": ["下の既存記事リストから関連するslugを最大2つ"],
  "review_notes": ["公開前に人が確認すべき点（事実確認が必要な記述、一般論で補った箇所など）"]
}`;

const userText = `【Instagramの投稿本文】
${caption}

【投稿日】${jstDate(new Date(post.timestamp))}

【既存記事リスト（related はここから選ぶ）】
${existing.map(e => `- ${e.slug}: ${e.title}`).join("\n")}`;

const content = [];
if (imgB64) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: imgB64 } });
content.push({ type: "text", text: userText });

async function callClaude() {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": AI_KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 6000, system, messages: [{ role: "user", content }] }),
  });
  const data = await r.json();
  if (data.error) throw new Error(`${data.error.type}: ${data.error.message}`);
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  const m = text.replace(/```json|```/g, "").match(/\{[\s\S]*\}/);
  if (!m) throw new Error("JSONが返ってきませんでした");
  return JSON.parse(m[0]);
}
function validate(a) {
  const need = ["slug", "category", "title", "seo_title", "description", "answer", "intro", "sections", "faq"];
  for (const k of need) if (!a[k] || (Array.isArray(a[k]) && !a[k].length)) throw new Error(`項目 ${k} がありません`);
  if (!Array.isArray(a.sections) || a.sections.some(s => !s.heading || !Array.isArray(s.paragraphs))) throw new Error("sections の形式が不正");
}
let art;
for (let i = 1; i <= 2; i++) {
  try { art = await callClaude(); validate(art); break; }
  catch (e) { if (i === 2) fail(`記事生成に失敗しました: ${e.message}`); log(`! 1回目の生成に失敗（${e.message}）。再試行します`); }
}
log(`✓ 記事を生成: ${art.title}`);

// ---------- 5. 値を整える ----------
if (!CATS[art.category]) art.category = "local";
let slug = String(art.slug).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || `insta-${post.id}`;
while (fs.existsSync(path.join(BLOG, `${slug}.html`))) slug = slug.replace(/(-\d+)?$/, m => `-${(parseInt(m.slice(1)) || 1) + 1}`);
const related = (art.related || []).filter(s => existing.some(e => e.slug === s)).slice(0, 2);
const today = jstDate(new Date());
const dotDate = today.replace(/-/g, ".");
const bodyChars = [art.answer, art.intro, ...art.sections.flatMap(s => [...s.paragraphs, ...(s.bullets || [])]), ...art.faq.flatMap(f => [f.q, f.a])].join("").length;
const minutes = Math.max(3, Math.round(bodyChars / 500));
const url = `${SITE}/blog/${slug}.html`;
const ogImage = imgB64 ? `${SITE}/blog/img/${imgFile}` : `${SITE}/images/ogp.png`;

// ---------- 6. 記事HTMLを組み立てる（既存記事の head・ナビ・フッターを流用） ----------
let html = fs.readFileSync(TEMPLATE, "utf8");
const setMeta = (re, val) => { if (!re.test(html)) fail(`テンプレートに ${re} が見つかりません`); html = html.replace(re, val); };
setMeta(/<title>[\s\S]*?<\/title>/, `<title>${esc(plain(art.seo_title))}｜ Linplan</title>`);
setMeta(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">`);
setMeta(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(plain(art.description))}">`);
setMeta(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(plain(art.title))}">`);
setMeta(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(plain(art.description))}">`);
setMeta(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${url}">`);
html = html.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${ogImage}">`);

const ldArticle = { "@context": "https://schema.org", "@type": "Article", headline: plain(art.title), description: plain(art.description),
  image: ogImage, datePublished: today, dateModified: today,
  author: { "@type": "Person", name: "坪山ちひろ", url: `${SITE}/about.html` }, publisher: { "@type": "Organization", name: "Linplan" }, mainEntityOfPage: url };
const ldFaq = { "@context": "https://schema.org", "@type": "FAQPage",
  mainEntity: art.faq.map(f => ({ "@type": "Question", name: plain(f.q), acceptedAnswer: { "@type": "Answer", text: plain(f.a) } })) };
const ldBlocks = [...html.matchAll(/<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g)];
if (ldBlocks.length) {
  const first = ldBlocks[0].index, last = ldBlocks.at(-1).index + ldBlocks.at(-1)[0].length;
  html = html.slice(0, first) +
    `<script type="application/ld+json">\n${JSON.stringify(ldArticle, null, 2)}\n</script>\n<script type="application/ld+json">\n${JSON.stringify(ldFaq, null, 2)}\n</script>\n` +
    html.slice(last);
}

const author = (html.match(/<!-- 著者 -->[\s\S]*?(?=\n\s*<!-- CTA -->)/) || [""])[0];
const faqId = `a${art.sections.length + 1}`;
const section = (s, i) => `      <h2 id="a${i + 1}">${esc(plain(s.heading))}</h2>
${s.paragraphs.map(p => `      <p>${rich(p)}</p>`).join("\n")}${s.bullets?.length ? `\n      <ul>\n${s.bullets.map(b => `        <li>${rich(b)}</li>`).join("\n")}\n      </ul>` : ""}`;
const relatedCards = related.map(sl => { const e = existing.find(x => x.slug === sl);
  return `        <a href="${e.slug}.html" class="post-card">
          <div class="post-card__thumb"><span class="post-card__cat">${esc(SHORT[e.cat] || "相談室")}</span><span>${esc(e.word || shortWord(e.title))}</span></div>
          <div class="post-card__body"><h3 class="post-card__title">${esc(e.title)}</h3><div class="post-card__meta"><span>${e.date}</span>${e.mins ? `<span>${esc(e.mins)}</span>` : ""}</div></div>
        </a>`; }).join("\n");

const main = `<main>
  <div class="post-wrap">
    <nav class="post-breadcrumb"><a href="../">ホーム</a> ／ <a href="./">相談室</a> ／ ${esc(plain(art.title).slice(0, 24))}</nav>
  </div>

  <article>
   <div class="post-wrap">
    <header class="post-head">
      <span class="post-head__cat">${CATS[art.category]}</span>
      <h1 class="post-head__title">${esc(plain(art.title))}</h1>
      <div class="post-head__meta"><span>公開 <time datetime="${today}">${dotDate}</time></span><span>更新 <time datetime="${today}">${dotDate}</time></span><span>約${minutes}分で読めます</span><span>カテゴリ：${CATS[art.category]}</span></div>
    </header>

    <!-- AEO最適化：冒頭の即答ボックス -->
    <div class="post-answer">
      <p class="post-answer__label">結論</p>
      <p>${rich(art.answer)}</p>
    </div>

    <!-- 目次 -->
    <nav class="post-toc">
      <p class="post-toc__ttl">この記事でわかること</p>
      <ol>
${art.sections.map((s, i) => `        <li><a href="#a${i + 1}">${esc(plain(s.heading))}</a></li>`).join("\n")}
        <li><a href="#${faqId}">よくある質問</a></li>
      </ol>
    </nav>

    <div class="post-body">
${imgB64 ? `      <figure style="margin:0 0 28px"><img src="img/${imgFile}" alt="${esc(plain(art.title))}" loading="lazy" decoding="async" style="width:100%;max-width:340px;height:auto;display:block;margin:0 auto;border-radius:6px"><figcaption style="text-align:center;font-size:.78rem;color:var(--ink-faint);margin-top:8px;line-height:1.6"><a href="${esc(post.permalink)}" target="_blank" rel="noopener">Instagramの投稿より</a></figcaption></figure>\n` : ""}      <p>${rich(art.intro)}</p>

${art.sections.map(section).join("\n\n")}
    </div>

    <!-- FAQ -->
    <section class="post-faq" id="${faqId}">
      <h2 class="post-faq__ttl">よくある質問</h2>
${art.faq.map(f => `      <div class="post-faq__item">
        <p class="post-faq__q">${esc(plain(f.q))}</p>
        <p class="post-faq__a">${rich(f.a)}</p>
      </div>`).join("\n")}
    </section>

    ${author.trim()}

    <!-- CTA -->
    <div class="post-cta">
      <p class="post-cta__ttl">${esc(plain(art.cta_title || "ホームページのこと、気軽にご相談ください"))}</p>
      <p class="post-cta__txt">ご相談・お見積もりは無料です。しつこい営業は一切しません。<br>船橋市内・近隣へは直接お伺いして、対面でご相談いただけます。</p>
      <a href="../contact.html" class="btn btn--primary">無料で相談する</a>
    </div>
${relatedCards ? `
    <!-- 関連記事 -->
    <section class="post-related">
      <h2 class="post-related__ttl">あわせて読みたい</h2>
      <div class="blog-grid">
${relatedCards}
      </div>
    </section>` : ""}
   </div>
  </article>
</main>`;
if (!/<main>[\s\S]*?<\/main>/.test(html)) fail("テンプレートに <main> がありません");
html = html.replace(/<main>[\s\S]*?<\/main>/, main);
fs.writeFileSync(path.join(BLOG, `${slug}.html`), html, "utf8");
log(`✓ blog/${slug}.html を作成`);

// ---------- 7. 一覧・サイトマップ・台帳を更新 ----------
const excerpt = plain(art.description);
const card = `      <a href="${slug}.html" class="post-card" data-cat="${art.category}">
        <div class="post-card__thumb${imgB64 ? " post-card__thumb--photo" : ""}"><span class="post-card__cat">${CATS[art.category]}</span>${imgB64 ? `<img src="img/${imgFile}" alt="" loading="lazy" decoding="async">` : `<span class="post-card__art" aria-hidden="true"><span class="post-card__art-word">${esc(shortWord(plain(art.title)))}</span></span>`}</div>
        <div class="post-card__body">
          <h2 class="post-card__title">${esc(plain(art.title))}</h2>
          <p class="post-card__excerpt">${esc(excerpt)}</p>
          <div class="post-card__meta"><span class="post-card__meta-dates"><span>${dotDate}</span><span>約${minutes}分</span></span><span class="post-card__more">続きを読む →</span></div>
        </div>
      </a>
`;
const gridAt = blogIndex.indexOf('<div class="blog-grid">');
if (gridAt < 0) fail("blog/index.html に blog-grid がありません");
// 目立たせている先頭カード（featured）の直後、通常カードの先頭に入れる
const afterGrid = gridAt + '<div class="blog-grid">'.length;
const rest = blogIndex.slice(afterGrid);
const firstNormal = rest.search(/<a href="[^"]+" class="post-card"(?! post-card--featured)[^>]*>/);
const insertAt = firstNormal >= 0 ? afterGrid + firstNormal - (rest.slice(0, firstNormal).match(/[ \t]*$/)[0].length) : afterGrid + 1;
let newIndex = blogIndex.slice(0, insertAt) + card + blogIndex.slice(insertAt);
log("✓ blog/index.html に一覧カードを追加");
// 一覧の構造化データ（Blog）の blogPost にも追加する（新しい記事を先頭に）
const blogLd = [...newIndex.matchAll(/<script type="application\/ld\+json">\n([\s\S]*?)\n<\/script>/g)]
  .find(m => { try { return JSON.parse(m[1])["@type"] === "Blog"; } catch { return false; } });
if (blogLd) {
  const ld = JSON.parse(blogLd[1]);
  ld.blogPost = (ld.blogPost || []).filter(p => p.url !== url);
  ld.blogPost.unshift({ "@type": "BlogPosting", headline: plain(art.title), url, datePublished: today });
  newIndex = newIndex.replace(blogLd[0], `<script type="application/ld+json">\n${JSON.stringify(ld, null, 2)}\n</script>`);
  log("✓ blog/index.html の Blog 構造化データに追加");
} else log("! blog/index.html に Blog の構造化データが見つかりません。blogPost は手動で追加してください");
fs.writeFileSync(path.join(BLOG, "index.html"), newIndex, "utf8");

const smPath = path.join(ROOT, "sitemap.xml");
if (fs.existsSync(smPath)) {
  const sm = fs.readFileSync(smPath, "utf8");
  if (!sm.includes(`<loc>${url}</loc>`)) {
    fs.writeFileSync(smPath, sm.replace("</urlset>", `  <url>\n    <loc>${url}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n</urlset>`), "utf8");
    log("✓ sitemap.xml に追加");
  }
}
// トップページの相談室：新しい記事を先頭に入れ、末尾の1枚を外す（3枚のまま）
const topPath = path.join(ROOT, "index.html");
const top = fs.readFileSync(topPath, "utf8");
const topGrid = top.match(/(<div class="blog-grid">\n)([\s\S]*?)(\n    <\/div>\n    <div style="text-align:center;margin-top:40px" class="reveal"><a href="blog\/")/);
if (topGrid) {
  const thumbWord = plain(art.title).length > 16 ? plain(art.title).slice(0, 15) + "…" : plain(art.title);
  const topCard = `      <a href="blog/${slug}.html" class="post-card reveal">
        <div class="post-card__thumb"><span class="post-card__cat">${CATS[art.category]}</span><span>${esc(thumbWord)}</span></div>
        <div class="post-card__body">
          <h3 class="post-card__title">${esc(plain(art.title))}</h3>
          <p class="post-card__excerpt">${esc(excerpt)}</p>
          <div class="post-card__meta"><span>${dotDate}</span><span>約${minutes}分</span></div>
        </div>
      </a>`;
  const cards = [topCard, ...(topGrid[2].match(/      <a href="[^"]+" class="post-card[\s\S]*?<\/a>/g) || [])].slice(0, 3)
    .map((c, i) => c.replace(/class="post-card[^"]*"/, `class="post-card reveal${i ? ` reveal-d${i}` : ""}"`));
  fs.writeFileSync(topPath, top.replace(topGrid[0], topGrid[1] + cards.join("\n") + topGrid[3]), "utf8");
  log("✓ index.html（トップ）の相談室カードを更新");
} else log("! index.html の相談室カードが見つかりません。トップは手動で更新してください");

// 手書き風フォント（Klee One）で描画される文字をサブセット対象に追記する（漏れるとその字だけ太く見える）
const kleePath = path.join(ROOT, "tools", "klee-chars.txt");
if (fs.existsSync(kleePath)) {
  const kleeText = [art.title, art.cta_title || "", ...art.sections.map(s => s.heading), imgB64 ? "" : shortWord(plain(art.title))].map(plain).join("");
  const have = new Set(fs.readFileSync(kleePath, "utf8"));
  const add = [...new Set(kleeText)].filter(c => !have.has(c) && !/[\s -~　-〿ぁ-ゟ゠-ヿ]/.test(c));
  if (add.length) { fs.appendFileSync(kleePath, add.join(""), "utf8"); log(`✓ tools/klee-chars.txt に ${add.length} 文字を追記`); }
}

registry[post.id] = slug;
fs.writeFileSync(REGISTRY, JSON.stringify(registry, null, 2) + "\n", "utf8");

// ---------- 8. プルリクエストの説明文 ----------
const notes = (art.review_notes || []).map(n => `- [ ] ${plain(n)}`).join("\n") || "- [ ] （AIからの指摘なし。念のため全文を確認）";
fs.writeFileSync(PR_BODY, `## AIが書いた記事の下書きです（まだ公開されていません）

**マージすると公開されます。** 内容を確認し、問題があれば修正してからマージ、使わない場合はクローズしてください。

| 項目 | 内容 |
|---|---|
| 記事 | \`blog/${slug}.html\` |
| タイトル | ${plain(art.title)} |
| カテゴリ | ${CATS[art.category]} |
| 元の投稿 | ${post.permalink} |

### AIが「確認が必要」と挙げた点
${notes}

### 公開前チェック
- [ ] 事実と違うこと・言い過ぎていることが書かれていない
- [ ] 料金・数字・お客様に関する記述が正しい（創作されていない）
- [ ] 誤字・不自然な日本語がない
- [ ] タイトルと結論が読者の疑問に答えている

### 元の投稿本文
> ${caption.replace(/\n/g, "\n> ")}
`, "utf8");
setOutput("created", "true");
setOutput("slug", slug);
setOutput("post_id", post.id);
setOutput("title", plain(art.title));
log("✓ 完了");
