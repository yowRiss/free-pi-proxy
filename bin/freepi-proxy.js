#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { getFreePiToken, fetchFullStats, fetchAndRecordAd, startServer } from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
Free-PI OpenAI Proxy CLI (freepi-proxy)

Usage:
  freepi-proxy [command] [options]

Commands:
  stats, dashboard        Show current usage, credits & model stats in terminal
  test                    Run self-diagnostics test against proxy

Options:
  -p, --port <port>       Port to listen on (default: 3000 or $PORT)
  -H, --host <host>       Host to bind (default: 0.0.0.0 or $HOST)
  -k, --key <api-key>     Set API key to protect your proxy
  -t, --token <jwt>       Override Free-PI JWT token directly
  --version, -v           Show version
  --help, -h              Show this help message

Web Dashboard:
  When the proxy is running, open http://localhost:3000/dashboard in your browser!

Examples:
  freepi-proxy                 # Run server on port 3000
  freepi-proxy stats           # View terminal dashboard & credits
  freepi-proxy -p 8080 -k 123  # Run with port 8080 and API key
`);
}

function makeProgressBar(percent, length = 20) {
  const filled = Math.round((percent / 100) * length);
  const empty = length - filled;
  return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}

function formatNum(n) {
  if (n === null || n === undefined) return '0';
  return Number(n).toLocaleString();
}

async function showTerminalStats() {
  const token = getFreePiToken();
  if (!token) {
    console.error('❌ Error: No Free-PI token found.');
    console.error('Please login first using `npx free-pi-cli` or set FREEPI_TOKEN.');
    process.exit(1);
  }

  console.log('⏳ Fetching stats from Free-PI backend...\n');
  const data = await fetchFullStats(token);

  if (!data.success) {
    console.error('❌ Failed to fetch stats:', data.error);
    process.exit(1);
  }

  const u = data.user || {};
  const c = data.credits || {};
  const ut = data.usage_today || {};
  const lt = data.lifetime || {};
  const models = data.models || [];

  const freeModels = models.filter(m => m.free);

  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║                   ⚡ FREE-PI USAGE & CREDITS                      ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log(`👤 User:       @${u.handle} (Tier: ${u.tier.toUpperCase()} | Lane: ${u.lane})`);
  console.log(`🕒 Refill At:  ${c.refill_at ? new Date(c.refill_at).toLocaleString() : 'Midnight UTC'}`);
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log('💳 CREDITS & ALLOWANCE TODAY:');
  console.log(`   Allowance:  ${formatNum(c.allowance)} credits/day`);
  console.log(`   Remaining:  ${formatNum(c.remaining)} credits (${c.percent_left}%) ${makeProgressBar(c.percent_left)}`);
  console.log(`   Used Today: ${formatNum(c.used_today)} credits`);
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log('📊 USAGE TODAY:');
  console.log(`   Requests:   ${formatNum(ut.requests)} requests`);
  console.log(`   Tokens:     ${formatNum(ut.prompt_tokens)} in / ${formatNum(ut.completion_tokens)} out`);
  console.log(`   Total:      ${formatNum(ut.total_tokens)} tokens`);
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log('📈 LIFETIME VOLUME:');
  console.log(`   Requests:   ${formatNum(lt.requests)} requests`);
  console.log(`   Tokens:     ${formatNum(lt.total_tokens)} tokens (${formatNum(lt.prompt_tokens)} prompt / ${formatNum(lt.completion_tokens)} output)`);
  console.log(`   Total Cost: $${(lt.spent_usd || 0).toFixed(2)} USD (100% Covered by Free-PI)`);
  console.log('─────────────────────────────────────────────────────────────────────');
  console.log(`🤖 AVAILABLE MODELS (${models.length} Total):`);
  console.log('   🔥 Free Unlimited:');
  freeModels.slice(0, 6).forEach(m => {
    console.log(`      • \x1b[32m${m.id}\x1b[0m - ${m.display_name || m.name}`);
  });
  if (models.length > freeModels.length) {
    console.log(`   🛡️ Defense & Other Models: ${models.length - freeModels.length} models`);
  }
  const ad = await fetchAndRecordAd('cli_stats');
  if (ad && ad.creative) {
    console.log('─────────────────────────────────────────────────────────────────────');
    console.log('📢 ACTIVE SPONSOR (Impression Verified):');
    console.log(`   \x1b[1m${ad.creative.headline}\x1b[0m`);
    console.log(`   ${ad.creative.body}`);
    console.log(`   👉 ${ad.creative.cta}: \x1b[34m${ad.click_url}\x1b[0m`);
  }
  console.log('═════════════════════════════════════════════════════════════════════');
  console.log('💡 TIP: Run `freepi-proxy` to start the server, then visit:');
  console.log('   👉 http://localhost:3000/dashboard for the interactive Web UI!\n');
}

// Check commands
const firstArg = args[0];
if (firstArg === 'stats' || firstArg === 'dashboard' || firstArg === '--stats' || firstArg === '--dashboard') {
  await showTerminalStats();
  process.exit(0);
}

if (firstArg === 'test' || firstArg === '--test') {
  const testProc = spawn(process.execPath, [path.join(rootDir, 'test.js')], {
    stdio: 'inherit',
    env: process.env
  });
  testProc.on('exit', code => process.exit(code || 0));
  await new Promise(() => {});
}

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') {
    printHelp();
    process.exit(0);
  }
  if (arg === '--version' || arg === '-v') {
    console.log('freepi-proxy v1.0.0');
    process.exit(0);
  }
  if (arg === '-p' || arg === '--port') {
    process.env.PORT = args[++i];
  } else if (arg === '-H' || arg === '--host') {
    process.env.HOST = args[++i];
  } else if (arg === '-k' || arg === '--key') {
    process.env.PROXY_API_KEY = args[++i];
  } else if (arg === '-t' || arg === '--token') {
    process.env.FREEPI_TOKEN = args[++i];
  }
}

// Start the proxy server
startServer(process.env.PORT ? parseInt(process.env.PORT, 10) : undefined, process.env.HOST);
