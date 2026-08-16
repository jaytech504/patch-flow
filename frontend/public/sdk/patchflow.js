/**
 * PatchFlow Agent SDK — Node.js
 * ==============================
 *
 * One-line setup for Express, Next.js App Router, Hono, NestJS, or any Node app.
 *
 * Usage
 * -----
 * Express:
 *   const patchflow = require('./patchflow');
 *   patchflow.init({ apiKey: 'pf_live_...' });
 *   app.use(patchflow.expressMiddleware());          // add after routes
 *
 * Next.js App Router (route.ts):
 *   import patchflow from './patchflow';
 *   patchflow.init({ apiKey: 'pf_live_...' });
 *   export const GET = patchflow.wrapNextHandler(async (request) => { ... });
 *
 * Hono:
 *   import patchflow from './patchflow';
 *   patchflow.init({ apiKey: 'pf_live_...' });
 *   app.use('*', patchflow.honoMiddleware());
 *
 * Manual:
 *   try { riskyCode() } catch (e) { patchflow.captureException(e) }
 */

'use strict';

const https = require('https');
const http = require('http');

const SDK_VERSION = '0.1.0';
const DEFAULT_HOST = 'https://patchflow-backend-xax6.onrender.com';

// ── Singleton ─────────────────────────────────────────────────────────────────

let _instance = null;

/**
 * Initialise the PatchFlow SDK.
 *
 * @param {object} options
 * @param {string}  options.apiKey      - Your site API key (pf_live_...)
 * @param {string}  [options.host]      - PatchFlow API host
 * @param {string}  [options.environment] - Environment name (default: 'production')
 * @param {boolean} [options.debug]     - Print debug logs
 * @returns {PatchFlow}
 */
function init({ apiKey, host, environment, debug = false } = {}) {
  _instance = new PatchFlow({
    apiKey,
    host: host || process.env.PATCHFLOW_HOST || DEFAULT_HOST,
    environment: environment || process.env.PATCHFLOW_ENV || process.env.NODE_ENV || 'production',
    debug,
  });

  // Install global uncaughtException handler as fallback
  _installProcessHandlers(_instance);

  if (debug) {
    console.log(`[PatchFlow] Initialised. host=${_instance.host} env=${_instance.environment}`);
  }

  return _instance;
}

// ── Core class ────────────────────────────────────────────────────────────────

class PatchFlow {
  constructor({ apiKey, host, environment, debug }) {
    this.apiKey = apiKey;
    this.host = host.replace(/\/$/, '');
    this.environment = environment;
    this.debug = debug;
  }

  /**
   * Capture and send an exception to PatchFlow.
   * Non-blocking — uses fire-and-forget HTTP in the background.
   *
   * @param {Error}   error
   * @param {object}  [context]
   * @param {string}  [context.endpoint]   - Route path e.g. '/api/users'
   * @param {string}  [context.method]     - HTTP method
   * @param {number}  [context.statusCode] - HTTP status code
   * @param {string}  [context.framework]  - Framework name
   */
  captureException(error, context = {}) {
    if (!error) return;
    try {
      const payload = buildPayload(error, {
        ...context,
        environment: this.environment,
      });
      this._send(payload);
    } catch (e) {
      if (this.debug) console.error('[PatchFlow] Failed to capture exception:', e);
    }
  }

  _send(payload) {
    const body = JSON.stringify(payload);
    const url = new URL(`${this.host}/api/sdk/errors`);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'X-PatchFlow-Key': this.apiKey,
        'User-Agent': `patchflow-node/${SDK_VERSION}`,
      },
      timeout: 10000,
    };

    const req = lib.request(options, (res) => {
      if (this.debug) {
        console.log(`[PatchFlow] Sent error — status=${res.statusCode}`);
      }
      // Drain response body
      res.resume();
    });

    req.on('error', (e) => {
      if (this.debug) console.error('[PatchFlow] Send failed:', e.message);
    });

    req.write(body);
    req.end();
  }
}

// ── Payload builder ───────────────────────────────────────────────────────────

function buildPayload(error, context = {}) {
  const frames = parseStack(error.stack || '');
  const top = frames[frames.length - 1] || {};
  const culprit = context.endpoint || `${top.filename || ''}:${top.lineno || ''}`;

  return {
    error_type: error.name || error.constructor?.name || 'Error',
    error_message: (error.message || String(error)).slice(0, 1000),
    culprit,
    endpoint: context.endpoint || '',
    method: (context.method || '').toUpperCase(),
    status_code: context.statusCode || null,
    stack_frames: frames,
    framework: context.framework || detectFramework(),
    environment: context.environment || 'production',
    sdk_version: SDK_VERSION,
  };
}

function parseStack(stack) {
  const lines = stack.split('\n').slice(1); // skip first line (error message)
  const frames = [];
  const atRegex = /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/;

  for (const line of lines) {
    const m = atRegex.exec(line);
    if (m) {
      const [, fn, file, lineno] = m;
      // Skip node internals and patchflow itself
      if (file && !file.startsWith('node:') && !file.includes('patchflow.js')) {
        frames.push({
          filename: file,
          lineno: parseInt(lineno, 10),
          function: fn || '<anonymous>',
          context_line: '',
          pre_context: [],
          post_context: [],
          vars: {},
        });
      }
    }
  }
  return frames;
}

function detectFramework() {
  try {
    require.resolve('next');
    return 'nextjs';
  } catch {}
  try {
    require.resolve('express');
    return 'express';
  } catch {}
  try {
    require.resolve('hono');
    return 'hono';
  } catch {}
  try {
    require.resolve('@nestjs/core');
    return 'nestjs';
  } catch {}
  return 'node';
}

// ── Express middleware ────────────────────────────────────────────────────────

/**
 * Express error-handling middleware.
 * Add AFTER all routes: app.use(patchflow.expressMiddleware())
 *
 * @returns {Function} Express error middleware (err, req, res, next)
 */
function expressMiddleware() {
  const pf = _requireInstance('expressMiddleware');
  // Must have 4 params for Express to treat it as error middleware
  // eslint-disable-next-line no-unused-vars
  return function patchflowErrorHandler(err, req, res, next) {
    pf.captureException(err, {
      endpoint: req.path || req.url,
      method: req.method,
      statusCode: res.statusCode || 500,
      framework: 'express',
    });
    next(err);
  };
}

// ── Next.js App Router wrapper ────────────────────────────────────────────────

/**
 * Wrap a Next.js App Router handler to capture unhandled errors.
 *
 * Usage:
 *   export const GET = patchflow.wrapNextHandler(async (request) => {
 *     return NextResponse.json({ ok: true });
 *   });
 *
 * @param {Function} handler - async (request: NextRequest) => NextResponse
 * @returns {Function}
 */
function wrapNextHandler(handler) {
  const pf = _requireInstance('wrapNextHandler');
  return async function wrappedNextHandler(request, context) {
    try {
      return await handler(request, context);
    } catch (err) {
      pf.captureException(err, {
        endpoint: new URL(request.url).pathname,
        method: request.method,
        statusCode: 500,
        framework: 'nextjs',
      });
      throw err;
    }
  };
}

// ── Hono middleware ───────────────────────────────────────────────────────────

/**
 * Hono middleware factory.
 * Usage: app.use('*', patchflow.honoMiddleware())
 *
 * @returns {Function} Hono middleware
 */
function honoMiddleware() {
  const pf = _requireInstance('honoMiddleware');
  return async function patchflowHonoMiddleware(c, next) {
    try {
      await next();
    } catch (err) {
      pf.captureException(err, {
        endpoint: new URL(c.req.url).pathname,
        method: c.req.method,
        statusCode: 500,
        framework: 'hono',
      });
      throw err;
    }
  };
}

// ── process-level fallback ────────────────────────────────────────────────────

function _installProcessHandlers(pf) {
  process.on('uncaughtException', (err) => {
    pf.captureException(err);
    // Give the HTTP call a moment to fire before process potentially exits
    // The default behaviour (crash) is preserved — we don't swallow it.
  });

  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    pf.captureException(err);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function _requireInstance(fnName) {
  if (!_instance) {
    throw new Error(
      `[PatchFlow] Call patchflow.init({ apiKey: '...' }) before using ${fnName}()`
    );
  }
  return _instance;
}

/**
 * Capture an exception using the globally initialised SDK instance.
 * @param {Error} error
 * @param {object} [context]
 */
function captureException(error, context = {}) {
  if (_instance) _instance.captureException(error, context);
}

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  init,
  captureException,
  expressMiddleware,
  wrapNextHandler,
  honoMiddleware,
  PatchFlow,
};

// ESM default export compatibility
module.exports.default = module.exports;
