# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

（以下、リポジトリ内のコードを扱う際のガイダンス）

## 概要

日本語の Web デザイン・アプリ制作スタジオ向け静的 HTML ポートフォリオサイト。ビルドツール・パッケージマネージャー・フレームワークは一切なく、HTML ファイルをブラウザで直接開いて確認する。

## 動作確認

ビルド・テスト・lint コマンドは存在しない。ローカルサーバーも不要で、各 HTML ファイルをブラウザで直接開いて（`file://` スキーム）確認する。フォントは Google Fonts を CDN 経由で読み込むため、確認にはインターネット接続が必要。

## 外部依存

- **Google Fonts** — 3 ページすべてが `fonts.googleapis.com` を CDN 経由で読み込む。オフライン環境ではフォールバックフォントで表示される。
- `index.html` のみ追加で `Zen Kaku Gothic New` を読み込む。`contact.html` / `ai-service.html` は `Noto Sans JP` + `Inter` のみ。

## レスポンシブブレークポイント

- `768px` — ナビ／ヒーロー等のメインレイアウト切替。ハンバーガーメニューへの切替もこのポイント。
- `900px` — Contact フォーム、FAB 周り。
- `600px` — 細部調整。

## ページ一覧

| ファイル | 役割 |
|---|---|
| `index.html` | トップページ — Hero・About・Works・Service セクション |
| `contact.html` | お問い合わせフォームページ |
| `ai-service.html` | AI 業務自動化サービスのランディングページ |

## アーキテクチャ

各 HTML ファイルは完全に自己完結している。CSS はすべて `<head>` 内の `<style>` ブロックに、JavaScript は `</body>` 直前の `<script>` ブロックに記述されており、外部 `.css` / `.js` ファイルは存在しない。

### CSS カスタムプロパティ（デザイントークン）

各ページが独自の `:root` 変数を宣言している。主要な値はページ間で統一されているが、`ai-service.html` にはアクセント系の追加変数がある。

```
--dark: #32373c        /* Contact ボタン背景などに使用 */
--accent: #3ba297      /* ティール — メインブランドカラー */
--font: 'Zen Kaku Gothic New' / 'Noto Sans JP'
--font-en: 'Inter'
--ease: cubic-bezier(0.16, 1, 0.3, 1)
--container: 1080px    /* ai-service.html のみ 1120px */
```

### 共通コンポーネントパターン

3 ページすべてが同じコンポーネントを実装している。新規ページを追加する際は既存ページから CSS/JS をコピーすること。

- **ナビゲーション** — fixed 配置、スクロールで `.scrolled` クラスが付与されフロストグラス化。レイアウトは「左リンク | 中央ロゴ | 右リンク」。`index.html` / `contact.html` は `.nav-contact-link`、`ai-service.html` は `.nav-links .nav-contact-btn` を使用。
- **モバイルメニュー** — `#mobileMenu` オーバーレイを `toggleMenu()` で開閉。ハンバーガーは `<span>` 3 つで構成。
- **フローティング Contact ボタン** — `.fab-contact`、右下に fixed 配置。フッターが開いている間は非表示。
- **フッター** — `clip-path` アニメーションで下から展開するパネル。状態は「閉じている / `auto_open`（スクロール到達で自動展開）/ `open`（手動クリック）」の 3 種。手動展開時はバックドロップオーバーレイが表示される。
- **リビールアニメーション** — `.reveal` 要素が `IntersectionObserver`（閾値 12%）で `.visible` クラスを取得してフェードインする。

### フッターのトグル動作

フッターは `clip-path: inset(...)` によって下からスライドアップする。ページ最下部までスクロールすると自動展開し、上にスクロールすると閉じる。手動の開閉は `.open` クラスとバックドロップで管理。FAB Contact ボタンは CSS の兄弟セレクタ `~ .fab-contact` によってフッター展開中に自動で非表示になる。

## お問い合わせフォームはスタブ実装

`contact.html:576` の submit ハンドラは `e.preventDefault()` の後に `alert('送信ありがとうございます！')` を出すだけで、バックエンド送信処理は存在しない。本番運用で実際に送信させる場合はこの部分に EmailJS / Formspree / mailto: / 独自 API などの接続ロジックを追加する。フッターの `address` タグ内のメールアドレス（`footer-address` 要素、例: `your-email@example.com`）もプレースホルダーなので併せて差し替える。

## 3 ページ間の同期に注意

ナビゲーション、モバイルメニュー、FAB Contact、フッター、リビール処理は 3 つの HTML ファイル全てに重複してインラインで定義されている。いずれかのコンポーネントを変更する場合、他 2 ファイルにも同じ変更を反映する必要がある。特に以下の差異に注意：

- **ナビ Contact ボタン** — `index.html` / `contact.html` は `.nav-contact-link`、`ai-service.html` は `.nav-links .nav-contact-btn`。マークアップもクラス名も異なる。
- **`--container` 幅** — 通常 `1080px`、`ai-service.html` のみ `1120px`。
- **追加アクセント変数** — `ai-service.html` の `:root` にはランディングページ固有の変数が追加されている。
