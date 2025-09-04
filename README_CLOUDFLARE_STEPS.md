# Cloudflare Pages + D1 quick steps

1) Pages project → Settings → Functions → **D1 bindings** → add:
   - Variable name: **DB**
   - Select database: **analitika_mob_db** (5317991c-803d-417c-bbc2-fb6662fe3124)

2) (Optional) Pages → Settings → Environment variables:
   - `ADMIN_TOKEN` = any long random string
   If you set it, also put the same string into `assets/js/config.js` under `ADMIN_TOKEN`.

3) Migrations / table: already created via Console.
   Table: **units**

4) Deploy. Then open your site and:
   - If API is available → loads data from `/api/units`.
   - If API not reachable → falls back to demo CSV automatically.
   - "Застосувати" sends local edits → `/api/units/bulk`.
