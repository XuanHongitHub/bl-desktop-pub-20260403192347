import {
  readFarmerCloneDocument,
  resolveFarmerCloneSlug,
} from "@/features/web/farmer-clone/farmer-clone-runtime";

type FarmerCloneRouteContext = {
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
    <p>Farmer clone page not found.</p>
  </body>
</html>`;
}

export async function GET(_request: Request, context: FarmerCloneRouteContext) {
  const { slug } = await context.params;
  const resolvedSlug = resolveFarmerCloneSlug(slug);

  if (!resolvedSlug) {
    return new Response(notFoundHtml(), {
      status: 404,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  }

  const html = await readFarmerCloneDocument(resolvedSlug);
  return new Response(html, {
    status: 200,
    headers: {
      "cache-control": "no-store",
      "content-type": "text/html; charset=utf-8",
    },
  });
}
