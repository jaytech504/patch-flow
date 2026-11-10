# PatchFlow — SEO Keyword Strategy

_Last updated: November 2026_

---

## Primary keyword

**`self-healing API`**

This is the most accurate single phrase for what PatchFlow does — it heals APIs
automatically. It has clear informational search intent ("what is a self-healing
API?") and is not yet dominated by established tools, giving a new product a
real chance to rank. It also anchors the product's brand differentiation versus
Sentry, Datadog, and similar observability tools which detect but do not fix.

---

## Secondary and long-tail keywords

Grouped by search intent:

### Informational ("how does X work?")
| Keyword | Volume tier | Notes |
|---------|-------------|-------|
| what is a self-healing API | Low–Med | Definitional; blog post target |
| chaos engineering API testing | Med | Broad but relevant; docs target |
| how to test API resilience | Med | Tutorial intent; blog target |
| API error monitoring with auto-fix | Low | Niche but high-intent |

### Solution-aware ("I know the problem, looking for tools")
| Keyword | Volume tier | Notes |
|---------|-------------|-------|
| automated API reliability testing | Low–Med | Homepage + docs |
| API chaos testing tool | Low | Very relevant; homepage |
| production error auto-fix | Low | Differentiator; homepage |
| automated bug fix pull request | Low | Very specific; homepage + demo |
| API failure injection testing | Low | Technical; docs target |

### Comparison ("X vs Y")
| Keyword | Volume tier | Notes |
|---------|-------------|-------|
| PatchFlow vs Sentry | Low | Comparison page (future) |
| error monitoring with auto-fix vs manual debugging | Very low | Long-tail; blog target |
| chaos testing vs manual testing | Low | Blog/docs |

### Transactional ("ready to use/buy")
| Keyword | Volume tier | Notes |
|---------|-------------|-------|
| API reliability tool free | Low | Pricing page |
| SDK error monitoring Node.js | Low–Med | Docs target |
| GitHub auto PR bug fix tool | Low | Homepage + demo |

---

## Keyword-to-page mapping

| Page | Primary keyword | Supporting keywords |
|------|-----------------|---------------------|
| `/` (homepage) | self-healing API | automated API reliability testing, API chaos testing tool, automated bug fix pull request |
| `/docs` | SDK error monitoring Node.js | API failure injection, PatchFlow SDK, production error auto-fix |
| `/demo` | automated bug fix pull request | API chaos testing demo, GitHub auto PR bug fix |
| `/pricing` | API reliability tool free | PatchFlow pricing, self-healing API pricing |
| `/blog/self-healing-apis` (future) | what is a self-healing API | chaos engineering, error monitoring |
| `/blog/chaos-testing` (future) | chaos engineering API testing | how to test API resilience, API failure injection |
| `/blog/error-to-pr` (future) | production error auto-fix | automated bug fix pull request, GitHub auto PR |
| `/use-cases/api-reliability` (future) | automated API reliability testing | API chaos testing tool |
| `/use-cases/production-monitoring` (future) | API error monitoring with auto-fix | production error auto-fix |

---

## Brand collision check

**"PatchFlow"** does not appear to be used by any major software product as of
late 2026. Potential confusion risks:

- Generic patch/flow associations (Git patch, CI/CD flow) — mitigate by always
  pairing with a descriptor: "PatchFlow — Self-Healing APIs" rather than
  standalone.
- The `.onrender.com` subdomain was previously indexed — ensure canonical URLs
  all use `https://www.patchflow.cloud` (the www host is canonical; Render
  redirects the apex to www).

**Recommendation:** The homepage `<title>` and H1 should always pair the brand
with the differentiating phrase:

- Title: `Self-Healing APIs — Chaos Testing & Auto-Fix PRs | PatchFlow`
- H1: `Stop finding bugs. Start fixing them.` (current — good)
- Structured data `name`: `"PatchFlow"` with `description` including
  "self-healing API" language (done in `SiteSchema` component).

---

## Content gaps (prioritised)

1. **Blog** — 3 starter posts (see `/docs/distribution.md` for drafts)
2. **`/about`** — builds E-E-A-T (Experience, Expertise, Authoritativeness, Trust) for Google
3. **`/changelog`** — fresh content signal, tells crawlers the product is active
4. **`/use-cases/api-reliability`** — targets solution-aware keywords
5. **Comparison page** — targets high-intent comparison searches

---

## Title tag formula

```
[Target keyword] — [Benefit] | PatchFlow
```

Examples:
- Homepage: `Self-Healing APIs — Chaos Testing & Auto-Fix PRs | PatchFlow`
- Docs: `SDK Documentation — Error Monitoring & Auto-Fix | PatchFlow`
- Pricing: `Pricing — Free API Reliability Testing | PatchFlow`

All must stay under 60 characters for the title shown in SERPs.

---

## Notes on current implementation

- Homepage previously had no explicit `title` or `description` — fixed.
- `pageMetadata()` helper in `src/lib/seo.ts` handles canonical, og:url, og:image for all pages.
- FAQPage JSON-LD exists on the homepage.
- Organization + SoftwareApplication + WebSite JSON-LD added to root layout.
- `llms.txt` added to `public/` for AI answer engines.
