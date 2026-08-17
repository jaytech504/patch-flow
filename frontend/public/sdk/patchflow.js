/**
 * PatchFlow Agent SDK — Node.js & Edge Runtime
 * ============================================
 *
 * Universal one-line error monitoring for Next.js (App Router, Pages Router,
 * Middleware, Edge Runtime), Express, Hono, NestJS, or any JavaScript / Node app.
 *
 * Usage
 * -----
 * Next.js (instrumentation.ts):
 *   import patchflow from './patchflow';
 *   patchflow.init({ apiKey: process.env.PATCHFLOW_API_KEY });
 *
 * Next.js Route Handler (route.ts):
 *   export const GET = patchflow.wrapNextHandler(async () => { ... });
 *
 * Express:
 *   const patchflow = require('./patchflow');
 *   patchflow.init({ apiKey: process.env.PATCHFLOW_API_KEY });
 *   app.use(patchflow.expressMiddleware());
 *
 * Manual:
 *   try { riskyCode() } catch (e) { await patchflow.captureException(e) }
 */

'use strict';

const SDK_VERSION = '0.1.0';
const DEFAULT_HOST = 'https://patchflow-backend-xax6.onrender.com';

// ── Singleton ─────────────────────────────────────────────────────────────────

let _instance = null;

/**
 * Initialise the PatchFlow SDK.
 *
 * @param {object} options
 * @param {string}  options.apiKey        - Your site API key (pf_live_...)
 * @param {string}  [options.host]        - PatchFlow API host
 * @param {string}  [options.environment] - Environment name (default: 'production')
 * @param {boolean} [options.debug]       - Print debug logs
 * @returns {PatchFlow}
 */
function init({ apiKey, host, environment, debug = false } = {}) {
  const envHost = typeof process !== 'undefined' && process.env ? process.env.PATCHFLOW_HOST : undefined;
  const envName = typeof process !== 'undefined' && process.env
    ? (process.env.PATCHFLOW_ENV || process.env.NODE_ENV)
    : undefined;

  _instance = new PatchFlow({
    apiKey,
    host: host || envHost || DEFAULT_HOST,
    environment: environment || envName || 'production',
    debug,
  });

  // Install process-level handlers only if running in Node.js environment
  _installProcessHandlers(_instance);

  // Automatically send non-blocking startup heartbeat to mark SDK as active in dashboard
  _instance.ping();

  if (debug) {
    console.log(`[PatchFlow] Initialised. host=${_instance.host} env=${_instance.environment}`);
  }

  return _instance;
}

// ── Universal HTTP Dispatcher (Fetch-based, 100% Webpack & Edge Safe) ─────────

async function _dispatchHttp(urlStr, headers, bodyStr, timeoutMs = 10000) {
  try {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    const res = await fetch(urlStr, {
      method: 'POST',
      headers: headers || {},
      body: bodyStr || undefined,
      signal: controller ? controller.signal : undefined,
    });
    if (timer) clearTimeout(timer);
    return res;
  } catch (_) {
    return null;
  }
}

// ── Core class ────────────────────────────────────────────────────────────────

class PatchFlow {
  constructor({ apiKey, host, environment, debug }) {
    this.apiKey = apiKey || '';
    this.host = (host || DEFAULT_HOST).replace(/\/$/, '');
    this.environment = environment || 'production';
    this.debug = Boolean(debug);
  }

  /**
   * Send a heartbeat ping to confirm connection and mark the SDK as active.
   */
  async ping() {
    if (!this.apiKey) return;
    try {
      const res = await _dispatchHttp(
        `${this.host}/api/sdk/ping`,
        {
          'X-PatchFlow-Key': this.apiKey,
          'User-Agent': `patchflow-node/${SDK_VERSION}`,
        },
        null,
        5000
      );
      if (this.debug) {
        console.log('[PatchFlow] Heartbeat ping dispatched:', res?.status || 'ok');
      }
      return res;
    } catch (e) {
      if (this.debug) console.warn('[PatchFlow] Failed to send heartbeat ping:', e);
    }
  }

  /**
   * Capture and send an exception to PatchFlow.
   *
   * @param {Error|any} error
   * @param {object}    [context]
   * @param {string}    [context.endpoint]   - Route path e.g. '/api/users'
   * @param {string}    [context.method]     - HTTP method
   * @param {number}    [context.statusCode] - HTTP status code
   * @param {string}    [context.framework]  - Framework name
   */
  async captureException(error, context = {}) {
    if (!error) return;
    try {
      const payload = buildPayload(error, {
        ...context,
        environment: this.environment,
      });
      return await this._send(payload);
    } catch (e) {
      if (this.debug) console.error('[PatchFlow] Failed to capture exception:', e);
    }
  }

  async _send(payload) {
    if (!this.apiKey) return;
    try {
      const body = JSON.stringify(payload);
      const res = await _dispatchHttp(
        `${this.host}/api/sdk/errors`,
        {
          'Content-Type': 'application/json',
          'X-PatchFlow-Key': this.apiKey,
          'User-Agent': `patchflow-node/${SDK_VERSION}`,
        },
        body,
        10000
      );
      if (this.debug) {
        console.log('[PatchFlow] Error payload dispatched:', res?.status || 'ok');
      }
      return res;
    } catch (e) {
      if (this.debug) console.error('[PatchFlow] Send failed:', e);
    }
  }
}

// ── Payload builder ───────────────────────────────────────────────────────────

function buildPayload(error, context = {}) {
  const errObj = error instanceof Error ? error : new Error(String(error));
  const frames = parseStack(errObj.stack || '');
  const top = frames[frames.length - 1] || {};
  const culprit = context.endpoint || `${top.filename || 'unknown'}:${top.lineno || 0}`;

  return {
    error_type: errObj.name || errObj.constructor?.name || 'Error',
    error_message: (errObj.message || String(errObj)).slice(0, 1000),
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
  if (!stack) return [];
  const lines = stack.split('\n').slice(1);
  const frames = [];
  const atRegex = /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/;

  for (const line of lines) {
    const m = atRegex.exec(line);
    if (m) {
      const [, fn, file, lineno] = m;
      if (file && !file.startsWith('node:') && !file.includes('patchflow.js')) {
        frames.push({
          filename: file,
          lineno: parseInt(lineno, 10) || 0,
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
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.NEXT_RUNTIME || process.env.__NEXT_PROCESSED_ENV) return 'nextjs';
  }
  if (typeof globalThis !== 'undefined' && globalThis.EdgeRuntime) return 'nextjs-edge';
  return 'node';
}

// ── Express middleware ────────────────────────────────────────────────────────

/**
 * Express error-handling middleware.
 * Must be registered AFTER all routes: `app.use(patchflow.expressMiddleware())`
 *
 * @returns {(err: any, req: any, res: any, next: any) => void}
 */
function expressMiddleware() {
  const pf = _requireInstance('expressMiddleware');
  return function patchflowExpressMiddleware(err, req, res, next) {
    try {
      pf.captureException(err, {
        endpoint: req.originalUrl || req.url,
        method: req.method,
        statusCode: res.statusCode >= 400 ? res.statusCode : 500,
        framework: 'express',
      });
    } catch (_) {}
    next(err);
  };
}

// ── Next.js App Router wrapper ────────────────────────────────────────────────

/**
 * Wrap a Next.js App Router handler to capture unhandled errors on Serverless.
 *
 * Usage:
 *   export const GET = patchflow.wrapNextHandler(async (request) => {
 *     return NextResponse.json({ ok: true });
 *   });
 *
 * @template {(...args: any[]) => any} T
 * @param {T} handler
 * @returns {T}
 */
function wrapNextHandler(handler) {
  const pf = _requireInstance('wrapNextHandler');
  /** @type {any} */
  const wrapped = async function (request, context) {
    try {
      return await handler(request, context);
    } catch (err) {
      try {
        const urlStr = request && request.url ? request.url : '';
        const endpoint = urlStr ? new URL(urlStr).pathname : '/crash';
        await pf.captureException(err, {
          endpoint,
          method: request?.method || 'GET',
          statusCode: 500,
          framework: 'nextjs',
        });
      } catch (_) {}
      throw err;
    }
  };
  return /** @type {T} */ (wrapped);
}

// ── Hono middleware ───────────────────────────────────────────────────────────

/**
 * Hono middleware factory.
 * Usage: app.use('*', patchflow.honoMiddleware())
 *
 * @returns {(c: any, next: () => Promise<void>) => Promise<void>}
 */
function honoMiddleware() {
  const pf = _requireInstance('honoMiddleware');
  return async function patchflowHonoMiddleware(c, next) {
    try {
      await next();
    } catch (err) {
      try {
        await pf.captureException(err, {
          endpoint: new URL(c.req.url).pathname,
          method: c.req.method,
          statusCode: 500,
          framework: 'hono',
        });
      } catch (_) {}
      throw err;
    }
  };
}

// ── Process-level fallback (Node.js only) ──────────────────────────────────────

function _installProcessHandlers(pf) {
  if (typeof process === 'undefined' || typeof process.on !== 'function') {
    return; // Skip on Edge Runtime, Web Workers, or browsers
  }
  try {
    process.on('uncaughtException', (err) => {
      pf.captureException(err);
    });

    process.on('unhandledRejection', (reason) => {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      pf.captureException(err);
    });
  } catch (_) {}
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
 * @param {Error|any} error
 * @param {object} [context]
 */
async function captureException(error, context = {}) {
  if (_instance) return await _instance.captureException(error, context);
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
