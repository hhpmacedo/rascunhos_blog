import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

export default defineConfig({
  site: "https://rascunhos.blog",
  output: "static",
  adapter: vercel(),
  markdown: { syntaxHighlight: false },
});
