# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

（以下、リポジトリ内のコードを扱う際のガイダンス）

## 概要

日本語の Web デザイン・アプリ・AI 制作スタジオ「LinPlan」のポートフォリオサイト。静的 HTML のみで構成され、ビルドツールやパッケージマネージャーは利用しない。現在のデザインは **V4「スクラップブック」デザインシステム**（紙＋ washi テープの質感、手書き風見出し、ドット背景）。各ページは **完全に自己完結**しており、CSS / JS はすべて各 HTML ファイル内にインラインで持つ（共通の外部 CSS / JS ファイルや外部アニメーションライブラリには依存しない）。

## 動作確認

ビルド・テスト・lint コマンドは存在しない。各 HTML ファイルをブラウザで直接開いて（`file://` スキーム、または任意のローカルサーバー経由で）確認する。フォントは Google Fonts を CDN 経由で読み込むため、確認にはインターネット接続が必要（オフラインではフォールバックフォントになる）。アニメーション・スクリプトはすべてインラインの vanilla JS なので、フォント以外の外部依存はない。

## 外部依存

- **Google Fonts のみ** — 全 9 ページが同一の `<link>` で `Klee One` / `Noto Sans JP` / `Space Grotesk` を読み込む。
  - `Klee One`（`--hand`）= 手書き風の見出し・ボタン・ロゴ
  - `Noto Sans JP`（`--font`）= 本文
  - `Space Grotesk`（`--en`）= 英字・ラベル
- GSAP / SplitType / ScrollTrigger などの外部ライブラリは **使用しない**（旧デザインの名残として `js/vendor/` が残っているが、現行ページからは一切参照していない。後述「レガシー」参照）。

## ページ一覧（9 ページ）

| ファイル | 役割 |
|---|---|
| `index.html` | トップページ — Hero / Problem / Why us / Service map / Works / Process / FAQ / CTA |
| `about.html` | 私について（プロフィール詳細） |
| `services.html` | サービス紹介 |
| `aeo-geo.html` | AEO / GEO（生成AI最適化）解説ページ |
| `works.html` | 制作実績ギャラリー（Original Products / Real Works / Practice Works） |
| `pricing.html` | 料金プラン |
| `faq.html` | よくあるご質問 |
| `contact.html` | お問い合わせフォームページ |
| `privacy.html` | プライバシーポリシー |

ナビ／フッターのリンク構成は全ページ共通：私について（about）/ サービス（services）/ AEO・GEO（aeo-geo）/ 制作実績（works）/ よくある質問（faq）/ お問い合わせ（contact）/ プライバシーポリシー（privacy）。`pricing.html` は各ページの CTA / サービス導線からリンクされる。

## ディレクトリ構成

```
/
├─ index.html / about.html / services.html / aeo-geo.html / works.html /
│  pricing.html / faq.html / contact.html / privacy.html
├─ CLAUDE.md
├─ sitemap.xml / robots.txt
├─ images/
│   ├─ *.webp             制作物画像（studyreport / tsukimi / practice-* 等。HTML はすべて WebP を参照）
│   └─ ogp.png            OGP 共有用（PNG 必須のため残す）
├─ 分析送信用/ + 分析送信用.zip   旧サイトの分析用アーカイブ（編集不要・サイト本体とは無関係）
└─ （レガシー）css/ ・ js/        旧デザインの外部 CSS / vendor ライブラリ。現行ページは未参照。削除可。
```

## アーキテクチャ

各 HTML ファイルは完全自己完結。`<head>` 内の `<style>` ブロックにそのページの全 CSS を、`</body>` 直前の `<script>` ブロックに全 JS を持つ。共通コンポーネント（ナビ・モバイルメニュー・FAB・フッター・ローダー・リビール）は **9 ファイルすべてにインラインで重複**している。共通部分を変更する場合は全ページに同じ変更を反映する必要がある。

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

## お問い合わせフォームはスタブ実装

`contact.html` の submit ハンドラ（`#contactForm`）は `e.preventDefault()` するだけで、バックエンド送信処理は存在しない。URL パラメータ（`?plan=` / `?items=` 等）からプラン選択や本文の「気になっている点」をプレフィルする機能はある。本番で実送信させる場合は EmailJS / Formspree / mailto: / 独自 API 等の接続を追加する。連絡先メールは実値（`tsubochihiroyama2230@gmail.com`、本文中およびページ内に mailto: リンクあり）。

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

## 画像の取り扱い

- HTML から参照しているのは `images/*.webp` のみ（`index.html` / `works.html` の作品画像）。
- `ogp.png` は OGP / Twitter Card 用に残す（PNG 必須のクライアントが存在するため）。
- 新規画像は WebP に変換し、`loading="lazy"` `decoding="async"` を付ける。
- ファビコンは各ページとも data-URI の SVG（外部ファイル不要）。

## SEO / sitemap

- `sitemap.xml` / `robots.txt` はリポジトリルートに配置。新規ページ追加・削除時は `sitemap.xml` の `<urlset>` も更新する。
- 現行 `index.html` には JSON-LD 構造化データは入っていない（FAQ は `faq.html` に分離）。構造化データを追加する場合は該当ページのコンテンツと同期させる。
