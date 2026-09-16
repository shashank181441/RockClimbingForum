# Laravel API migration (feature/laravel-api)

The forum frontend on `main` still uses **Supabase**. This branch prepares a switch to the Laravel API in:

`C:\Users\User\Documents\projects\laravel\projects\rock_laravel`

## Env (optional until cutover)

```env
# Leave empty to keep Supabase as the data/auth source
NEXT_PUBLIC_API_URL=http://localhost:8000/api
```

Helper: `lib/api/client.ts` (`isLaravelApiEnabled()`, `apiFetch()`).

## Backend

- Laravel 13 + Sanctum
- PostgreSQL schema mirroring forum tables
- CI: `.github/workflows/ci.yml`
- Deploy template: `.github/workflows/deploy.yml` (configure GitHub secrets yourself)
- Docker Compose on port **8081** by default

Do not point production at Laravel until auth + data migration is verified.
