# PostgreSQL on Railway (swipes & context library)

Swipe files (Context Hub **Swipe Files** + **Inspiration Center**) persist in Postgres when `DATABASE_URL` is set. Without it, the app keeps using `data/{brandId}/` JSON files (fine for local dev, not durable on Railway redeploys).

## 1. Create a database on Railway

1. In your Railway project, click **New** → **Database** → **PostgreSQL**.
2. Open the Postgres service → **Variables** (or **Connect**) and copy the connection URL. It usually looks like `postgresql://postgres:...@...railway.app:5432/railway`.

## 2. Attach `DATABASE_URL` to the app

1. Open your **Next.js / web** service → **Variables**.
2. Add **`DATABASE_URL`** with the Postgres URL.
3. Railway often injects `DATABASE_URL` automatically when you **link** the database to the service (use that if available).

Railway Postgres typically requires TLS. If the client fails to connect, append query params to the URL (Prisma understands these):

`?sslmode=require`

## 3. Run migrations on deploy

Apply the schema **after** the database exists:

```bash
npx prisma migrate deploy
```

**Option A — local (one-time or when you change schema):**

```bash
export DATABASE_URL="postgresql://..."   # from Railway
npx prisma migrate deploy
```

**Option B — Railway release command:**  
In the web service → **Settings** → **Deploy** → **Custom Start Command** is for runtime; for migrations use **Release Command** (if your plan supports it) or a one-off **Railway CLI** run:

```bash
railway run npx prisma migrate deploy
```

**Option C — bake into build:**  
Some teams run `prisma migrate deploy` at the start of `npm run build`. That works if `DATABASE_URL` is available during build on Railway (often it is when variables are linked).

This repo’s `npm run build` runs `prisma generate` only; **you** must run `migrate deploy` at least once per environment so tables exist.

## 4. Redeploy

Redeploy the app. With `DATABASE_URL` set, new swipes and inspiration items are stored in Postgres and survive redeploys.

## 5. Optional: copy existing JSON into Postgres

If you have local `data/winespies/context-library.json` or `swipe-inspiration.json`, you can:

- Re-import markdown via **Swipes** / Context Hub (small libraries), or  
- Write a one-off script using `getPrisma()` and the same shapes as the JSON files.

Other features (chats, reviews, Meta sync, etc.) still use files under `data/` until migrated separately.

## Troubleshooting

| Issue | What to check |
|--------|----------------|
| `P1001` / connection refused | `DATABASE_URL` on the **app** service, firewall, DB not paused |
| SSL errors | Add `?sslmode=require` to the URL |
| Table does not exist | Run `npx prisma migrate deploy` against that database |
| Build fails on `prisma generate` | Should not need DB; if it does, check `schema.prisma` and env |
