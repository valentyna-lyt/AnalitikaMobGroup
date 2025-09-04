export const onRequest: PagesFunction = async ({request, next}) => {
  const resp = await next();
  const headers = new Headers(resp.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (request.method === "OPTIONS") {
    return new Response(null, {status: 204, headers});
  }
  return new Response(resp.body, {status: resp.status, headers});
};
