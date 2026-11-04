# Domain & HTTPS Setup Checklist

Complete these steps once to go live on `patchflow.cloud` and `api.patchflow.cloud`.

---

## 1. DNS records (at your domain registrar / Cloudflare / etc.)

| Type  | Name              | Value                                      | Notes                              |
|-------|-------------------|--------------------------------------------|------------------------------------|
| CNAME | `@` (or `patchflow.cloud`) | `<frontend-service>.onrender.com` | Render frontend custom domain      |
| CNAME | `www`             | `<frontend-service>.onrender.com`          | www redirect (optional)            |
| CNAME | `api`             | `<backend-service>.onrender.com`           | Backend API subdomain              |

> Some registrars don't allow a CNAME on the root (`@`). Use an ANAME/ALIAS record instead, or point the root to Render's IP if they provide one. Check Render's custom domain docs for the exact target hostname for your service.

---

## 2. Render — Frontend service

1. Dashboard → **patchflow-frontend** → **Settings** → **Custom Domains** → Add `patchflow.cloud` and `www.patchflow.cloud`.
2. Render auto-provisions TLS (Let's Encrypt). Wait for the certificate to issue (~2 min).
3. Confirm **Environment** tab has:
   - `NEXT_PUBLIC_API_URL` = `https://api.patchflow.cloud`
   - `NEXT_PUBLIC_SITE_URL` = `https://patchflow.cloud`

---

## 3. Render — Backend service

1. Dashboard → **patchflow-backend** → **Settings** → **Custom Domains** → Add `api.patchflow.cloud`.
2. TLS auto-provisioned. Wait for certificate.
3. Confirm **Environment** tab has all secrets from `render.yaml` (marked `sync: false`).
4. **Health check**: Settings → Health Check Path → `/health` (already in `render.yaml`).

---

## 4. GitHub OAuth App

Go to **github.com → Settings → Developer settings → OAuth Apps → your PatchFlow app**:

| Field                      | Value                                        |
|----------------------------|----------------------------------------------|
| Homepage URL               | `https://patchflow.cloud`                    |
| Authorization callback URL | `https://patchflow.cloud/auth/callback`      |

---

## 5. HTTP → HTTPS redirect

Render automatically redirects `http://` to `https://` for custom domains with TLS enabled.
No additional config needed.

---

## 6. Verify everything works

```bash
# Frontend canonical URL, title, and canonical tag
curl -sI https://patchflow.cloud | grep -i "location\|strict-transport"

# Backend health check
curl https://api.patchflow.cloud/health

# GitHub login redirect (should redirect to github.com, not return JSON)
curl -v https://api.patchflow.cloud/api/auth/github/login 2>&1 | grep "< Location"

# robots.txt and sitemap
curl https://patchflow.cloud/robots.txt
curl https://patchflow.cloud/sitemap.xml
```

---

## 7. Aiven (PostgreSQL)

- Connection string must include `sslmode=require` (or `sslmode=verify-full`).
- Set `DB_POOL_SIZE=4` and `DB_POOL_MAX_OVERFLOW=4` on the Hobbyist plan (25 max connections).
- On paid plans, raise those values proportionally.

---

## 8. Post-deploy checklist

- [ ] `https://patchflow.cloud` loads correctly
- [ ] `https://api.patchflow.cloud/health` returns `{"status":"ok"}`
- [ ] Login with GitHub completes and redirects to `/dashboard`
- [ ] OG image appears correctly in [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [ ] Sitemap indexed in Google Search Console
- [ ] Plausible dashboard shows `patchflow.cloud` tracking events
