# Laravel API cutover (done)

The Nepal Climbs forum frontend now uses the **Laravel API** (Sanctum bearer tokens) via:

- `lib/api/client.ts` — `apiFetch`, `getToken`, `setToken`, `mediaUrl`
- `lib/api/forum.ts` — auth, categories, topics, discussions, comments, likes, bookmarks, profiles, uploads, notifications, moderation
- `lib/api/adapters.ts` — normalizes Laravel payloads to existing frontend types
- `lib/auth-context.tsx` — Sanctum session via `fetchMe` / `setAuthState`

## Env

```env
NEXT_PUBLIC_API_URL=https://rockapi.vendingao.com/api
NEXT_PUBLIC_SITE_URL=https://rock.vendingao.com
```

Supabase env vars may remain in local `.env` but are unused by `app/` and `components/`.

## Backend

- Laravel app: `rock_laravel`
- Auth: Sanctum personal access tokens (`device_name: web`)
- Public reads: categories, topics, discussions, profiles (no token)
- Authenticated writes: create/update content, likes, bookmarks, uploads, moderation

## Docker

Build args / env must include `NEXT_PUBLIC_API_URL` so the client bundle points at the API.
