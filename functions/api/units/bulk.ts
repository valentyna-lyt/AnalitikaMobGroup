export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = request.headers.get("authorization") || "";
  if (env.ADMIN_TOKEN && auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { edits = [] } = await request.json().catch(()=>({edits:[]}));
  const statements = edits.map((e:any)=>{
    const id = Number(e.id);
    const fields = ["name","level","parent","lat","lon","color","today","m30","ytd","inspectors","last_check"];
    const sets:string[] = []; const values:any[] = [];
    for (const k of fields){
      if (k in e){ sets.push(`${k} = ?`); values.push(e[k]); }
    }
    const sql = `UPDATE units SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`;
    values.push(id);
    return env.DB.prepare(sql).bind(...values);
  });
  await env.DB.batch(statements);
  return new Response(JSON.stringify({ ok: true, updated: edits.length }), { headers: { "Content-Type": "application/json" } });
};
