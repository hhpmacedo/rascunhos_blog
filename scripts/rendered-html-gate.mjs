// Compares Astro-built post HTML against the live site/ HTML, body text only.
// Usage: node scripts/rendered-html-gate.mjs <slug> [<slug> ...]
import { readFile } from "node:fs/promises";

/** Decode common HTML entities and collapse whitespace for text comparison */
const norm = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Extract the raw article body HTML (excluding h1) */
const articleBodyRaw = (html) => {
  const m = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
  return m ? m[1].replace(/<h1[\s\S]*?<\/h1>/, "") : null;
};

/** Count occurrences of a string in another string */
const countOccurrences = (haystack, needle) => {
  let count = 0;
  let pos = 0;
  while ((pos = haystack.indexOf(needle, pos)) !== -1) {
    count++;
    pos += needle.length;
  }
  return count;
};

/** Extract all href values from a href="..." within an HTML string */
const extractHrefs = (html) => {
  const hrefs = [];
  const re = /<a\s[^>]*href="([^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    hrefs.push(m[1]);
  }
  return hrefs;
};

const builtPath = async (slug) => {
  for (const p of [
    `.vercel/output/static/posts/${slug}.html/index.html`,
    `.vercel/output/static/posts/${slug}.html`,
    `dist/posts/${slug}.html/index.html`,
    `dist/posts/${slug}.html`,
  ]) {
    try {
      return await readFile(p, "utf8");
    } catch {}
  }
  return null;
};

let fail = 0;
for (const slug of process.argv.slice(2)) {
  const live = await readFile(`site/posts/${slug}.html`, "utf8");
  const built = await builtPath(slug);

  if (!built) {
    console.log(`DIFF ${slug}: built file not found`);
    fail++;
    continue;
  }

  const liveRaw = articleBodyRaw(live);
  const builtRaw = articleBodyRaw(built);

  if (!liveRaw || !builtRaw) {
    console.log(`DIFF ${slug}: could not extract article body`);
    fail++;
    continue;
  }

  const liveNorm = norm(liveRaw);
  const builtNorm = norm(builtRaw);

  // 1. Text prefix check: built must start with live normalised text
  if (!builtNorm.startsWith(liveNorm)) {
    let i = 0;
    while (i < liveNorm.length && liveNorm[i] === builtNorm[i]) i++;
    const ctx = (s, idx) =>
      JSON.stringify(s.slice(Math.max(0, idx - 20), idx + 40));
    console.log(
      `DIFF ${slug}: text mismatch at offset ${i} — live: ${ctx(liveNorm, i)} built: ${ctx(builtNorm, i)}`
    );
    fail++;
    continue;
  }

  // 2. BR count check
  const liveBr = countOccurrences(liveRaw, "<br");
  const builtBr = countOccurrences(builtRaw, "<br");
  if (liveBr !== builtBr) {
    console.log(`DIFF ${slug}: br ${builtBr} vs ${liveBr}`);
    fail++;
    continue;
  }

  // 3. Asterism count check
  const liveAsterism = countOccurrences(liveRaw, 'class="asterism"');
  const builtAsterism = countOccurrences(builtRaw, 'class="asterism"');
  if (liveAsterism !== builtAsterism) {
    console.log(
      `DIFF ${slug}: asterism ${builtAsterism} vs ${liveAsterism}`
    );
    fail++;
    continue;
  }

  // 4. Link check: every href in live article body must appear in built article body
  const liveHrefs = extractHrefs(liveRaw);
  const builtHrefs = extractHrefs(builtRaw);
  const builtHrefSet = new Set(builtHrefs);
  const missingHrefs = liveHrefs.filter((h) => !builtHrefSet.has(h));
  if (missingHrefs.length > 0) {
    console.log(
      `DIFF ${slug}: missing links in built: ${missingHrefs.join(", ")}`
    );
    fail++;
    continue;
  }

  console.log(`OK   ${slug}`);
}
process.exit(fail ? 1 : 0);
