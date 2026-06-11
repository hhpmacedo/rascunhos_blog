import rss from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context: { site: URL }) {
  const posts = (await getCollection("posts", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime()
  );
  return rss({
    title: "rascunhos",
    description: "uns vão para o lixo, outros nem por isso",
    site: context.site,
    customData: "<language>pt</language>",
    items: posts.map((p) => ({
      title: p.data.title,
      link: `/posts/${p.id}.html`,
      pubDate: p.data.pubDate,
      description: p.data.excerpt ?? "",
    })),
  });
}
