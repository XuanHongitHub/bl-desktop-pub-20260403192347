import type { NextRequest } from "next/server";

const SHADCN_ORIGIN = "https://ui.shadcn.com";
const PROXY_PREFIX = "/shadcn-full";

const HTML_CONTENT_TYPE = "text/html";
const JAVASCRIPT_CONTENT_TYPES = [
  "application/javascript",
  "text/javascript",
  "application/x-javascript",
];
const CSS_CONTENT_TYPE = "text/css";
const JSON_CONTENT_TYPE = "application/json";
const X_COMPONENT_CONTENT_TYPE = "text/x-component";
const ROUTE_PREFIXES = [
  "/docs",
  "/components",
  "/blocks",
  "/charts",
  "/directory",
  "/create",
  "/examples",
  "/themes",
];

function buildTargetUrl(request: NextRequest, slug?: string[]): URL {
  const targetPath = slug && slug.length > 0 ? `/${slug.join("/")}` : "/examples/dashboard";
  const targetUrl = new URL(targetPath, SHADCN_ORIGIN);
  request.nextUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });
  return targetUrl;
}

function rewriteHtmlDocument(html: string): string {
  let rewritten = html;

  rewritten = rewritten.replace(
    /(<head[^>]*>)/i,
    `$1<meta name="referrer" content="no-referrer" />
<script id="buglogin-shadcn-mirror-bootstrap">
try {
  localStorage.removeItem("layout");
  const mirrorTheme = localStorage.getItem("buglogin.shadcn.mirror.theme");
  if (mirrorTheme === "light" || mirrorTheme === "dark" || mirrorTheme === "system") {
    localStorage.setItem("theme", mirrorTheme);
  } else if (!localStorage.getItem("theme")) {
    localStorage.setItem("theme", "light");
  }
  window.addEventListener("beforeunload", () => {
    const currentTheme = localStorage.getItem("theme");
    if (currentTheme === "light" || currentTheme === "dark" || currentTheme === "system") {
      localStorage.setItem("buglogin.shadcn.mirror.theme", currentTheme);
    }
  });
} catch {}
</script>`,
  );

  rewritten = rewritten.replace(
    /(href|src|action)=(["'])\/(?!\/|shadcn-full\/)/g,
    `$1=$2${PROXY_PREFIX}/`,
  );
  rewritten = rewritten.replace(
    /url\((["']?)\/(?!\/|shadcn-full\/)/g,
    `url($1${PROXY_PREFIX}/`,
  );
  rewritten = rewritten.replaceAll(`${SHADCN_ORIGIN}/`, `${PROXY_PREFIX}/`);

  return rewritten;
}

function rewriteCommonTextPayload(payload: string): string {
  let rewritten = payload;

  rewritten = rewritten.replaceAll(`"${SHADCN_ORIGIN}/`, `"${PROXY_PREFIX}/`);
  rewritten = rewritten.replaceAll(`'${SHADCN_ORIGIN}/`, `'${PROXY_PREFIX}/`);
  rewritten = rewritten.replaceAll(`"${SHADCN_ORIGIN}"`, `"${PROXY_PREFIX}"`);
  rewritten = rewritten.replaceAll(`'${SHADCN_ORIGIN}'`, `'${PROXY_PREFIX}'`);

  rewritten = rewritten.replaceAll(`"/_next/`, `"${PROXY_PREFIX}/_next/`);
  rewritten = rewritten.replaceAll(`'/_next/`, `'${PROXY_PREFIX}/_next/`);
  rewritten = rewritten.replaceAll(`"/_vercel/`, `"${PROXY_PREFIX}/_vercel/`);
  rewritten = rewritten.replaceAll(`'/_vercel/`, `'${PROXY_PREFIX}/_vercel/`);
  rewritten = rewritten.replaceAll(`"/favicon`, `"${PROXY_PREFIX}/favicon`);
  rewritten = rewritten.replaceAll(`'/favicon`, `'${PROXY_PREFIX}/favicon`);
  rewritten = rewritten.replaceAll(`"/apple-touch-icon`, `"${PROXY_PREFIX}/apple-touch-icon`);
  rewritten = rewritten.replaceAll(`'/apple-touch-icon`, `'${PROXY_PREFIX}/apple-touch-icon`);
  rewritten = rewritten.replaceAll(`"/site.webmanifest`, `"${PROXY_PREFIX}/site.webmanifest`);
  rewritten = rewritten.replaceAll(`'/site.webmanifest`, `'${PROXY_PREFIX}/site.webmanifest`);
  rewritten = rewritten.replaceAll(`"/placeholder.svg`, `"${PROXY_PREFIX}/placeholder.svg`);
  rewritten = rewritten.replaceAll(`'/placeholder.svg`, `'${PROXY_PREFIX}/placeholder.svg`);

  ROUTE_PREFIXES.forEach((pathPrefix) => {
    rewritten = rewritten.replaceAll(`"${pathPrefix}`, `"${PROXY_PREFIX}${pathPrefix}`);
    rewritten = rewritten.replaceAll(`'${pathPrefix}`, `'${PROXY_PREFIX}${pathPrefix}`);
  });

  return rewritten;
}

function rewriteCssPayload(payload: string): string {
  return rewriteCommonTextPayload(payload).replace(
    /url\((["']?)\/(?!\/|shadcn-full\/)/g,
    `url($1/shadcn-full/`,
  );
}

function rewriteScriptPayload(payload: string): string {
  return rewriteCommonTextPayload(payload);
}

function shouldRewriteAsText(contentType: string): boolean {
  return (
    contentType.includes(HTML_CONTENT_TYPE) ||
    contentType.includes(CSS_CONTENT_TYPE) ||
    contentType.includes(JSON_CONTENT_TYPE) ||
    contentType.includes(X_COMPONENT_CONTENT_TYPE) ||
    JAVASCRIPT_CONTENT_TYPES.some((type) => contentType.includes(type))
  );
}

function copyProxyHeaders(upstreamHeaders: Headers, contentType: string): Headers {
  const headers = new Headers();
  headers.set("content-type", contentType);
  headers.set("cache-control", "public, max-age=120");

  const etag = upstreamHeaders.get("etag");
  if (etag) {
    headers.set("etag", etag);
  }

  return headers;
}

export async function GET(
  request: NextRequest,
  context: {
    params: Promise<{ slug?: string[] }>;
  },
) {
  const { slug } = await context.params;
  const targetUrl = buildTargetUrl(request, slug);

  const upstreamResponse = await fetch(targetUrl, {
    headers: {
      "user-agent": "BugLogin-Shadcn-Mirror/1.0",
      accept: request.headers.get("accept") ?? "*/*",
    },
    redirect: "follow",
    cache: "no-store",
  });

  const rawContentType = upstreamResponse.headers.get("content-type") ?? "text/plain; charset=utf-8";
  const contentType = rawContentType.split(";")[0]?.trim() || rawContentType;

  if (!shouldRewriteAsText(rawContentType)) {
    const bytes = await upstreamResponse.arrayBuffer();
    return new Response(bytes, {
      status: upstreamResponse.status,
      headers: copyProxyHeaders(upstreamResponse.headers, rawContentType),
    });
  }

  const text = await upstreamResponse.text();
  const rewrittenText = rawContentType.includes(HTML_CONTENT_TYPE)
    ? rewriteHtmlDocument(text)
    : rawContentType.includes(CSS_CONTENT_TYPE)
      ? rewriteCssPayload(text)
      : rewriteScriptPayload(text);

  return new Response(rewrittenText, {
    status: upstreamResponse.status,
    headers: copyProxyHeaders(upstreamResponse.headers, rawContentType),
  });
}
