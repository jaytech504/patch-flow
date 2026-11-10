# Domain & HTTPS Setup Checklist

**Canonical host: `https://www.patchflow.cloud`**
Render redirects the apex (`patchflow.cloud`) to `www.patchflow.cloud`.
All canonical tags, sitemap URLs, Open Graph URLs, JSON-LD, and GitHub OAuth
callback must use the **www** host.

---

## 1. DNS records (at your domain registrar / Cloudflare / etc.)

| Type  | Name  | Value                                      | Notes                              |
|-------|-------|--------------------------------------------|------------------------------------|
| CNAME | `www` | `<frontend-service>.onrender.com`          | Canonical frontend host            |
| CNAME | `@`   | `<frontend-service>.onrender.com`          | Render redirects apex → www        |
| CNAME | `api` | `<backend-service>.onrender.com`           | Backend API subdomain              |

---

## 2. Render — Frontend service

1. Dashboard → **patchflow-frontend** → **Settings** → **Custom Domains** → Add `www.patchflow.cloud` and `patchflow.cloud`.
2. Set `www.patchflow.cloud` as the **primary domain** so Render redirects apex → www.
3. Render auto-provisions TLS. Wait ~2 min for the certificate.
4. Confirm **Environment** tab has:
   - `NEXT_PUBLIC_API_URL` = `https://api.patchflow.cloud`
   - `NEXT_PUBLIC_SITE_URL` = `https://www.patchflow.cloud`
   - `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` = `www.patchflow.cloud`

---

## 3. Render — Backend service

1. Dashboard → **patchflow-backend** → **Settings** → **Custom Domains** → Add `api.patchflow.cloud`.
2. TLS auto-provisioned. Wait for certificate.
3. Confirm **Environment** tab has all secrets from `render.yaml` (marked `sync: false`).
4. **Health check**: Settings → Health Check Path → `/health`.
5. Set `FRONTEND_URL` = `https://www.patchflow.cloud`.

---

## 4. GitHub OAuth App

Go to **github.com → Settings → Developer settings → OAuth Apps → your PatchFlow app**:

| Field                      | Value                                            |
|----------------------------|--------------------------------------------------|
| Homepage URL               | `https://www.patchflow.cloud`                    |
| Authorization callback URL | `https://www.patchflow.cloud/auth/callback`      |

---

## 5. HTTP → HTTPS redirect

Render automatically redirects `http://` to `https://` for custom domains with TLS.
No additional config needed.

---

## 6. Plausible analytics (if set up)

Add **both** `patchflow.cloud` and `www.patchflow.cloud` as site domains in
your Plausible dashboard, or use just `www.patchflow.cloud` if Plausible follows
the redirect automatically.

---

## 7. Verify everything works

```bash
# 1. Apex should 301 → www
curl -sI https://patchflow.cloud | grep -i "^location:"
# Expected: Location: https://www.patchflow.cloud/

# 2. www should load with HSTS header
curl -sI https://www.patchflow.cloud | grep -i "strict-transport"

# 3. Backend health check
curl https://api.patchflow.cloud/health

# 4. GitHub login redirect (should 302 → github.com)
curl -v https://api.patchflow.cloud/api/auth/github/login 2>&1 | grep "< Location"

# 5. robots.txt and sitemap (must use www URLs)
curl https://www.patchflow.cloud/robots.txt
curl https://www.patchflow.cloud/sitemap.xml
```

---

## 8. Aiven (PostgreSQL)

- Connection string must include `sslmode=require` (or `sslmode=verify-full`).
- Set `DB_POOL_SIZE=4` and `DB_POOL_MAX_OVERFLOW=4` on the Hobbyist plan.

---

## 9. Post-deploy checklist

- [ ] `https://patchflow.cloud` 301s to `https://www.patchflow.cloud`
- [ ] `https://www.patchflow.cloud` loads correctly
- [ ] `https://api.patchflow.cloud/health` returns `{"status":"ok"}`
- [ ] Login with GitHub completes and redirects to `/dashboard`
- [ ] GitHub OAuth callback URL is `https://www.patchflow.cloud/auth/callback`
- [ ] Canonical tag on homepage reads `https://www.patchflow.cloud`
- [ ] `og:url` on homepage reads `https://www.patchflow.cloud`
- [ ] Sitemap URLs all begin with `https://www.patchflow.cloud`
- [ ] OG image appears correctly in [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [ ] Sitemap submitted to Google Search Console under the `www` property
- [ ] Plausible dashboard shows `www.patchflow.cloud` tracking events
