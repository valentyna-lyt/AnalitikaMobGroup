export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const { results } = await env.DB.prepare(
    "SELECT id, name, level, parent, lat, lon, color, today, m30, ytd, inspectors, last_check, created_at, updated_at FROM units ORDER BY id ASC"
  ).all();
  return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
};
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = request.headers.get("authorization") || "";
  if (env.ADMIN_TOKEN && auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const { name, level, parent, lat, lon, color, today, m30, ytd, inspectors, last_check } = body;
  const stmt = env.DB.prepare(`INSERT INTO units (name, level, parent, lat, lon, color, today, m30, ytd, inspectors, last_check, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`).bind(
      name||"", level||"", parent||"", lat||null, lon||null, color||null, today||0, m30||0, ytd||0, inspectors||"", last_check||null
    );
  const res = await stmt.run();
  return new Response(JSON.stringify({ id: res.lastRowId }), { headers: { "Content-Type": "application/json" } });
};
