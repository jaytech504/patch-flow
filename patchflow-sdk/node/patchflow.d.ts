/**
 * PatchFlow Agent SDK — TypeScript Definitions
 */

export interface PatchFlowInitOptions {
  /** Your site API key from the PatchFlow dashboard (pf_live_...) */
  apiKey: string;
  /** PatchFlow API host (defaults to https://api.patchflow.dev or process.env.PATCHFLOW_HOST) */
  host?: string;
  /** Environment name, e.g. 'production' | 'staging' | 'development' */
  environment?: string;
  /** Print SDK debug logs to stdout */
  debug?: boolean;
}

export interface PatchFlowContext {
  /** Route path e.g. '/api/users' */
  endpoint?: string;
  /** HTTP method, e.g. 'GET' | 'POST' */
  method?: string;
  /** HTTP response status code */
  statusCode?: number;
  /** Framework name e.g. 'nextjs' | 'express' | 'hono' | 'nestjs' */
  framework?: string;
  /** Environment override */
  environment?: string;
  /** Additional custom metadata */
  extra?: Record<string, any>;
}

export class PatchFlow {
  readonly apiKey: string;
  readonly host: string;
  readonly environment: string;
  readonly debug: boolean;

  constructor(options: PatchFlowInitOptions);

  /**
   * Capture and send an exception to PatchFlow in the background.
   */
  captureException(error: Error | any, context?: PatchFlowContext): void;
}

/**
 * Initialise the PatchFlow singleton SDK instance.
 */
export function init(options: PatchFlowInitOptions): PatchFlow;

/**
 * Capture an exception using the globally initialised SDK instance.
 */
export function captureException(error: Error | any, context?: PatchFlowContext): void;

/**
 * Express error-handling middleware.
 * Add AFTER all routes: `app.use(patchflow.expressMiddleware())`
 */
export function expressMiddleware(): (err: any, req: any, res: any, next: any) => void;

/**
 * Wrap a Next.js App Router handler to capture unhandled errors.
 *
 * ```ts
 * export const GET = patchflow.wrapNextHandler(async (request) => {
 *   return NextResponse.json({ ok: true });
 * });
 * ```
 */
export function wrapNextHandler<T extends (...args: any[]) => Promise<any> | any>(handler: T): T;

/**
 * Hono middleware factory.
 * `app.use('*', patchflow.honoMiddleware())`
 */
export function honoMiddleware(): (c: any, next: () => Promise<void>) => Promise<void>;

declare const patchflow: {
  init: typeof init;
  captureException: typeof captureException;
  expressMiddleware: typeof expressMiddleware;
  wrapNextHandler: typeof wrapNextHandler;
  honoMiddleware: typeof honoMiddleware;
  PatchFlow: typeof PatchFlow;
};

export default patchflow;
