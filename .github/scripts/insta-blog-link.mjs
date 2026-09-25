// Instagram の投稿と、それに対応するブログ記事を結びつける（instagram-build / instagram-to-blog で共用）
// ・本文に「linplan.jp/blog/<slug>.html」と書いた投稿 ＝ ブログ記事の告知投稿
// ・blog/insta-articles.json に載っている投稿 ＝ AI で記事化済みの投稿
import fs from "node:fs";
import path from "node:path";

const URL_RE = /linplan\.jp\/blog\/([a-z0-9-]+)(?:\.html)?/i;

// 本文に書かれたブログ記事の slug（書かれていなければ null）
export function linkedSlug(caption = "") {
  const m = String(caption).match(URL_RE);
  return m ? m[1].toLowerCase() : null;
}

// 投稿に対応する公開済みブログ記事の slug（記事ファイルが無ければ null＝Instagram へリンク）
export function blogSlugFor(post, root, registry = {}) {
  const slug = linkedSlug(post.caption) || registry[post.id] || null;
  return slug && fs.existsSync(path.join(root, "blog", `${slug}.html`)) ? slug : null;
}
