<div align="center">

# ⚡ Free-PI Proxy

**Turn your Free-PI AI models into an OpenAI-compatible REST API with a built-in monitoring dashboard.**

[![GitHub license](https://img.shields.io/github/license/yowRiss/free-pi-proxy?style=flat-square)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen?style=flat-square)](https://nodejs.org)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0%20(Pure%20Node.js)-blue?style=flat-square)](package.json)
[![OpenAI Compatible](https://img.shields.io/badge/API-OpenAI%20Compatible-orange?style=flat-square)](https://platform.openai.com/docs/api-reference)

[Features](#-features) •
[Quick Start](#-quick-start) •
[Dashboard](#-monitoring-dashboard) •
[Remote Access](#-access-from-anywhere-public-url) •
[Client Integrations](#-client-integrations) •
[Configuration](#-configuration)

</div>

---

## 📖 Overview

`free-pi-proxy` is a lightweight, zero-dependency proxy server that connects to the `free-pi-cli` backend and exposes all models (`deepseek-v4-flash`, `deepseek-v4.1-flash`, `particle`, `glm-5.3-flash`, etc.) as a standard **OpenAI-Compatible REST API**.

It allows you to use your free daily AI inference allowance inside **any** application that supports OpenAI API keys and base URLs, including **Cursor, VS Code (Continue.dev / Cline), NextChat, LibreChat, Chatbox**, or directly in **Python and TypeScript**.

---

## ✨ Features

- **🔌 OpenAI Standard Compatible**: Implements `/v1/chat/completions` (streaming & non-streaming) and `/v1/models`.
- **⚡ Server-Sent Events (SSE)**: Native streaming support with smooth token delivery.
- **🚦 Single-Flight Gate & Queue**: Serializes parallel requests internally to strictly respect Free-PI's "one request at a time" limit, preventing `HTTP 429 concurrent` errors during multi-agent tool calls.
- **💾 Persistent Session ID**: Persists `x-session-id` in `.session-id` across restarts, eliminating `HTTP 409 concurrent_session` slot exhaustion.
- **⏳ Exponential Backoff Retry**: Auto-retries 429 rate limits (3s → 60s, up to ~2.5 minutes) and 403 `ads_required` with impression refreshes.
- **📢 Automated Ad Verification & Dashboard Banner**: Automatically pulls Free-PI ads, records impressions 24/7 in the background, and displays live sponsor banners in both the Web Dashboard and CLI.
- **📊 Built-in Web & CLI Dashboard**:
  - **Web UI** (`/dashboard`): Track credit allowance, usage history, token metrics, model catalog, live sponsor ads, and test prompts in an interactive playground.
  - **Terminal CLI** (`freepi-proxy stats`): Instant CLI summary of today's credits, token consumption, and active sponsor.
- **🔑 Automatic Credential Discovery**: Automatically reads your active session token from `~/.free-pi/agent/credentials.json`.
- **🛡️ Secure Gateway**: Optional `PROXY_API_KEY` protection to prevent unauthorized usage when exposed to the internet.
- **🌐 Zero Dependencies**: Built entirely with native Node.js (`node:http`, `fetch`, ESM) — no `npm install` needed.
- **🐳 Container Ready**: Includes a lightweight Alpine-based `Dockerfile`.

---

## 🚀 Quick Start

### 1. Prerequisites
Ensure you have authenticated with `free-pi-cli` at least once:
```bash
npx free-pi-cli
```

### 2. Run the Proxy
Run directly using the global command:
```bash
freepi-proxy
```
Or start via Node:
```bash
cd /path/to/free-pi-proxy
node server.js
```

The proxy will boot up on `http://localhost:3000`:
- **OpenAI Base URL:** `http://localhost:3000/v1`
- **Web Dashboard:** `http://localhost:3000/dashboard`

---

## 📊 Monitoring Dashboard

### Web Dashboard
Open `http://localhost:3000/dashboard` in any browser to access:
- **Daily Allowance Tracker**: View remaining credits vs. total daily budget (e.g. 15,000 / 15,000) with a live progress bar and UTC reset timer.
- **Token Analytics**: Real-time breakdown of today's input/output tokens and lifetime request count.
- **Model Explorer**: Searchable directory of all 18 available Free-PI models (*Free Unlimited, Standard, Defense*).
- **Interactive Playground**: Test model output with real-time streaming directly in the UI.

### Terminal Dashboard
Check your balance and token usage directly from your CLI anytime:
```bash
freepi-proxy stats
```

```text
╔═══════════════════════════════════════════════════════════════════╗
║                   ⚡ FREE-PI USAGE & CREDITS                      ║
╚═══════════════════════════════════════════════════════════════════╝
👤 User:       @yowRiss (Tier: ESTABLISHED | Lane: standard)
🕒 Refill At:  11/19/2026, 8:00:00 AM
─────────────────────────────────────────────────────────────────────
💳 CREDITS & ALLOWANCE TODAY:
   Allowance:  15,000 credits/day
   Remaining:  15,000 credits (100%) [████████████████████]
   Used Today: 0 credits
─────────────────────────────────────────────────────────────────────
📊 USAGE TODAY:
   Requests:   14 requests
   Tokens:     102,156 in / 2,090 out
   Total:      104,246 tokens
─────────────────────────────────────────────────────────────────────
🤖 AVAILABLE MODELS (18 Total):
   🔥 Free Unlimited:
      • particle - Particle-1
      • deepseek-v4.1-flash - DeepSeek V4.1 Flash
      • glm-5.3-flash - GLM 5.3 Flash
      • deepseek-v4-flash - DeepSeek V4 Flash
```

---

## 🌐 Access From Anywhere (Public URL)

To access your proxy from remote machines, mobile devices, or cloud platforms:

### Option A: Cloudflare Tunnel (Free & Recommended)
Expose your local proxy securely through HTTPS without opening ports:

1. Download the `cloudflared` CLI:
   ```bash
   curl -L -o cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
   chmod +x cloudflared
   ```
2. Start the tunnel pointing to port 3000:
   ```bash
   ./cloudflared tunnel --url http://localhost:3000
   ```
3. Copy your unique generated HTTPS URL (e.g. `https://random-subdomain.trycloudflare.com`).
4. Your public OpenAI Base URL is now:
   ```text
   https://random-subdomain.trycloudflare.com/v1
   ```

### Option B: Docker / VPS Deployment
Run on any Linux VPS or server using Docker:
```bash
docker build -t free-pi-proxy .
docker run -d -p 3000:3000 \
  -e FREEPI_TOKEN="your_jwt_token_here" \
  -e PROXY_API_KEY="your_secret_password" \
  free-pi-proxy
```

---

## 🔒 Security (Proxy API Key)

When making the proxy accessible over the internet, protect it by setting a secret API key:

```bash
freepi-proxy -k "my-secret-key-123"
```
Any client calling the proxy must then supply:
`Authorization: Bearer my-secret-key-123`

---

## 💻 Client Integrations

### Python (OpenAI SDK)
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",  # or your Cloudflare Tunnel URL
    api_key="my-secret-key-123"           # or any dummy string if key is disabled
)

response = client.chat.completions.create(
    model="deepseek-v4-flash",
    messages=[
        {"role": "user", "content": "Explain quantum computing in two sentences."}
    ]
)

print(response.choices[0].message.content)
```

### TypeScript / JavaScript (Streaming)
```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "http://localhost:3000/v1",
  apiKey: "my-secret-key-123"
});

const stream = await openai.chat.completions.create({
  model: "deepseek-v4-flash",
  messages: [{ role: "user", content: "Write a haiku about coding." }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}
```

### cURL
```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer my-secret-key-123" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### GUI Clients (NextChat, Chatbox, Cursor, Continue.dev)
- **API Base URL / Host**: `http://localhost:3000/v1` (or your tunnel URL)
- **API Key**: Your configured `PROXY_API_KEY` (or any string if unconfigured)
- **Model**: `deepseek-v4-flash`, `deepseek-v4.1-flash`, `particle`, or `glm-5.3-flash`

---

## ⚙️ Configuration

### CLI Options
| Flag | Description | Default |
|---|---|---|
| `-p, --port <number>` | Port to listen on | `3000` |
| `-H, --host <string>` | Host address to bind | `0.0.0.0` |
| `-k, --key <string>` | Secret key to protect the proxy | None (Public) |
| `-t, --token <jwt>` | Explicit Free-PI JWT token | Auto-detected |
| `stats, dashboard` | View CLI usage & credit summary | - |
| `reset-session` | Free stuck sessions on backend (`/session/reset`) | - |
| `test, --test` | Run diagnostic self-test | - |
| `-v, --version` | Display version | - |
| `-h, --help` | Display help screen | - |

### Environment Variables
| Variable | Description |
|---|---|
| `PORT` | Listening port (default: `3000`) |
| `HOST` | Listening host (default: `0.0.0.0`) |
| `PROXY_API_KEY` | Optional bearer token required by incoming client requests |
| `FREEPI_TOKEN` | Manual Free-PI JWT token override |
| `FREEPI_SESSION_ID` | Optional explicit persistent session UUID override |
| `FREEPI_SESSION_FILE` | Path to persistent session ID file (default: `.session-id`) |
| `FREEPI_BASE_URL` | Upstream backend URL (default: `https://api.freepi.ai`) |
| `FREEPI_CLIENT_VERSION` | Client version sent to upstream (default: `0.6.23`) |

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
