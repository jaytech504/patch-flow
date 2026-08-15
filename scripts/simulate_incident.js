#!/usr/bin/env node
/**
 * PatchFlow Incident Simulator — Node.js
 * =====================================
 * Simulates real production errors captured by the PatchFlow Agent SDK
 * to trigger and test the autonomous fix & draft PR pipeline.
 *
 * Usage:
 *   node scripts/simulate_incident.js --apiKey pf_live_...
 *   node scripts/simulate_incident.js --apiKey pf_live_... --framework nextjs
 */

const https = require('https');
const http = require('http');

const SCENARIOS = {
  nextjs: {
    error_type: 'TypeError',
    error_message: "Cannot read properties of undefined (reading 'title')",
    endpoint: '/api/notes',
    method: 'GET',
    status_code: 500,
    framework: 'nextjs',
    stack_frames: [
      {
        filename: 'src/pages/Notes.tsx',
        lineno: 139,
        function: 'NotesPage',
        context_line: 'const title = note.title;',
      },
    ],
  },
  fastapi: {
    error_type: 'httpx.TimeoutException',
    error_message: 'Timed out waiting for downstream payment gateway',
    endpoint: '/api/payments/charge',
    method: 'POST',
    status_code: 500,
    framework: 'fastapi',
    stack_frames: [
      {
        filename: 'app/services/payment.py',
        lineno: 74,
        function: 'charge_customer',
        context_line: "resp = await client.post('/charges', json=payload)",
      },
    ],
  },
  express: {
    error_type: 'UnhandledPromiseRejection',
    error_message: 'Unhandled rejection in async handler: User not found in database',
    endpoint: '/api/users/profile',
    method: 'GET',
    status_code: 500,
    framework: 'express',
    stack_frames: [
      {
        filename: 'src/routes/users.js',
        lineno: 48,
        function: 'getUserProfile',
        context_line: 'const profile = await db.findUser(req.params.id);',
      },
    ],
  },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const parsed = {
    host: 'http://localhost:8000',
    framework: 'nextjs',
    count: 3,
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--apiKey' || args[i] === '--api-key') parsed.apiKey = args[++i];
    else if (args[i] === '--host') parsed.host = args[++i];
    else if (args[i] === '--framework') parsed.framework = args[++i];
    else if (args[i] === '--count') parsed.count = parseInt(args[++i], 10) || 3;
  }
  return parsed;
}

function request(urlStr, options = {}, data = null) {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const body = data ? JSON.stringify(data) : null;
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: options.method || 'GET',
      headers: {
        ...(options.headers || {}),
        ...(body ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } : {}),
      },
    };

    const req = lib.request(reqOptions, (res) => {
      let resBody = '';
      res.on('data', (c) => (resBody += c));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(resBody);
        } catch {
          json = { raw: resBody };
        }
        resolve({ status: res.statusCode, data: json });
      });
    });

    req.on('error', (err) => resolve({ status: 0, data: { error: err.message } }));
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const config = parseArgs();
  if (!config.apiKey) {
    console.error('❌ Error: Missing --apiKey parameter.');
    console.error('Usage: node scripts/simulate_incident.js --apiKey pf_live_...');
    process.exit(1);
  }

  const host = config.host.replace(/\/$/, '');
  console.log('\n' + '='.repeat(60));
  console.log('  🚀 PatchFlow Incident Simulator (Node.js)');
  console.log(`  Target Host: ${host}`);
  console.log(`  Framework:   ${config.framework}`);
  console.log(`  Key Prefix:  ${config.apiKey.slice(0, 14)}...`);
  console.log(`  Occurrences: ${config.count}`);
  console.log('='.repeat(60) + '\n');

  // Ping
  console.log(' [1/3] Testing SDK Connection with Heartbeat Ping...');
  const ping = await request(`${host}/api/sdk/ping`, {
    method: 'POST',
    headers: { 'X-PatchFlow-Key': config.apiKey },
  });

  if (ping.status !== 200) {
    console.error(` ❌ Ping failed (HTTP ${ping.status}):`, ping.data);
    process.exit(1);
  }

  console.log(` ✅ SDK Connected! Monitored Site: '${ping.data.site || 'Demo'}'\n`);

  // Send errors
  const scenario = SCENARIOS[config.framework] || SCENARIOS.nextjs;
  console.log(` [2/3] Dispatching ${config.count} Simulated Error Events...`);

  for (let i = 1; i <= config.count; i++) {
    const res = await request(`${host}/api/sdk/errors`, {
      method: 'POST',
      headers: { 'X-PatchFlow-Key': config.apiKey },
    }, scenario);

    if (res.status === 200) {
      const triggered = res.data.pipeline_triggered ? '🔥 [PIPELINE TRIGGERED]' : `[${res.data.occurrence || i}/3]`;
      console.log(`   → Event ${i}/${config.count}: Received. ${triggered}`);
    } else {
      console.log(`   → Event ${i}/${config.count}: Failed (HTTP ${res.status}):`, res.data);
    }
  }

  console.log('\n [3/3] Done! Check /incidents in your PatchFlow dashboard.\n');
}

main();
