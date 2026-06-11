import { defineMiddleware } from "astro:middleware";

// Keystatic's GitHub OAuth handler builds the `redirect_uri` from the incoming
// request URL's origin. Behind Vercel's proxy that origin resolves to `localhost`,
// so production login redirects to a broken localhost callback. For the OAuth
// routes only, rebuild the request URL from the forwarded headers so the
// redirect_uri uses the real public domain (rascunhos.blog).
// Workaround for https://github.com/Thinkmill/keystatic/issues/1022
export const onRequest = defineMiddleware((context, next) => {
  // Only the LOGIN route needs the host fix (it builds the OAuth redirect_uri from
  // the request origin). The oauth/callback route reads `code` from the query and
  // exchanges it server-side — it needs no host correction, so we leave it untouched
  // to avoid any chance of disturbing the request.
  const needsHostFix = context.url.pathname.startsWith(
    "/api/keystatic/github/login",
  );

  if (needsHostFix) {
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
