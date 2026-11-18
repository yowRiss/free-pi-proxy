#!/usr/bin/env node

/**
 * Free-PI OpenAI-Compatible Proxy Server
 * 
 * Exposes Free-PI models as a standard OpenAI API compatible endpoint,
 * with built-in Web & CLI Dashboard for usage, credits, and model monitoring.
 * Zero external dependencies (pure Node.js).
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const BACKEND_BASE = (process.env.FREEPI_BASE_URL || 'https://api.freepi.ai').replace(/\/+$/, '');
const CLIENT_VERSION = process.env.FREEPI_CLIENT_VERSION || '0.6.23';
const PROXY_API_KEY = process.env.PROXY_API_KEY || ''; // Optional security key for this proxy

// Path to credentials
const CREDENTIALS_PATH = process.env.FREEPI_CREDENTIALS_PATH || path.join(os.homedir(), '.free-pi', 'agent', 'credentials.json');

// Cache for models & stats
let cachedModels = null;
let lastModelFetch = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

export function getFreePiToken() {
  if (process.env.FREEPI_TOKEN) {
    return process.env.FREEPI_TOKEN.trim();
  }
  try {
    if (fs.existsSync(CREDENTIALS_PATH)) {
      const raw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
      const data = JSON.parse(raw);
      if (data && data.token) {
        return data.token;
      }
    }
  } catch (err) {
    console.error(`[Error] Failed to read token from ${CREDENTIALS_PATH}:`, err.message);
  }
  return null;
}

export async function fetchModels(token) {
  const now = Date.now();
  if (cachedModels && (now - lastModelFetch < CACHE_TTL_MS)) {
    return cachedModels;
  }

  try {
    const headers = { 'x-client-version': CLIENT_VERSION };
    if (token) {
      headers['authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${BACKEND_BASE}/client-version`, { headers });
    if (!res.ok) {
      throw new Error(`Backend returned status ${res.status}`);
    }
    const data = await res.json();
    const rawModels = data.models || [];
    
    // Format into standard OpenAI model list
    cachedModels = rawModels.map(m => ({
      id: m.id,
      object: 'model',
      created: Math.floor(now / 1000),
      owned_by: 'free-pi',
      permission: [],
      root: m.id,
      parent: null,
      display_name: m.display_name || m.name,
      name: m.name,
      free: m.free ?? true,
      section: m.section || 'main',
      usage_x: m.usage_x || null
    }));
    lastModelFetch = now;
    return cachedModels;
  } catch (err) {
    console.error('[Error] Failed to fetch models:', err.message);
    if (cachedModels) return cachedModels;
    return [
      { id: 'deepseek-v4-flash', object: 'model', display_name: 'DeepSeek V4 Flash', free: true },
      { id: 'deepseek-v4.1-flash', object: 'model', display_name: 'DeepSeek V4.1 Flash', free: true },
      { id: 'particle', object: 'model', display_name: 'Particle-1', free: true },
      { id: 'glm-5.3-flash', object: 'model', display_name: 'GLM 5.3 Flash', free: true }
    ];
  }
}

export async function fetchFullStats(token) {
  try {
    const headers = {
      'x-client-version': CLIENT_VERSION
    };
    if (token) {
      headers['authorization'] = `Bearer ${token}`;
    }

    const [statsRes, models] = await Promise.all([
      fetch(`${BACKEND_BASE}/me/stats`, { headers }),
      fetchModels(token)
    ]);

    let stats = {};
    if (statsRes.ok) {
      stats = await statsRes.json();
    }

    const allowance = stats.allowance_credits ?? 15000;
    const remaining = stats.remaining_credits_today ?? allowance;
    const usedToday = Math.max(0, allowance - remaining);
    const percentLeft = allowance > 0 ? ((remaining / allowance) * 100).toFixed(1) : 100;

    return {
      success: true,
      timestamp: new Date().toISOString(),
      user: {
        id: stats.user_id || 'unknown',
        handle: stats.handle || 'user',
        tier: stats.tier || 'established',
        lane: stats.lane || 'standard',
        streak: stats.streak || { days: 0 }
      },
      credits: {
        allowance: allowance,
        remaining: remaining,
        used_today: usedToday,
        percent_left: parseFloat(percentLeft),
        refill_at: stats.refill_at || null,
        bonus_credits: stats.bonus_credits || 0,
        bonus_wallet_credits: stats.bonus_wallet_credits || 0,
        premium_credits: stats.premium_credits || 0,
        credit_usd: stats.credit_usd || 0
      },
      usage_today: {
        requests: stats.request_count_today || 0,
        prompt_tokens: stats.prompt_tokens_today || 0,
        completion_tokens: stats.completion_tokens_today || 0,
        total_tokens: (stats.prompt_tokens_today || 0) + (stats.completion_tokens_today || 0),
        spent_usd: stats.spent_usd_today || 0
      },
      lifetime: {
        requests: stats.lifetime?.request_count || stats.request_count_today || 0,
        prompt_tokens: stats.lifetime?.prompt_tokens || stats.prompt_tokens_today || 0,
        completion_tokens: stats.lifetime?.completion_tokens || stats.completion_tokens_today || 0,
        total_tokens: ((stats.lifetime?.prompt_tokens || 0) + (stats.lifetime?.completion_tokens || 0)) || 0,
        spent_usd: stats.lifetime?.spent_usd || 0
      },
      models: models
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      models: await fetchModels(token)
    };
  }
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with'
  });
  res.end(JSON.stringify(data));
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(html);
}

function handleCors(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-requested-with',
      'Access-Control-Max-Age': '86400'
    });
    res.end();
    return true;
  }
  return false;
}

function checkAuth(req, res) {
  if (!PROXY_API_KEY) {
    return true; // No auth required if PROXY_API_KEY not configured
  }
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (token !== PROXY_API_KEY) {
    sendJson(res, 401, {
      error: {
        message: 'Invalid or missing API key for proxy.',
        type: 'invalid_request_error',
        code: 'invalid_api_key'
      }
    });
    return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  if (handleCors(req, res)) return;

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const accept = req.headers.accept || '';

  // 1. Dashboard Web UI (HTML)
  if (req.method === 'GET' && (pathname === '/dashboard' || (pathname === '/' && accept.includes('text/html')))) {
    try {
      const htmlPath = path.join(__dirname, 'dashboard.html');
      if (fs.existsSync(htmlPath)) {
        const html = fs.readFileSync(htmlPath, 'utf-8');
        return sendHtml(res, 200, html);
      }
    } catch (err) {
      console.error('Failed to load dashboard.html:', err);
    }
  }

  // 2. Dashboard Stats JSON Endpoint
  if (req.method === 'GET' && (pathname === '/api/stats' || pathname === '/stats')) {
    const token = getFreePiToken();
    const stats = await fetchFullStats(token);
    return sendJson(res, 200, stats);
  }

  // 3. Root JSON status
  if (req.method === 'GET' && pathname === '/') {
    const token = getFreePiToken();
    const models = await fetchModels(token);
    return sendJson(res, 200, {
      status: 'online',
      service: 'Free-PI OpenAI-Compatible Proxy',
      dashboard: `http://${req.headers.host || 'localhost'}/dashboard`,
      authenticated_to_freepi: Boolean(token),
      auth_required_for_clients: Boolean(PROXY_API_KEY),
      endpoints: [
        'GET /dashboard (Web UI)',
        'GET /api/stats (Usage & Credits Data)',
        'GET /v1/models',
        'POST /v1/chat/completions'
      ],
      available_models_count: models.length,
      sample_models: models.slice(0, 5).map(m => m.id)
    });
  }

  // Check custom proxy auth for /v1 endpoints
  if (pathname.startsWith('/v1') && !checkAuth(req, res)) {
    return;
  }

  const token = getFreePiToken();
  if (!token) {
    return sendJson(res, 500, {
      error: {
        message: 'No Free-PI token found. Make sure you logged in with `npx free-pi-cli` or set FREEPI_TOKEN.',
        type: 'server_error'
      }
    });
  }

  // GET /v1/models or GET /models
  if (req.method === 'GET' && (pathname === '/v1/models' || pathname === '/models')) {
    const models = await fetchModels(token);
    return sendJson(res, 200, {
      object: 'list',
      data: models
    });
  }

  // POST /v1/chat/completions or POST /chat/completions
  if (req.method === 'POST' && (pathname === '/v1/chat/completions' || pathname === '/chat/completions')) {
    let bodyChunks = [];
    req.on('data', chunk => bodyChunks.push(chunk));
    req.on('end', async () => {
      try {
        const rawBody = Buffer.concat(bodyChunks).toString('utf-8');
        let parsedBody;
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          return sendJson(res, 400, {
            error: {
              message: 'Invalid JSON body',
              type: 'invalid_request_error'
            }
          });
        }

        const isStream = Boolean(parsedBody.stream);

        // Forward to Free-PI backend
        const backendRes = await fetch(`${BACKEND_BASE}/v1/chat/completions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${token}`,
            'x-client-version': CLIENT_VERSION
          },
          body: JSON.stringify(parsedBody)
        });

        if (!backendRes.ok) {
          const errText = await backendRes.text();
          let errJson;
          try { errJson = JSON.parse(errText); } catch { errJson = { error: { message: errText } }; }
          return sendJson(res, backendRes.status, errJson);
        }

        // Handle streaming response
        if (isStream) {
          res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
          });

          const reader = backendRes.body.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          res.end();
        } else {
          // Handle standard JSON response
          const json = await backendRes.json();
          return sendJson(res, 200, json);
        }
      } catch (err) {
        console.error('[Error] Proxy request failed:', err);
        return sendJson(res, 502, {
          error: {
            message: `Proxy failed to connect to Free-PI backend: ${err.message}`,
            type: 'bad_gateway'
          }
        });
      }
    });
    return;
  }

  // Fallback 404
  return sendJson(res, 404, {
    error: {
      message: `Endpoint ${req.method} ${pathname} not found`,
      type: 'invalid_request_error'
    }
  });
});

// Server starter
export function startServer(port = PORT, host = HOST) {
  server.listen(port, host, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Free-PI OpenAI Proxy Server running!`);
    console.log(`📍 Local address: http://${host}:${port}`);
    console.log(`📊 Web Dashboard: http://${host}:${port}/dashboard`);
    console.log(`🔗 Base URL:      http://localhost:${port}/v1`);
    console.log(`🔒 Proxy Auth:    ${PROXY_API_KEY ? 'Enabled (API Key set)' : 'Disabled (Open/Public)'}`);
    console.log(`=======================================================`);
  });
  return server;
}

// Auto-start if executed directly via `node server.js`
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  startServer();
}

export default server;
