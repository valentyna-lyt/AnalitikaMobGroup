# Deploy to Cloudflare Pages + D1

## One-time setup
1. Create a Cloudflare account.
2. In the Dashboard → D1, create a database and copy its **ID** and **Name**.
3. In this repo, edit `wrangler.toml` and paste your `database_id` and `database_name` under the `[[d1_databases]]` block.
4. Connect this GitHub repo to **Cloudflare Pages** (Create a project → Connect to GitHub). Choose:
   - Build command: **None**
   - Output directory: **/** (root)
   - Enable **Functions**.
5. In Pages → Settings → **Environment variables** add (optional):
   - `ADMIN_TOKEN` — a secret token that will be required for POST/PUT/DELETE.
6. In Pages → Settings → **D1 bindings**, add binding:
   - Variable name: **DB**
   - Select your D1 database.

## Migrations
Run once to create the schema (from local dev or via Pages console):
```sh
npm i
npm run migrate:prod    # or use wrangler UI
```

## Local development
```sh
npm i
npm run dev
```
This serves the site on http://localhost:8788 with the API at `/api/...` and a local D1 instance.

## API
- `GET  /api/units` — list records
- `POST /api/units` — create (Authorization: `Bearer <ADMIN_TOKEN>`)
- `PUT  /api/units/:id` — update by id (Authorization required)
- `DELETE /api/units/:id` — delete (Authorization required)
- `POST /api/units/bulk` — update multiple records at once (Authorization required)

## Frontend
- On boot the app calls `loadFromAPI()`; if it fails, it falls back to the demo CSV.
- Changes in the **Settings** dialog are synced to the server when you press **Apply**.
- Set `window.APP_CONFIG.ADMIN_TOKEN` in `assets/js/config.js` (or via Settings UI if you build it) to allow writes from the browser.
