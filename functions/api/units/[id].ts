export const onRequestPut: PagesFunction<Env> = async ({ params, request, env }) => {
  const auth = request.headers.get("authorization") || "";
  if (env.ADMIN_TOKEN && auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const id = Number(params.id);
  const patch = await request.json().catch(()=>({}));
  const fields = ["name","level","parent","lat","lon","color","today","m30","ytd","inspectors","last_check"];
  const sets:string[] = [];
  const values:any[] = [];
  for (const k of fields){
    if (k in patch){ sets.push(`${k} = ?`); values.push((patch as any)[k]); }
  }
  if (!sets.length) return new Response(JSON.stringify({updated:0}), {headers:{'Content-Type':'application/json'}});
  const sql = `UPDATE units SET ${sets.join(', ')}, updated_at = datetime('now') WHERE id = ?`;
  values.push(id);
  const res = await env.DB.prepare(sql).bind(...values).run();
  return new Response(JSON.stringify({ updated: res.success ? 1 : 0 }), { headers: { "Content-Type": "application/json" } });
};

export const onRequestDelete: PagesFunction<Env> = async ({ params, request, env }) => {
  const auth = request.headers.get("authorization") || "";
  if (env.ADMIN_TOKEN && auth !== `Bearer ${env.ADMIN_TOKEN}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const id = Number(params.id);
  const res = await env.DB.prepare("DELETE FROM units WHERE id = ?").bind(id).run();
  return new Response(JSON.stringify({ deleted: res.success ? 1 : 0 }), { headers: { "Content-Type": "application/json" } });
};
