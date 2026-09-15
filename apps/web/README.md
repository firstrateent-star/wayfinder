# Wayfinder Web

Thin React client over the proven Wayfinder public RPC boundary.

## Local setup

```bash
cd apps/web
cp .env.example .env.local
npm install
npm run dev
```

Environment values:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Use the publishable Supabase key only. Never place service-role credentials in this client.

## Architecture rule

The web client may use Supabase Auth and `supabase.rpc(...)` for approved public Wayfinder functions. It must not query or mutate private `wf_*` schemas/tables directly.

Run:

```bash
npm run check:boundaries
```

The production build runs this boundary check automatically.

## Current surface

- magic-link auth;
- `wf_ensure_owner` bootstrap;
- authenticated Helm v0 read;
- Bearing / Direction / Practice rendering;
- retry-safe PracticeSession capture;
- Direction / Outcome / Quest / Action capture;
- optional Action `SUPPORTS` relationship to current Direction records.

The UI intentionally does not create XP, completion, progress percentages, or lived-life absence claims that the backend does not support.
