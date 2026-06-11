import { config, fields, collection } from "@keystatic/core";

const useGithub =
  !import.meta.env.DEV ||
  import.meta.env.PUBLIC_KEYSTATIC_STORAGE === "github";

export default config({
  storage: useGithub
    ? { kind: "github", repo: "hhpmacedo/rascunhos_blog" }
    : { kind: "local" },
  ui: { brand: { name: "rascunhos" } },
  collections: {
    posts: collection({
      label: "Rascunhos",
      slugField: "title",
      path: "src/content/posts/*",
      format: { contentField: "content" },
      entryLayout: "content",
      columns: ["title", "pubDate"],
      schema: {
        title: fields.slug({ name: { label: "Título", validation: { isRequired: true } } }),
        pubDate: fields.date({ label: "Data", validation: { isRequired: true } }),
        excerpt: fields.text({ label: "Excerto", multiline: true,
          description: "Opcional. Resumo nas listagens/RSS; se vazio, derivado do texto." }),
        draft: fields.checkbox({ label: "Rascunho (oculto)", defaultValue: false }),
        content: fields.markdoc({ label: "Texto", extension: "md" }),
      },
    }),
  },
});
