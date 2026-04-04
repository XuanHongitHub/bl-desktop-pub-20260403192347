import {
  buildTiktokSellerDemoDocument,
  readTiktokSellerDemoDocument,
  resolveTiktokSellerDemoStep,
} from "@/features/web/tiktok-seller-demo/tiktok-seller-demo-runtime";

type TiktokSellerDemoRouteContext = {
  params: Promise<{
    slug?: string[];
  }>;
};

function notFoundHtml(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Not found</title>
  </head>
  <body style="font-family: sans-serif; padding: 24px">
    <h1>404</h1>
    <p>TikTok seller demo step not found.</p>
  </body>
</html>`;
}

export async function GET(
  request: Request,
  context: TiktokSellerDemoRouteContext,
) {
  const { slug } = await context.params;
  const step = resolveTiktokSellerDemoStep(slug);

  if (!step) {
    return new Response(notFoundHtml(), {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  }

  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") === "raw" ? "raw" : "demo";

  const html = await readTiktokSellerDemoDocument(step);
  const built = buildTiktokSellerDemoDocument(html, step, mode);

  return new Response(built, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
    },
  });
}
