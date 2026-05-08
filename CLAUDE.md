# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

（以下、リポジトリ内のコードを扱う際のガイダンス）

## 概要

日本語の Web デザイン・アプリ・AI 制作スタジオ「LinPlan」のポートフォリオサイト。静的 HTML を中心に構成され、ビルドツールやパッケージマネージャーは利用しない。CSS / JS は一部外部化され、サードパーティライブラリ（GSAP / SplitType）はローカルにバンドルしてある。

## 動作確認

ビルド・テスト・lint コマンドは存在しない。各 HTML ファイルをブラウザで直接開いて（`file://` スキーム、または任意のローカルサーバー経由で）確認する。フォントは Google Fonts を CDN 経由で読み込むため、確認にはインターネット接続が必要。GSAP / SplitType 等のアニメーションライブラリは `js/vendor/` にバンドル済みのためオフラインでも動作する。

## 外部依存

- **Google Fonts** — 5 ページすべてが `fonts.googleapis.com` を CDN 経由で読み込む。オフライン環境ではフォールバックフォントで表示される。
- 主要書体は `Noto Sans JP` / `Inter` / `Space Grotesk`。`index.html` 等では装飾用に `Klee One` を追加で読み込むページもある（差分はページごとに `<link rel="stylesheet">` を確認）。

## レスポンシブブレークポイント

- `768px` — ナビ／ヒーロー等のメインレイアウト切替。ハンバーガーメニューへの切替もこのポイント。
- `900px` — Contact フォーム、FAB 周り。
- `600px` — 細部調整。

## ページ一覧

| ファイル | 役割 |
|---|---|
| `index.html` | トップページ — Hero / Problem / Solution / Why us / Process / Pricing / FAQ / CTA / Works / About 短縮版 |
| `about.html` | 私について（プロフィール詳細） |
| `aeo-geo.html` | AEO / GEO（生成AI最適化）解説ページ |
| `ai-service.html` | AI 業務自動化サービスのランディングページ（独自の Pricing セクションあり） |
| `contact.html` | お問い合わせフォームページ |

## ディレクトリ構成

```
/
├─ index.html / about.html / aeo-geo.html / ai-service.html / contact.html
├─ CLAUDE.md
├─ sitemap.xml / robots.txt
├─ css/
│   └─ common.css         共通スタイル（外部化済み）
├─ js/
│   ├─ common.js          共通スクリプト（ナビ・モバイルメニュー・FAB・フッター・リビール等）
│   └─ vendor/            ローカルバンドル
│       ├─ gsap.min.js
│       ├─ ScrollTrigger.min.js
│       └─ split-type.min.js
├─ images/
│   ├─ *.webp             制作物画像（軽量化済み、HTML はすべて WebP を参照）
│   └─ ogp.png            OGP 共有用
└─ 分析/                  分析レポート保管（編集不要）
```

## アーキテクチャ

各 HTML ファイルは概ね自己完結しているが、**共通 CSS（`css/common.css`）と共通 JS（`js/common.js`）に切り出された部分**がある。ページ固有の CSS / JS は依然として `<head>` 内の `<style>` ブロックや `</body>` 直前の `<script>` ブロックに残っている。

GSAP / SplitType / ScrollTrigger は `js/vendor/` にバンドルしてあり、各ページ `<head>` 内で `<script defer>` として読み込んでいる。CDN 依存はしない。

JavaScript が無効な環境への備えとして、`<html class="no-js">` を初期付与し、JS 起動時に `js` クラスへ置換する `no-js` フォールバックパターンを採用している。

### CSS カスタムプロパティ（デザイントークン）

各ページが独自の `:root` 変数を宣言している。主要な値はページ間で統一されているが、`ai-service.html` にはアクセント系の追加変数がある。

```
--dark: #32373c        /* Contact ボタン背景などに使用 */
--accent: #3ba297      /* ティール — メインブランドカラー */
--font: 'Noto Sans JP'
--font-en: 'Inter' / 'Space Grotesk'
--ease: cubic-bezier(0.16, 1, 0.3, 1)
--container: 1080px    /* ai-service.html のみ 1120px */
```

### 共通コンポーネントパターン

5 ページすべてが同じ共通コンポーネントを実装している。新規ページを追加する際は既存ページから CSS/JS をコピーすること。

- **ナビゲーション** — fixed 配置、スクロールで `.scrolled` クラスが付与されフロストグラス化。レイアウトは「左リンク | 中央ロゴ | 右リンク」。`index.html` / `about.html` / `aeo-geo.html` / `contact.html` は `.nav-links-left` + `.nav-links-right` 構成で `.nav-contact-link` を使用。`ai-service.html` のみ `.nav-links` 単一構成で `.nav-contact-btn` を使用。
- **モバイルメニュー** — `#mobileMenu` オーバーレイを `toggleMenu()` で開閉。ハンバーガーは `<span>` 3 つで構成。
- **フローティング Contact ボタン** — `.fab-contact`、右下に fixed 配置。フッターが開いている間は非表示。
- **フッター** — `clip-path` アニメーションで下から展開するパネル。状態は「閉じている / `auto_open`（スクロール到達で自動展開）/ `open`（手動クリック）」の 3 種。手動展開時はバックドロップオーバーレイが表示される。
- **リビールアニメーション** — `.reveal` 要素が `IntersectionObserver`（閾値 12%）で `.visible` クラスを取得してフェードインする。`prefers-reduced-motion` を尊重。

### フッターのトグル動作

フッターは `clip-path: inset(...)` によって下からスライドアップする。ページ最下部までスクロールすると自動展開し、上にスクロールすると閉じる。手動の開閉は `.open` クラスとバックドロップで管理。FAB Contact ボタンは CSS の兄弟セレクタ `~ .fab-contact` によってフッター展開中に自動で非表示になる。

## お問い合わせフォームはスタブ実装

`contact.html` の submit ハンドラは `e.preventDefault()` の後にアラートを出すだけで、バックエンド送信処理は存在しない。本番運用で実際に送信させる場合はこの部分に EmailJS / Formspree / mailto: / 独自 API などの接続ロジックを追加する。連絡先のメールアドレス・電話番号は実値（`tsubochihiroyama2230@gmail.com` / `tel:+818029373646`）が入っている。

## Works セクションの 3 カテゴリ運用ルール（重要）

`index.html` の Works セクションは **Original Products / Real Works / Practice Works** の 3 カテゴリで運用する。これは法令面（景表法・不正競争防止法・著作権・商標）とブランド面の両方を守るための運用ルール。

| カテゴリ | 内容 | 表記ルール |
|---|---|---|
| **Original Products** | 自社プロダクト（StudyReport / Tsukimi 等） | 自分が企画・実装したものに限る |
| **Real Works** | クライアント案件（実案件） | 現状はプレースホルダー枠のみ。知人 HP・見本制作で順次埋めていく |
| **Practice Works** | 模写・学習作品 | **実在企業名・サービス名は使用しない**。業種ベースのラベル（例：「Hospitality 模写サイト」「Medical 模写サイト」）で表示する |

### 禁止事項

- Practice Works に実在企業名（例：「福山臨床」「monoshop」「rbrain」など）を入れない。`alt` 属性も同様。
- Practice Works を「制作実績」「公式サイト」と表記しない。「模写サイト」「学習作品」と明示する。
- Real Works に模写を混ぜない。空でもプレースホルダー枠を残し、「準備中」と明示する。

### 案件追加時の流れ

実案件が発生したら Practice Works の該当カードを Real Works 側に移し、内容を実案件向けに書き換える。Practice 側はそのまま追加・更新を続けても良いが、Real が増えるにつれて Practice の比重を下げていく方向で運用する。

## 5 ページ間の同期に注意

ナビゲーション、モバイルメニュー、FAB Contact、フッター、リビール処理は 5 つの HTML ファイル全てに重複してインラインで定義されている部分がある（共通化されたものは `css/common.css` / `js/common.js` 経由）。インラインで残っているコンポーネントを変更する場合、他 4 ファイルにも同じ変更を反映する必要がある。特に以下の差異に注意：

- **ナビ Contact ボタン** — `index.html` / `about.html` / `aeo-geo.html` / `contact.html` は `.nav-contact-link`、`ai-service.html` は `.nav-links .nav-contact-btn`。マークアップもクラス名も異なる。
- **`#pricing` リンクの参照先** — `index.html` / `ai-service.html` はページ内 `#pricing`（自ページの料金セクションへ）、それ以外のページは `index.html#pricing`（トップの料金セクションへ）。
- **`--container` 幅** — 通常 `1080px`、`ai-service.html` のみ `1120px`。
- **追加アクセント変数** — `ai-service.html` の `:root` にはランディングページ固有の変数が追加されている。

## 画像の取り扱い

- HTML から参照しているのは `images/*.webp` のみ。既存の `*.png`（airbnb / fukuyamarinshou / monoshop / rbrain 等）は WebP 化前の旧版で、HTML 上は未参照。容量を圧迫しているため、確認のうえ削除して問題ない。
- `ogp.png` のみ OGP / Twitter Card で使用するため残す（PNG 必須のクライアントが存在するため）。
- 新規画像追加時は WebP に変換し、`loading="lazy"` `decoding="async"` を付ける。

## 構造化データ・SEO

- `index.html` には `Organization` / `Service` / `FAQPage` の JSON-LD が埋め込まれている。FAQ 文言を変更するときは JSON-LD 側も同期する。
- `sitemap.xml` / `robots.txt` はリポジトリルートに配置済み。新規ページ追加時は `sitemap.xml` の `<urlset>` も更新する。
