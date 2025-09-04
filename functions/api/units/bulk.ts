export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = request.headers.get("authorization") || "";
  if (env.ADMIN_TOKEN && auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json().catch(() => ({}));
  const edits = Array.isArray(body.edits) ? body.edits : [];
  if (!edits.length) {
    return new Response(JSON.stringify({ ok: true, updated: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const fields = ["name","level","parent","lat","lon","color","today","m30","ytd","inspectors","last_check"];
  const statements: D1PreparedStatement[] = [];

  for (const e of edits) {
    const id = Number(e.id);
    if (!id) continue;

    const cols: string[] = ["id"];
    const placeholders: string[] = ["?"];
    const insertValues: any[] = [id];

    const setClauses: string[] = [];
    for (const k of fields) {
      if (k in e) {
        cols.push(k);
        placeholders.push("?");
        insertValues.push((e as any)[k]);
        setClauses.push(`${k} = excluded.${k}`);
      }
    }
    if (cols.length === 1) continue;

    const sql = `
      INSERT INTO units (${cols.join(", ")}, updated_at, created_at)
      VALUES (${placeholders.join(", ")}, datetime('now'), datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        ${setClauses.length ? setClauses.join(", ") + "," : ""}
        updated_at = datetime('now')
    `;
    statements.push(env.DB.prepare(sql).bind(...insertValues));
  }

  if (!statements.length) {
    return new Response(JSON.stringify({ ok: true, updated: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  await env.DB.batch(statements);
  return new Response(JSON.stringify({ ok: true, updated: statements.length }), {
    headers: { "Content-Type": "application/json" },
  });
};
