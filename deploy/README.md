# Deploy to Ubuntu (rock.vendingao.com)

## 1. On the server

```bash
# Put the project somewhere, e.g.
cd /opt/nepal-climbs

# Env for Docker build + runtime
cp .env.production.example .env.production
nano .env.production   # paste real NEXT_PUBLIC_SUPABASE_* values

# --env-file is required so build args pick up NEXT_PUBLIC_* values
docker compose --env-file .env.production up -d --build
# App listens on 127.0.0.1:3001 (not 3000 — leave 3000 free for other backends)
```

## 2. nginx + TLS

If certbot already issued the cert but failed to install it, copy the full HTTPS config and reload:

```bash
sudo cp deploy/nginx/rock.vendingao.com.conf /etc/nginx/sites-available/rock.vendingao.com
sudo ln -sf /etc/nginx/sites-available/rock.vendingao.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

First-time TLS (only if certs do not exist yet):

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d rock.vendingao.com
```

Point DNS A/AAAA for `rock.vendingao.com` at this server before certbot.

## 3. Supabase Auth URLs (required for email verification)

In Supabase Dashboard → **Authentication** → **URL configuration**:

- **Site URL:** `https://rock.vendingao.com`  ← change this off `http://localhost:3000`
- **Redirect URLs** (add all):
  - `https://rock.vendingao.com/**`
  - `https://rock.vendingao.com/auth/callback`

Also set in `.env.production`:

```env
NEXT_PUBLIC_SITE_URL=https://rock.vendingao.com
```

Then rebuild so signup emails use the production callback URL.
## 4. Updates

```bash
cd /opt/nepal-climbs
git pull   # or copy new files
docker compose --env-file .env.production up -d --build
```
