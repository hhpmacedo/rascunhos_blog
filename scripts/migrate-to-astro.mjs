import { readFile, readdir, writeFile } from "node:fs/promises";
import TurndownService from "turndown";

const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
// <br> -> hard line break (trailing backslash)
td.addRule("hardbreak", { filter: "br", replacement: () => "\\\n" });
// <p class="asterism">⁂</p> -> thematic break (rehypeAsterism turns it back into the asterism)
td.addRule("asterism", {
  filter: (n) => n.nodeName === "P" && n.getAttribute("class") === "asterism",
  replacement: () => "\n\n---\n\n",
});
// PRESERVE raw WordPress HTML blocks (code blocks with <mark>, etc.) verbatim -
// turndown would otherwise mangle <pre class="wp-block-code"> / <mark> and lose fidelity.
td.keep(["pre", "mark"]);

async function excerptMap() {
  const map = {};
  const pages = await readdir("site/page").catch(() => []);
  const files = ["site/index.html", ...pages.map((f) => `site/page/${f}`)];
  for (const f of files) {
    const html = await readFile(f, "utf8").catch(() => "");
    // 1. Full excerpt: <p class="post-excerpt[-featured]"> ... <a class="read-more">
    //    The h2 anchor may be multi-line (Prettier-formatted)
    const reExcerpt = /<a\s+href="[^"]*\/?posts\/([^"]+)\.html"[\s\S]*?<\/a\s*>\s*<\/h2>\s*<p class="post-(?:excerpt|excerpt-featured)">\s*([\s\S]*?)\s*<a[^>]+class="read-more"/g;
    let m;
    while ((m = reExcerpt.exec(html))) {
      map[m[1]] = m[2].replace(/\s+/g, " ").trim();
    }
    // 2. Archive-line: each <li> contains <a href="...posts/<slug>.html"> and
    //    <span class="archive-line">text</span>; extract them together from each <li>
    const reLi = /<li[^>]*>([\s\S]*?)<\/li>/g;
    while ((m = reLi.exec(html))) {
      const liHtml = m[1];
      const slugM = liHtml.match(/href="[^"]*\/?posts\/([^"]+)\.html"/);
      const lineM = liHtml.match(/<span\s+class="archive-line"[\s\S]*?>([\s\S]*?)<\/span/);
      if (slugM && lineM && !map[slugM[1]]) {
        map[slugM[1]] = lineM[1].replace(/\s+/g, " ").trim();
      }
    }
  }
  return map;
}

const yamlStr = (s) => JSON.stringify(s);
const excerpts = await excerptMap();
const dir = "site/posts";
for (const file of (await readdir(dir)).filter((f) => f.endsWith(".html"))) {
  const slug = file.replace(/\.html$/, "");
  const html = await readFile(`${dir}/${file}`, "utf8");
  const title = (html.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1]?.trim() ?? slug;
  const date = (html.match(/data-date="([^"]+)"/) || [])[1] ?? "";
  let body = (html.match(/<article[^>]*>([\s\S]*?)<\/article>/) || [])[1] ?? "";
  body = body
    .replace(/<h1>[\s\S]*?<\/h1>/, "")
    .replace(/<p class="post-end">[\s\S]*?<\/p>/g, "")
    .replace(/<nav class="post-nav">[\s\S]*?<\/nav>/g, "")
    .replace(/<div class="post-subscribe">[\s\S]*?<\/div>/g, "")
;
  let md = td.turndown(body);
  // A trailing backslash at the end of a paragraph (before blank line or end of string)
  // doesn't render as <br> in CommonMark — convert to raw HTML <br> so it round-trips.
  md = md.replace(/\\\s*(\n\n|\n$|$)/g, "<br>\n$1");
  md = md.replace(/\n{3,}/g, "\n\n").trim();
  const fm = ["---", `title: ${yamlStr(title)}`, `pubDate: ${date}`,
    excerpts[slug] ? `excerpt: ${yamlStr(excerpts[slug])}` : null, "---", ""]
    .filter((x) => x !== null).join("\n");
  await writeFile(`src/content/posts/${slug}.md`, `${fm}\n${md}\n`);
  console.log(`wrote ${slug}.md`);
}
