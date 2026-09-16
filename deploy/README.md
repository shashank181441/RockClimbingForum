# Deploy to Ubuntu (rock.vendingao.com)

## 1. On the server (first time)

```bash
sudo mkdir -p /opt/nepal-climbs
sudo chown "$USER:$USER" /opt/nepal-climbs
git clone <your-repo-url> /opt/nepal-climbs
cd /opt/nepal-climbs

cp .env.production.example .env.production
nano .env.production   # set NEXT_PUBLIC_* values

# --env-file is required so build args pick up NEXT_PUBLIC_* values
docker compose --env-file .env.production up -d --build
# App listens on 127.0.0.1:3001 (not 3000 — leave 3000 free for other backends)
```

## 2. GitHub Actions deploy

Workflows:

- `.github/workflows/ci.yml` — typecheck + lint on push/PR to `main`
- `.github/workflows/deploy.yml` — SSH deploy on push to `main`

Create GitHub environment `nepal_climbs` with secrets:

| Secret | Purpose |
|--------|---------|
| `SERVER_HOST` | VPS host |
| `SERVER_USER` | SSH user |
| `SERVER_SSH_KEY` | Deploy private key |

Optional variable: `DEPLOY_PATH` (default `/opt/nepal-climbs`).

Deploy script on the server:

```bash
cd /opt/nepal-climbs
git pull
docker compose --env-file .env.production up -d --build
```

## 3. nginx + TLS

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

## 4. Updates (manual)

```bash
cd /opt/nepal-climbs
git pull
docker compose --env-file .env.production up -d --build
```
