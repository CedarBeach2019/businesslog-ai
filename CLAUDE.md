# CLAUDE.md — BusinessLog.ai

## Project Overview

BusinessLog.ai is a Business Operations AI platform, part of the Cocapn ecosystem (cocapn.ai). It functions as an AI-powered business assistant providing CRM, meeting simulation, scheduling, invoicing, project management, lead scoring, analytics, and email management — all through a conversational interface.

Built as a single Cloudflare Worker with BYOK (Bring Your Own Key) LLM routing, allowing users to plug in their own API keys for OpenAI, Anthropic, Google, Mistral, Groq, DeepSeek, or Cloudflare Workers AI.

GitHub Organization: **Lucineer**

## Architecture

```
src/
├── worker.ts          # Cloudflare Worker entry — all routes, inline HTML
├── lib/
│   └── byok.ts        # BYOK LLM routing (503 lines, 7 providers)
├── modules/
│   ├── crm.ts
│   ├── meeting-simulator.ts
│   ├── scheduler.ts
│   ├── invoice.ts
│   ├── project-manager.ts
│   ├── lead-scorer.ts
│   ├── analytics-engine.ts
│   ├── email-manager.ts
│   └── dashboard.ts
└── types.ts           # Shared TypeScript interfaces
```

**Request flow:** User → Cloudflare Worker → Route matching → Module logic → BYOK LLM call (if needed) → Response

**BYOK config discovery priority:** URL params → Authorization header → Cookie → KV store → fail with setup prompt

**KV Binding:** `BUSINESSLOG_MEMORY` — stores user configurations, session data, and conversation history.

## Key Commands

```bash
wrangler dev          # Local development server
wrangler deploy       # Deploy to Cloudflare Workers
wrangler tail         # Real-time log streaming
git push              # Deploy via CI (if configured)
```

## Code Style & Conventions

- **TypeScript throughout** — strict mode, no build step
- **Zero runtime dependencies** for MVP — no npm packages in worker bundle
- **All HTML is inline** in worker.ts via template literals — no ASSETS binding, no static file serving
- **Single-file entry point** — worker.ts handles all routing and HTML rendering
- **Commits attributed to:** "Author: Superinstance"
- **Brand colors:** blue-teal palette, accent `#3b82f6`
- **Naming:** kebab-case for files, camelCase for functions, PascalCase for types/interfaces
- **Error handling:** always return user-friendly messages, never expose internals

## Testing Approach

- Manual testing via `wrangler dev` and browser
- Test BYOK flow with each provider's API key
- Verify `/health` endpoint returns expected status
- Confirm config discovery chain works across all 5 methods
- No automated test framework in MVP — validate routes manually before deploy

## Important File Paths

| Path | Purpose |
|------|---------|
| `src/worker.ts` | Worker entry point, all routes, inline HTML |
| `src/lib/byok.ts` | BYOK module — 7 LLM providers, config discovery |
| `src/modules/*.ts` | Business operation modules |
| `src/types.ts` | Shared type definitions |
| `wrangler.toml` | Cloudflare Worker configuration |
| `CLAUDE.md` | This file |

## Routes

| Route | Purpose |
|-------|---------|
| `/` | Main app (inline HTML) |
| `/health` | Health check endpoint |
| `/setup` | BYOK key configuration page |
| `/api/chat` | Chat/completion endpoint |
| `/api/byok` | BYOK config management |
| `/public/*` | Public asset routes |

## What NOT to Change

- **BYOK module structure** — the config discovery chain (URL params → Auth header → Cookie → KV → fail) is load-bearing and tested across all providers
- **Inline HTML pattern** — no ASSETS binding, no separate HTML files, no build step
- **Zero-dependency constraint** — do not add npm packages without explicit approval
- **KV binding name** — `BUSINESSLOG_MEMORY` is hardcoded and provisioned
- **Provider list in BYOK** — 7 providers (OpenAI, Anthropic, Google, Mistral, Groq, DeepSeek, Cloudflare Workers AI) — extending is fine, modifying existing integration signatures requires care
- **Route structure** — existing `/api/*` routes have downstream consumers

## How to Add New Features

1. **Create a module** in `src/modules/new-feature.ts`
2. **Export functions** with clear TypeScript types
3. **Import in worker.ts** — add the import at the top
4. **Add route handler** in the router section of worker.ts
5. **Update inline HTML** if the feature needs UI — add to the appropriate template literal
6. **Test locally** with `wrangler dev`
7. **Deploy** with `wrangler deploy`

Example pattern:
```typescript
// src/modules/new-feature.ts
export async function handleNewFeature(request: Request, env: Env): Promise<Response> {
  // Module logic here
  return new Response(JSON.stringify({ status: 'ok' }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

// In src/worker.ts — add to router:
if (url.pathname === '/api/new-feature') return handleNewFeature(request, env);
```

## Deployment

1. Ensure `wrangler.toml` has correct account_id and KV namespace bindings
2. Run `wrangler deploy` — no build step needed
3. Verify `/health` returns 200 on production URL
4. BYOK keys are user-provided — no server-side secrets to manage for LLM access
5. Cloudflare account needs Workers AI enabled if supporting that provider

## Ecosystem Links

BusinessLog.ai is part of the **Cocapn** ecosystem:

- **cocapn.ai** — Main ecosystem hub
- **Lucineer** (GitHub org) — All *log.ai repositories
- Sister products follow the `*log.ai` naming convention
- Shared design language: blue-teal accent, conversational AI interfaces
- Cross-product BYOK configuration may be shared in future iterations

## Project Stats

- 33 TypeScript files
- 7 supported LLM providers
- ~10 business operation modules
- Single Cloudflare Worker deployment
- Zero runtime dependencies

---

*Commits: Author: Superinstance*
*Part of cocapn.ai by Lucineer*
