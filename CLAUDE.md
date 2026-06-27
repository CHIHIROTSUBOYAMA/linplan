# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

（以下、リポジトリ内のコードを扱う際のガイダンス）

## 概要

日本語の Web デザイン・アプリ・AI 制作スタジオ「LinPlan」のポートフォリオサイト。静的 HTML のみで構成され、ビルドツールやパッケージマネージャーは利用しない。現在のデザインは **V4「スクラップブック」デザインシステム**（紙＋ washi テープの質感、手書き風見出し、ドット背景）。各ページは **完全に自己完結**しており、CSS / JS はすべて各 HTML ファイル内にインラインで持つ（共通の外部 CSS / JS ファイルや外部アニメーションライブラリには依存しない）。

## 動作確認

ビルド・テスト・lint コマンドは存在しない。各 HTML ファイルをブラウザで直接開いて（`file://` スキーム、または任意のローカルサーバー経由で）確認する。フォントは Google Fonts を CDN 経由で読み込むため、確認にはインターネット接続が必要（オフラインではフォールバックフォントになる）。アニメーション・スクリプトはすべてインラインの vanilla JS なので、フォント以外の外部依存はない。

## 外部依存

- **Google Fonts** — 全 18 ページが同一の `<link>` で `Klee One` / `Noto Sans JP` / `Space Grotesk` を読み込む。
  - `Klee One`（`--hand`）= 手書き風の見出し・ボタン・ロゴ
  - `Noto Sans JP`（`--font`）= 本文
  - `Space Grotesk`（`--en`）= 英字・ラベル
- **Google Tag Manager（GTM）** — 全 18 ページの `<head>`（viewport 直後）に計測スニペット、`<body>` 直後に noscript 版を設置。コンテナ ID は `GTM-5DVGF39S`。**新規ページを追加するときは、この 2 スニペットを必ず同じ位置に入れる**（入れ忘れると計測が欠落する）。
- GSAP / SplitType / ScrollTrigger などの外部ライブラリは **使用しない**（旧 `css/` `js/vendor/` は撤去済み。リビールは自前の `IntersectionObserver` で実装）。

## ページ一覧（18 ページ）

| ファイル | 役割 |
|---|---|
| `index.html` | トップページ — Hero / Service map / Problem / Services / Why us / Works / Process / Comparison / FAQ / 相談室（Blog）/ CTA |
| `about.html` | 私について（プロフィール詳細） |
| `services.html` | サービス紹介 |
| `aeo-geo.html` | AEO / GEO（生成AI最適化）解説ページ |
| `works.html` | 制作実績ギャラリー（Original Products / Real Works / Practice Works） |
| `pricing.html` | 料金プラン |
| `faq.html` | よくあるご質問 |
| `contact.html` | お問い合わせフォームページ |
| `privacy.html` | プライバシーポリシー |
| `tokushoho.html` | 特定商取引法に基づく表記（販売事業者・価格・支払・契約期間・解約条件などの法定表記） |
| `blog/index.html` | 相談室（ブログ一覧）— 公開記事カード＋「近日公開」プレースホルダー |
| `blog/hp-cost-2026.html` | ブログ記事「ホームページ制作費の相場は？【2026年版・中小企業向け】」 |
| `blog/how-to-order-website.html` | ブログ記事（ホームページ発注の進め方） |
| `blog/aeo-vs-seo.html` | ブログ記事（AEO と SEO の違い） |
| `blog/wordpress-vs-original.html` | ブログ記事（WordPress と独自制作の比較） |
| `blog/sme-ai-search-ready.html` | ブログ記事（中小企業の AI 検索対応） |
| `blog/cited-by-chatgpt.html` | ブログ記事（ChatGPT に引用されるには） |

ナビ／モバイルメニューのリンク構成は全ページ共通：私について（about）/ サービス（services）/ AEO・GEO（aeo-geo）/ 制作実績（works）/ 料金（pricing）/ よくある質問（faq）/ 相談室（blog/index.html）/ 無料で相談！（contact、CTA ボタン）。フッターはこれにプライバシーポリシー（privacy）と特定商取引法に基づく表記（tokushoho）を加えた構成。

## ディレクトリ構成

```
/
├─ index.html / about.html / services.html / aeo-geo.html / works.html /
│  pricing.html / faq.html / contact.html / privacy.html / tokushoho.html
├─ blog/
│   ├─ index.html          相談室（ブログ一覧）
│   └─ *.html              ブログ記事（hp-cost-2026 / how-to-order-website /
│                          aeo-vs-seo / wordpress-vs-original /
│                          sme-ai-search-ready / cited-by-chatgpt）
├─ CLAUDE.md
├─ sitemap.xml / robots.txt
├─ images/
│   ├─ *.webp             制作物画像（studyreport / tsukimi / practice-* 等。HTML はすべて WebP を参照）
│   └─ ogp.png            OGP 共有用（PNG 必須のため残す）
└─ 分析送信用/ + 分析送信用.zip   旧サイトの分析用アーカイブ（編集不要・サイト本体とは無関係）
```

## アーキテクチャ

各 HTML ファイルは完全自己完結。`<head>` 内の `<style>` ブロックにそのページの全 CSS を、`</body>` 直前の `<script>` ブロックに全 JS を持つ。共通コンポーネント（ナビ・モバイルメニュー・FAB・フッター・ローダー・リビール）は **18 ファイルすべてにインラインで重複**している。共通部分を変更する場合は全ページに同じ変更を反映する必要がある。

JS が無効でも崩れないよう、スクリプトはすべて「依存なし・IIFE・`DOMContentLoaded` 後に起動」の形を取る。`prefers-reduced-motion` を尊重する。

### CSS カスタムプロパティ（デザイントークン）

各ページが同一の `:root` を宣言する（値はページ間で統一）。

```
--ink:        #2C2722   /* 文字色（インク） */
--paper:      #FBF8F1   /* 紙の白 */
--orange:     #F6C445   /* メインアクセント（イエロー寄りオレンジ） */
--orange-deep:#B07D0A
--teal:       #2FA98F   /* サブアクセント（ティール） */
--font:  'Noto Sans JP' /* 本文 */
--hand:  'Klee One'     /* 手書き風見出し・ボタン */
--en:    'Space Grotesk'/* 英字 */
--ease:  cubic-bezier(.2,.8,.2,1)
--container: 1120px
```

背景は `body` に `#EDE4D2` ベース＋ radial-gradient のドットパターン。

### 共通コンポーネントパターン

- **ローダー（`#lp-loader`）** — 全ページ共通。ターミナル風に "LinPlan" をタイプし、下線（swash）を描いてから開く。再訪・即時読込でも最後まで再生してからヒーローを表示する保険ロジック付き。
- **ナビ（`.site-nav`）** — `position: fixed`。実体はほぼ右上のハンバーガー（`.hamburger`、波線 SVG アニメ）のみで、スクロール状態は `.scrolled` クラスで管理。
- **モバイルメニュー（`.mobile-menu`）** — 全画面オーバーレイ。ハンバーガーで開閉し、リンク／× ／ Esc で閉じる。
- **フローティング Contact ボタン（`.fab`）** — 右下に fixed。ヒーローを抜けると `.is-revealed` で出現。
- **フッター（`.site-footer`）** — ロゴ＋タグライン＋ナビ＋連絡先。
- **リビールアニメーション** — `.reveal` 要素が `IntersectionObserver`（閾値 12%）で `.is-visible` を取得しフェードイン。`.reveal-d1` / `.reveal-d2` でディレイ。
- **紙シート＋ washi テープ** — `.section > .container` が白い紙シートになり、`::before` / `::after` でテープ（または押しピン）が留められる。`.cta-box` を含むセクションは押しピン留め。
- **ポラロイド / ブラウザフレーム** — Works の作品カード。`.polaroid__shot` / `.browser__shot` はスクロール可能で、`scroll-hint` バッジを JS で付与する。

### FAQ アコーディオン

`index.html` と `faq.html` の `.faq-item` は、`.faq-q` クリックで `.open` をトグルし `.faq-a` の `max-height` を開閉する。

## お問い合わせフォーム（Formspree 接続済み）

`contact.html` の submit ハンドラ（`#contactForm`）は `fetch()` で Formspree（`action="https://formspree.io/f/xvzldalg"`、`method="POST"`）へ非同期送信する。HTML5 バリデーション（`checkValidity` / `reportValidity`）通過後に送信し、成功で `#formDone`（完了メッセージ）、失敗で `#formError`（mailto: 導線つき）を表示する。送信中はボタンを `disabled` にして「送信中…」表示。URL パラメータ（`?plan=` / `?service=` 等）や `localStorage` の「気になっている点」から本文・プラン選択をプレフィルする機能もある。連絡先メールは実値（`tsubochihiroyama2230@gmail.com`、本文中およびページ内に mailto: リンクあり）。**送信先を変える場合は `<form>` の `action` の Formspree ID を差し替える**。

## Works の 3 カテゴリ運用ルール（重要）

`index.html` / `works.html` の Works は **Original Products / Real Works / Practice Works** の 3 カテゴリで運用する。法令面（景表法・不正競争防止法・著作権・商標）とブランド面の両方を守るための運用ルール。

| カテゴリ | 内容 | 表記ルール |
|---|---|---|
| **Original Products** | 自社プロダクト（StudyReport / Tsukimi 等） | 自分が企画・実装したものに限る |
| **Real Works** | クライアント案件・見本サイト（例：和食 -結 yui-） | 模写を混ぜない |
| **Practice Works** | 模写・学習作品 | **実在企業名・サービス名は使わない**。業種ベースのラベル（例：「Hospitality 模写サイト」「Medical 模写サイト」）で表示する |

### 禁止事項

- Practice Works に実在企業名を入れない（`alt` 属性も同様）。
- Practice Works を「制作実績」「公式サイト」と表記しない。「模写サイト」「学習作品」と明示する。
- Real Works に模写を混ぜない。

実案件が発生したら Practice Works の該当カードを Real Works 側に移し、内容を実案件向けに書き換える。

## ブログ（相談室）の運用

`blog/` 配下が「中小企業のHP・IT・AI 相談室」。`blog/index.html` が記事一覧、`blog/hp-cost-2026.html` 以降が個別記事。デザイン・共通コンポーネントはルートのページと同一（完全自己完結のインライン CSS / JS）。

- **リンクは相対パスで書く** — `blog/` 配下からルートのページへは、ルート相対ではなく `../about.html` `../contact.html` のような相対パスでリンクする（ブログ内の相互リンクは `index.html` / `hp-cost-2026.html` のようにファイル名のみ）。
- **記事を追加したら次の 3 箇所を必ず更新する**：
  1. `blog/index.html` の記事一覧にカードを追加
  2. `index.html`（トップ）の相談室セクション — `.blog-grid` のカードを更新（「近日公開」プレースホルダーがあれば実記事に差し替える）
  3. `sitemap.xml` に記事の URL を追加
- 記事ページには OGP / canonical / GTM の共通一式に加え、JSON-LD（`Article`。FAQ を含む記事は `FAQPage` も）を入れる。`hp-cost-2026.html` が雛形。

## 画像の取り扱い

- HTML から参照しているのは `images/*.webp` のみ（`index.html` / `works.html` の作品画像）。
- `ogp.png` は OGP / Twitter Card 用に残す（PNG 必須のクライアントが存在するため）。
- 新規画像は WebP に変換し、`loading="lazy"` `decoding="async"` を付ける。
- ファビコンは各ページとも data-URI の SVG（外部ファイル不要）。

## SEO / sitemap

- `sitemap.xml` / `robots.txt` はリポジトリルートに配置。新規ページ追加・削除時は `sitemap.xml` の `<urlset>` も更新する。ベース URL は `https://chihirotsuboyama.github.io/`。
- 全 18 ページの `<head>`（`<title>` 直後）に **OGP / Twitter Card / canonical** メタを設置済み。`og:image` / `twitter:image` は `https://chihirotsuboyama.github.io/images/ogp.png`（絶対 URL）、`og:url` / canonical はページごとの絶対 URL。**新規ページ追加時は同じ一式を入れる**（`og:title` / `og:description` / URL をそのページ用に差し替える）。
- JSON-LD 構造化データが入っているのはブログ記事のみ（`blog/hp-cost-2026.html` に `Article` ＋ `FAQPage`）。現行 `index.html` には入っていない（FAQ は `faq.html` に分離）。構造化データを追加する場合は該当ページのコンテンツと同期させる。
