#!/usr/bin/env node

/**
 * Quick self-test script for Free-PI Proxy
 */

import http from 'node:http';

const PROXY_URL = process.env.TEST_URL || 'http://localhost:3000';
const PROXY_KEY = process.env.PROXY_API_KEY || '';

console.log(`Testing Free-PI Proxy at ${PROXY_URL}...`);

async function runTest() {
  try {
    // 1. Health check
    const health = await fetch(`${PROXY_URL}/`).then(r => r.json());
    console.log('✅ Health check:', health.status);

    // 2. Models
    const modelsRes = await fetch(`${PROXY_URL}/v1/models`, {
      headers: PROXY_KEY ? { 'Authorization': `Bearer ${PROXY_KEY}` } : {}
    });
    const models = await modelsRes.json();
    console.log(`✅ Models loaded (${models.data?.length || 0} models available)`);

    // 3. Chat completion
    console.log('🤖 Sending test prompt to deepseek-v4-flash...');
    const chatRes = await fetch(`${PROXY_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(PROXY_KEY ? { 'Authorization': `Bearer ${PROXY_KEY}` } : {})
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [{ role: 'user', content: 'Reply with "OK" only.' }]
      })
    });

    if (!chatRes.ok) {
      throw new Error(`Chat error: ${chatRes.status} ${await chatRes.text()}`);
    }

    const chatJson = await chatRes.json();
    console.log('✅ Completion Response:', chatJson.choices[0]?.message?.content);
    console.log('\n🎉 ALL TESTS PASSED! Proxy is working perfectly.');
  } catch (err) {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  }
}

runTest();
