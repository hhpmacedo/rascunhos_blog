// Compares Astro-built post HTML against the live site/ HTML, body text only.
// Usage: node scripts/rendered-html-gate.mjs <slug> [<slug> ...]
import { readFile } from "node:fs/promises";

const norm = (html) =>
  html.replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/\s+/g, " ").trim();

const articleBody = (html) => {
  const m = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
  return m ? norm(m[1].replace(/<h1[\s\S]*?<\/h1>/, "")) : null;
};

const builtPath = async (slug) => {
  for (const p of [
    `.vercel/output/static/posts/${slug}.html/index.html`,
    `.vercel/output/static/posts/${slug}.html`,
    `dist/posts/${slug}.html/index.html`,
    `dist/posts/${slug}.html`,
  ]) { try { return await readFile(p, "utf8"); } catch {} }
  return null;
};

let fail = 0;
for (const slug of process.argv.slice(2)) {
  const live = await readFile(`site/posts/${slug}.html`, "utf8");
  const built = await builtPath(slug);
  const a = articleBody(live), b = built && articleBody(built);
  if (b && a && b.startsWith(a)) console.log(`OK   ${slug}`);
  else { console.log(`DIFF ${slug}`); fail++; }
}
process.exit(fail ? 1 : 0);
