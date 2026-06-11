import { defineConfig } from "astro/config";
import vercel from "@astrojs/vercel";

/** Rehype plugin: rewrite every <hr> in rendered markdown as <p class="asterism">⁂</p> */
function rehypeAsterism() {
  return (tree) => {
    const walk = (node) => {
      if (node.children) {
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          if (child.tagName === "hr") {
            child.tagName = "p";
            child.properties = { className: ["asterism"] };
            child.children = [{ type: "text", value: "⁂" }];
          } else {
            walk(child);
          }
        }
      }
    };
    walk(tree);
  };
}

export default defineConfig({
  site: "https://rascunhos.blog",
  output: "static",
  adapter: vercel(),
  redirects: {
    "/autor.html": "/o-culpado/",
  },
  markdown: {
    syntaxHighlight: false,
    smartypants: false,
    rehypePlugins: [rehypeAsterism],
  },
});
