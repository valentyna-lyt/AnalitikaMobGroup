export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  // Перевірка токена (можна не задавати ADMIN_TOKEN — тоді пускає всіх)
  const auth = request.headers.get("authorization") || "";
  if (env.ADMIN_TOKEN && auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json().catch(() => ({}));
  const edits = Array.isArray(body.edits) ? body.edits : [];
  if (!edits.length) {
    return new Response(JSON.stringify({ ok: true, updated: 0 }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // Дозволені поля
  const fields = [
    "name", "level", "parent",
    "lat", "lon", "color",
    "today", "m30", "ytd",
    "inspectors", "last_check"
  ];

  const statements: D1PreparedStatement[] = [];

  for (const e of edits) {
    const id = Number(e.id);
    if (!id) continue;

    // Збираємо динамічні колонки для INSERT/UPDATE
    const cols: string[] = ["id"];
    const placeholders: string[] = ["?"];
    const insertValues: any[] = [id];

    const setClauses: string[] = [];
    const updateValues: any[] = [];

    for (const k of fields) {
      if (k in e) {
        cols.push(k);
        placeholders.push("?");
        insertValues.push((e as any)[k]);

        setClauses.push(`${k} = excluded.${k}`);
        // для ON CONFLICT використовуємо excluded.<col>, тому updateValues не потрібні
      }
    }

    // Якщо нема що апдейтити/інсертити, пропускаємо
    if (cols.length === 1) continue; // лише id

    // ON CONFLICT(id) DO UPDATE — робимо UPSERT
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
