<p align="center">
  <img src="https://raw.githubusercontent.com/Lucineer/capitaine/master/docs/capitaine-logo.jpg" alt="Capitaine" width="120">
</p>

<h1 align="center">businesslog-ai</h1>

<p align="center">An autonomous agent for business analysis frameworks.</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#features">Features</a> ·
  <a href="#limitations">Limitations</a>
</p>

---

**Live Instance:** [businesslog-ai](https://businesslog-ai.casey-digennaro.workers.dev)

An agent that applies structured business frameworks—unit economics, TAM/SAM/SOM, Porter's 5 Forces—to your questions. It is a single Cloudflare Worker you fork and run yourself.

---

## Why this exists
Running structured business analysis takes time. This agent provides a consistent, repeatable method to apply known frameworks, reducing the setup time for common strategic and financial models.

## How it works
1.  **Fork-first autonomy.** The repository is a complete agent. When you fork and deploy it, you control the instance.
2.  **No hidden services.** It runs as one Cloudflare Worker with no external runtime dependencies.
3.  **Fleet-native updates.** The agent can receive framework improvements from the Cocapn Fleet protocol without transmitting your data.
4.  **Zero corporate sanitization.** The agent applies frameworks as written, without avoiding critical conclusions.

## Quick Start
```bash
# Fork this repository first, then clone your fork.
git clone https://github.com/your-username/businesslog-ai
cd businesslog-ai

# Deploy to Cloudflare Workers.
npx wrangler deploy
```
Set your LLM API key and optional GitHub token as secrets in the Cloudflare dashboard after deployment. The default configuration uses a free, open-source model endpoint.

## Features
- **Multi-model support:** Works with DeepSeek, SiliconFlow, local endpoints, and other compatible LLM APIs.
- **Session context:** Maintains conversation history within a single browser session.
- **BYOK (Bring Your Own Keys):** All credentials stored in Cloudflare's secret manager.
- **Basic PII safety:** Attempts to redact common sensitive data patterns before external API calls.
- **Configurable rate limits:** Built-in per-IP request limiting.
- **Fleet protocol compatible:** Supports CRP-39 for trust and coordination within the Cocapn Fleet.

## Limitations
This agent applies analytical frameworks based on the information you provide. It does not have real-time market data or the ability to validate the accuracy of your inputs. Its analysis is only as sound as the premises given.

## Architecture
A single Cloudflare Worker (`src/worker.ts`) handles HTTP serving, agent logic, and memory. The codebase is structured for clarity:
- `lib/frameworks.ts`: Contains the core analysis logic and prompts.
- `lib/byok.ts`: Manages multi-model routing and API calls.
- `lib/memory.ts`: Handles in-memory session state (non-persistent).

---

<div align="center">
  <sub>Part of the Cocapn Fleet. Built by <a href="https://superinstance.com">Superinstance</a> & <a href="https://lucineer.com">Lucineer (DiGennaro et al.)</a>.</sub><br>
  <sub><a href="https://the-fleet.casey-digennaro.workers.dev">The Fleet</a> · <a href="https://cocapn.ai">Cocapn</a></sub>
</div>