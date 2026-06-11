import { defineMiddleware } from "astro:middleware";

// Keystatic's GitHub OAuth handler builds the `redirect_uri` from the incoming
// request URL's origin. Behind Vercel's proxy that origin resolves to `localhost`,
// so production login redirects to a broken localhost callback. For the OAuth
// routes only, rebuild the request URL from the forwarded headers so the
// redirect_uri uses the real public domain (rascunhos.blog).
// Workaround for https://github.com/Thinkmill/keystatic/issues/1022
export const onRequest = defineMiddleware((context, next) => {
  const path = context.url.pathname;
  const isOAuthRoute =
    path.startsWith("/api/keystatic/github/oauth/") ||
    path.startsWith("/api/keystatic/github/login");

  if (isOAuthRoute) {
    const host = context.request.headers.get("x-forwarded-host");
    const proto = context.request.headers.get("x-forwarded-proto");
    if (host && proto) {
      try {
        const correctUrl = new URL(context.url);
        correctUrl.protocol = proto;
        correctUrl.host = host;
        const newRequest = new Request(correctUrl.toString(), {
          method: context.request.method,
          headers: context.request.headers,
        });
        Object.defineProperty(context, "url", {
          value: correctUrl,
          configurable: true,
        });
        Object.defineProperty(context, "request", {
          value: newRequest,
          configurable: true,
        });
      } catch {
        // If the context properties can't be redefined on this runtime,
        // fall through unchanged (login stays as-is rather than 500ing).
      }
    }
  }

  return next();
});
