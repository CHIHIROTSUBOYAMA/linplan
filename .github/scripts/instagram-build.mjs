// Instagram 投稿を取得して index.html の「最新のお知らせ」欄を更新する
// GitHub Actions から毎日実行。取得に失敗した場合は index.html を変更しない。
import fs from "node:fs";
import path from "node:path";

const TOKEN = process.env.IG_ACCESS_TOKEN;
const LIMIT = Number(process.env.IG_LIMIT || 6);          // トップに出す件数
const ACCOUNT_URL = "https://www.instagram.com/linplan.wb/";
const ROOT = process.cwd();
const INDEX = path.join(ROOT, "index.html");
const IMG_DIR = path.join(ROOT, "insta");
const START = "<!-- INSTA:START -->";
const END = "<!-- INSTA:END -->";

function fail(msg) { console.error("✗ " + msg); process.exit(1); }
if (!TOKEN) fail("IG_ACCESS_TOKEN が設定されていません（リポジトリの Secrets を確認）");

const html = fs.readFileSync(INDEX, "utf8");
const s = html.indexOf(START), e = html.indexOf(END);
if (s < 0 || e < 0 || e < s) fail("index.html に INSTA:START / INSTA:END のマーカーがありません");

// ---- 1. 取得 ----
const fields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp";
const res = await fetch(`https://graph.instagram.com/me/media?fields=${fields}&limit=${LIMIT + 4}&access_token=${TOKEN}`);
const json = await res.json();
if (json.error) {
  fail(`APIエラー: ${json.error.message}` + (json.error.code === 190 ? "（トークン期限切れ・無効）" : ""));
}
const items = json.data ?? [];   // 画像取得に失敗しても LIMIT 件埋まるよう予備を多めに取得
console.log(`✓ ${items.length} 件取得`);

// ---- 2. 整形 ----
const esc = (t = "") => t.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const jst = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
const fmtDate = d => jst.format(new Date(d)).replace(/\//g, ".");
function title(caption = "") {
  const body = caption.replace(/#[^\s#]+/g, "").trim();
  const first = (body.split("\n").find(l => l.trim()) || "").trim();
  return first.length > 40 ? first.slice(0, 40) + "…" : first;
}

// ---- 3. 画像を保存（media_url は期限付きのため必ずローカル化） ----
fs.mkdirSync(IMG_DIR, { recursive: true });
const posts = [];
for (const p of items) {
  if (posts.length >= LIMIT) break;
  const src = p.media_type === "VIDEO" ? p.thumbnail_url : p.media_url;
  const file = `${p.id}.jpg`;
  const dest = path.join(IMG_DIR, file);
  if (!fs.existsSync(dest) && src) {               // 保存済みなら再取得しない
    const r = await fetch(src);
    if (!r.ok) { console.warn(`  ✗ 画像取得失敗 ${p.id}（HTTP ${r.status}）→ この投稿はスキップ`); continue; }
    fs.writeFileSync(dest, Buffer.from(await r.arrayBuffer()));
    console.log(`  ✓ 画像保存 ${file}`);
  }
  if (!fs.existsSync(dest)) continue;
  posts.push({ id: p.id, title: title(p.caption), caption: p.caption ?? "", image: `insta/${file}`,
               permalink: p.permalink, date: p.timestamp, type: p.media_type });
}

// 表示しなくなった古い画像を削除（リポジトリの肥大化防止）
const keep = new Set(posts.map(p => `${p.id}.jpg`));
for (const f of fs.readdirSync(IMG_DIR)) {
  if (f.endsWith(".jpg") && !keep.has(f)) { fs.unlinkSync(path.join(IMG_DIR, f)); console.log(`  - 古い画像を削除 ${f}`); }
}
// AI記事化（次の工程）で使うためデータも残す
fs.writeFileSync(path.join(IMG_DIR, "posts.json"), JSON.stringify(posts, null, 2) + "\n", "utf8");

// ---- 4. HTML 生成（投稿0件ならセクションごと非表示） ----
const delay = i => ["", " reveal-d1", " reveal-d2"][i % 3];
const cards = posts.map((p, i) => `      <a href="${esc(p.permalink)}" class="insta-card reveal${delay(i)}" target="_blank" rel="noopener">
        <img src="${p.image}" alt="${esc(p.title)}" loading="lazy" decoding="async">
        <div class="insta-card__body">
          <time datetime="${esc(p.date)}">${fmtDate(p.date)}</time>
          <h3 class="insta-card__title">${esc(p.title)}</h3>
        </div>
      </a>`).join("\n");

const block = posts.length === 0 ? "" : `
<section class="section section--white insta-feed">
  <div class="container">
    <div class="section__head reveal">
      <span class="eyebrow">Instagram</span>
      <h2>最新のお知らせ</h2>
      <p class="section__desc">Instagramで発信している最新の情報です。</p>
    </div>
    <div class="insta-grid">
${cards}
    </div>
    <div style="text-align:center;margin-top:36px" class="reveal"><a href="${ACCOUNT_URL}" class="btn btn--ghost hand" target="_blank" rel="noopener">Instagramを見る</a></div>
  </div>
</section>
`;

const next = html.slice(0, s + START.length) + block + html.slice(e);
if (next === html) { console.log("✓ 変更なし"); }
else { fs.writeFileSync(INDEX, next, "utf8"); console.log(`✓ index.html を更新（${posts.length} 件）`); }
