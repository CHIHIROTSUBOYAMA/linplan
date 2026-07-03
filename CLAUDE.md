# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

（以下、リポジトリ内のコードを扱う際のガイダンス）

## 概要

日本語の Web デザイン・アプリ・AI 制作スタジオ「Linplan」のポートフォリオサイト。静的 HTML のみで構成され、ビルドツールやパッケージマネージャーは利用しない。**ブランド表記は「Linplan」（頭文字のみ大文字）で統一**（旧「LinPlan」「linplan」表記は廃止。ロゴ・フッター・タイトル・OGP・JSON-LD すべて同表記。URL・ドメインの `linplan.jp` のみ小文字のまま）。

**実際に表示されるデザインは Linplan デザインシステム（DS）の「クリーム紙（lifted cream paper）」**＝落ち着いたクリーム背景＋ドット、手書き風見出し（Klee One）、テラコッタ／オリーブ／タンの配色、フラットで柔らかいカード。これは **2 層構成**で実現している：

1. 各 HTML に残る旧「V4 スクラップブック」由来の共通コンポーネント CSS を、**共有 `base.css`** に集約（全ページが読み込む）。
2. その後に読む **共有 `theme.css`（DS スキン）** がカスケード順（最後に読込）で上書きし、スクラップブックの washi テープ／ポラロイド傾け／blob 等を打ち消してクリーム紙の見た目を出す。

つまり CSS は **`base.css`（共通コンポーネントライブラリ）＋ `theme.css`（DS スキン）の 2 つの外部ファイルを全ページで共有**し、**ページ固有の CSS だけ**を各 HTML のインライン `<style>` に残す。JS は各 HTML にインラインの vanilla JS（依存なし）＋ **共通 `theme.js`**（ナビのスクロール状態）。外部アニメーションライブラリには依存しない。

## 動作確認

ビルド・テスト・lint コマンドは存在しない。各 HTML ファイルをブラウザで開いて確認する。ただし **`base.css` / `theme.css` / `theme.js` を相対パスで読み込む**ため、`file://` 直開きよりも**ローカルサーバー経由（例：`npx http-server` や `python -m http.server`）が確実**（`.claude/launch.json` に `portfolio` 設定あり）。フォントは Google Fonts を CDN 経由で読み込むため、確認にはインターネット接続が必要（オフラインではフォールバックフォントになる）。

**見た目を変えない CSS リファクタの検証**は、`preview_eval` で全要素の computed style を移行前後で比較するダイジェスト方式が確実（スクリーンショット比較に頼らない。「どの定義が実際に効いているか」を直接見る）。

## 外部依存

- **共有ローカルファイル（全 18 ページが相対パスで読込）** — 新規ページ追加時は必ず 3 つとも入れる：
  - `base.css` … 共通コンポーネント CSS ライブラリ（ルートは `base.css`、blog は `../base.css`）。**インライン `<style>` より前、`theme.css` より前**に置く。
  - `theme.css` … DS スキン。**`<head>` 内・インライン `<style>` と `base.css` の後・`</head>` の前**（最後に読込して上書きする設計）。ルートは `theme.css`、blog は `../theme.css`。
  - `theme.js` … 共通ナビ用スクリプト（スクロールで `.site-nav` に `.past-hero` を付与、現在ページ表示、**FAQ アコーディオンのキーボード操作対応**＝`.faq-q` に `role="button"`/`tabindex` を付与し Enter/Space で開閉）。`</body>` 直前。ルートは `theme.js`、blog は `../theme.js`。
- **Google Fonts** — 全ページ（404 含む）が同一 URL で `Klee One`（400;600）/ `Zen Kaku Gothic New`（400;500;700。**900 は未使用のため読み込まない**）を読み込む（旧 `Noto Sans JP` / `Space Grotesk` は廃止済み。`theme.css` 内の `@import` も廃止）。**読み込みは非同期 3 点セット**（`preload as="style"` → `media="print" onload="this.media='all'"` の stylesheet → `<noscript>` フォールバック）で、レンダーブロッキングを回避している。`preconnect`（fonts.googleapis.com / fonts.gstatic.com）の 2 行は各 HTML に残す。**新規ページ追加時はこの 3 点セットごとコピーする**。
  - `Klee One`（`--hand`）= 手書き風の見出し・ボタン・ロゴ
  - `Zen Kaku Gothic New`（`--font` / `--en`）= 本文・英字ラベル
- **Google Tag Manager（GTM）** — 全 18 ページの `<head>`（viewport 直後）に計測スニペット、`<body>` 直後に noscript 版を設置。コンテナ ID は `GTM-5DVGF39S`。**新規ページを追加するときは、この 2 スニペットを必ず同じ位置に入れる**（入れ忘れると計測が欠落する）。
- **メインランドマーク（`<main>`）** — 全 18 ページとも、本文を `<main>` で囲む（モバイルメニュー閉じ `</div>` の直後に `<main>`、`<footer class="site-footer">` の直前に `</main>`）。ナビ（`.site-nav`）・モバイルメニュー・フッターは `<main>` の**外**に置く（ランドマークを入れ子にしない）。**新規ページ追加時も必ず入れる**（無いと Lighthouse の「Document does not have a main landmark」で減点される）。`<main>` はブロック要素なので見た目は変わらない。
- GSAP / SplitType / ScrollTrigger などの外部ライブラリは **使用しない**（旧 `css/` `js/vendor/` は撤去済み。リビールは自前の `IntersectionObserver` で実装）。

## ページ一覧（18 ページ ＋ 404.html）

| ファイル | 役割 |
|---|---|
| `index.html` | トップページ — Hero / Service map / Problem / Services / Why us / Works / Process / Comparison / FAQ / 相談室（Blog）/ CTA |
| `about.html` | 私について（プロフィール詳細） |
| `services.html` | サービス紹介 |
| `aeo-geo.html` | AEO / GEO（生成AI最適化）解説ページ |
| `works.html` | 制作実績ギャラリー（現在の掲載は Original Products / Real Works（見本サイト）の 2 グループ。Practice Works は非掲載） |
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
| `404.html` | 404 エラーページ（GitHub Pages 用。`noindex`・sitemap 対象外・OGP なし。**共有ファイルはルート相対パス**（`/base.css` `/theme.css` `/theme.js`）で参照する — どの階層の URL でも表示されるため） |

ナビ／モバイルメニューのリンク構成は全ページ共通：私について（about）/ サービス（services）/ AEO・GEO（aeo-geo）/ 制作実績（works）/ 料金（pricing）/ よくある質問（faq）/ 相談室（blog/index.html）/ 無料で相談！（contact、CTA ボタン）。フッターはこれにプライバシーポリシー（privacy）と特定商取引法に基づく表記（tokushoho）を加えた構成。

## ディレクトリ構成

```
/
├─ index.html / about.html / services.html / aeo-geo.html / works.html /
│  pricing.html / faq.html / contact.html / privacy.html / tokushoho.html / 404.html
├─ files/
│   └─ linplan-services.pdf   サービス紹介PDF（A4・10p。services / contact に DL リンク）
├─ base.css               共通コンポーネント CSS ライブラリ（全ページ共有）
├─ theme.css              DS スキン（最後に読込して上書き。全ページ共有）
├─ theme.js               共通ナビ用スクリプト（全ページ共有）
├─ blog/
│   ├─ index.html          相談室（ブログ一覧）
│   └─ *.html              ブログ記事（hp-cost-2026 / how-to-order-website /
│                          aeo-vs-seo / wordpress-vs-original /
│                          sme-ai-search-ready / cited-by-chatgpt）
├─ CLAUDE.md
├─ sitemap.xml / robots.txt
├─ images/
│   ├─ *.webp             制作物・イラスト画像（studyreport / tsukimi / practice-* / hero-consult / profile 等。HTML はすべて WebP を参照）
│   └─ ogp.png            OGP 共有用（PNG 必須のため残す）
└─ 分析送信用/ + 分析送信用.zip   旧サイトの分析用アーカイブ（編集不要・サイト本体とは無関係）
```

## アーキテクチャ

各 HTML の `<head>` の読込順は **`base.css` → そのページ固有のインライン `<style>`（数ブロック）→ `theme.css`** で、この順序＝カスケードがデザインを決める。`theme.css` が最後なので、同詳細度なら `theme.css` が勝つ（旧スクラップブックを打ち消して DS の見た目を出す）。

- **共通コンポーネント（ナビ・モバイルメニュー・FAB・フッター・リビール・各種カード）の CSS は `base.css` に集約**。共通部分を直すときは `base.css` 1 ファイルだけ直せばよい（旧来の「18 ファイルにインライン重複」は解消済み）。最終的な見た目の調整・上書きは `theme.css`。
- **ページ固有の CSS だけ**を各 HTML のインライン `<style>` に残す（例：`pricing` のオプション表、`index` の hero／flow-step／menu、`blog` の記事本文スタイル）。
- **エントランスアニメーションはページの `<body>` 冒頭のインライン `<style>`**（ローダー `#lp-loader` は全ページ廃止済み）。トップは transition ＋ `.anim` クラス解除方式（ナビ・ヒーロー・About Me）、サブページは keyframes（`lpEnterNav`＝ナビ、`lpEnter`＝ページ見出し）で、いずれも「ナビが上から降り、見出しが下からフェードアップ」する同じ演出。
- `!important` は **`base.css` と `theme.css` 合わせて 2 個まで削減済み**（`.site-nav__cta` が高詳細度の `.site-nav__links a` を上書きする必要分のみ）。むやみに増やさない。

JS は各 HTML 末尾のインライン（依存なし・IIFE・`DOMContentLoaded` 後に起動。`prefers-reduced-motion` 尊重）＋ 共通の `theme.js`（ナビのスクロール状態）。

### CSS カスタムプロパティ（デザイントークン）

**トークンの「真実」は `theme.css` の `:root`**。`base.css` の `:root` にも同名トークンがあるが、後勝ちで `theme.css` が上書きするため、実際に効くのは `theme.css` の値（下記）。例外：`--ease` は `theme.css` に無く `base.css` の `:root` が供給する。

```
--ink:        #1F2838   /* 文字色（インク） */
--ink-soft:   #56607A
--paper:      #FDFBF5   /* クリーム紙 */
--orange:     #C24A33   /* メインアクセント＝テラコッタ */
--orange-deep:#A23A26
--on-accent:  #FDFBF5   /* アクセント上の文字色（ほぼ白） */
--yellow:     #B6926A   /* タン（フッター地など） */
--teal:       #6B6A40   /* オリーブ（サブアクセント） */
--font:  'Zen Kaku Gothic New'  /* 本文 */
--hand:  'Klee One'             /* 手書き風見出し・ボタン */
--en:    'Zen Kaku Gothic New'  /* 英字・ラベル */
--ease:  cubic-bezier(.2,.8,.2,1)   /* base.css 由来 */
--container: 1200px
```

背景は `body` に `#FDFBF5` ベース＋ radial-gradient のドットパターン（`theme.css` が `!important` で指定）。

印刷スタイル（`@media print`）は **`theme.css` 末尾**に配置（ナビ・FAB 等を非表示、`.reveal` を強制表示。カスケード最後の `theme.css` に置くことで `body` 背景の `!important` にも勝てる）。

### 共通コンポーネントパターン

- **エントランスアニメーション** — 全ページ共通（ローダーは廃止）。読み込み時にナビが上からフェードイン、ページ見出し（トップは `.lnhero__*`＋About Me、サブページは `.phero` / `.post-head` / `.blog-hero`）が下から時差フェードアップ。`prefers-reduced-motion` では無効。
- **ナビ（`.site-nav`）** — `position: fixed`。`theme.css` により **PC では中央寄せのフローティング「ピル」型ヘッダー（ロゴ＋テキストリンク）**、狭幅（≤1040px）ではロゴ＋ハンバーガー（`.hamburger`）に切り替わる。スクロール状態は `.scrolled`（インライン JS）と `.past-hero`（共通 `theme.js`）で管理。`.site-nav__cta` の文字色（クリーム）と本文フォントは `base.css` / `theme.css` 双方の `!important` で確定（高詳細度の `.site-nav__links a` を上書きするため）。
- **モバイルメニュー（`.mobile-menu`）** — 全画面オーバーレイ。ハンバーガーで開閉し、リンク／× ／ Esc で閉じる。
- **フローティング Contact ボタン（`.fab`）** — 右下に fixed。ヒーローを抜けると `.is-revealed` で出現。
- **フッター（`.site-footer`）** — ロゴ＋タグライン＋ナビ＋連絡先。
- **リビールアニメーション** — `.reveal` 要素が `IntersectionObserver`（閾値 12%）で `.is-visible` を取得しフェードイン。`.reveal-d1` / `.reveal-d2` でディレイ。
- **スクラップブック装飾は `theme.css` が打ち消し済み** — `base.css` には旧 V4 の washi テープ（`.tape`）／紙シート／押しピン／blob／ポラロイド傾けの定義が残っているが、`theme.css` がこれらを無効化（`display:none` やフラット化）し、**フラットなクリーム紙カード**として描画する。装飾を復活させたい場合は `theme.css` 側の打ち消しを外す。
- **ポラロイド / ブラウザフレーム** — Works の作品カード（`theme.css` で傾きを除去しフラット化）。`.polaroid__shot` / `.browser__shot` はスクロール可能で、`scroll-hint` バッジを JS で付与する。

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

`blog/` 配下が「中小企業のHP・IT・AI 相談室」。`blog/index.html` が記事一覧、`blog/hp-cost-2026.html` 以降が個別記事。デザイン・共通コンポーネントはルートのページと同一だが、共有ファイルは **`../base.css` / `../theme.css` / `../theme.js`**（1 階層上）で参照する。記事固有の本文スタイルは各記事の HTML 内インライン `<style>` に持つ。

- **リンクは相対パスで書く** — `blog/` 配下からルートのページへは、ルート相対ではなく `../about.html` `../contact.html` のような相対パスでリンクする（ブログ内の相互リンクは `index.html` / `hp-cost-2026.html` のようにファイル名のみ）。
- **記事を追加したら次の 3 箇所を必ず更新する**：
  1. `blog/index.html` の記事一覧にカードを追加
  2. `index.html`（トップ）の相談室セクション — `.blog-grid` のカードを更新（「近日公開」プレースホルダーがあれば実記事に差し替える）
  3. `sitemap.xml` に記事の URL を追加
- 記事ページには OGP / canonical / GTM の共通一式に加え、JSON-LD（`Article`。FAQ を含む記事は `FAQPage` も）を入れる。`hp-cost-2026.html` が雛形。

## 画像の取り扱い

- HTML から参照しているのは `images/*.webp` のみ（`index.html` / `works.html` の作品画像、`index.html` / `about.html` のヒーロー・プロフィールイラスト）。
- `ogp.png` は OGP / Twitter Card 用に残す（PNG 必須のクライアントが存在するため）。
- 新規画像は WebP に変換し、`loading="lazy"` `decoding="async"` を付ける。
- ファビコンは各ページとも data-URI の SVG（外部ファイル不要）。

## SEO / sitemap

- `sitemap.xml` / `robots.txt` はリポジトリルートに配置。新規ページ追加・削除時は `sitemap.xml` の `<urlset>` も更新する。ベース URL は `https://linplan.jp/`。
- 全 18 ページの `<head>`（`<title>` 直後）に **OGP / Twitter Card / canonical** メタを設置済み。`og:image` / `twitter:image` は `https://linplan.jp/images/ogp.png`（絶対 URL）、`og:url` / canonical はページごとの絶対 URL。**新規ページ追加時は同じ一式を入れる**（`og:title` / `og:description` / URL をそのページ用に差し替える）。
- JSON-LD 構造化データは**主要ページに設置済み**：`index.html`（`ProfessionalService`＋`Person`）／ `about.html`（`AboutPage`＋`Person`）／ `services.html`（`Service`×3）／ `contact.html`（`ContactPage`）／ `faq.html`（`FAQPage`＝ページ上の全 FAQ と同期）／ works・pricing・aeo-geo・about・services・contact・faq（`BreadcrumbList`）／ ブログ記事（`Article`、FAQ を含む記事は `FAQPage` も）。**構造化データは該当ページの表示コンテンツと必ず同期させる**（FAQ を増減したら `faq.html` の JSON-LD も更新する）。
