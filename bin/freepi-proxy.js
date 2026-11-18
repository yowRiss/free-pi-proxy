#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);

function printHelp() {
  console.log(`
Free-PI OpenAI Proxy CLI (freepi-proxy)

Usage:
  freepi-proxy [options]

Options:
  -p, --port <port>       Port to listen on (default: 3000 or $PORT)
  -h, --host <host>       Host to bind (default: 0.0.0.0 or $HOST)
  -k, --key <api-key>     Set API key to protect your proxy
  -t, --token <jwt>       Override Free-PI JWT token directly
  --test                  Run diagnostic test against running proxy
  --version, -v           Show version
  --help                  Show this help message

Examples:
  freepi-proxy
  freepi-proxy -p 8080
  freepi-proxy -p 3000 -k my-secret-password
  freepi-proxy --test
`);
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
  if (arg === '--test') {
    const testProc = spawn(process.execPath, [path.join(rootDir, 'test.js')], {
      stdio: 'inherit',
      env: process.env
    });
    testProc.on('exit', code => process.exit(code || 0));
    // stop here
    await new Promise(() => {});
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

// Launch server.js
await import(path.join(rootDir, 'server.js'));
