# PatchFlow Node.js SDK

Captures unhandled exceptions from your Node.js API and sends them to PatchFlow,
which automatically generates a fix and opens a draft PR.

## Install

No dependencies required. Uses Node's built-in `https` module.

Copy `patchflow.js` into your project, or install via npm once published:
```bash
npm install patchflow-agent
```

## Usage

### Express
```js
const express = require('express');
const patchflow = require('./patchflow');

const app = express();
patchflow.init({ apiKey: 'pf_live_your_key_here' });

// ... your routes ...

// Add error middleware AFTER all routes
app.use(patchflow.expressMiddleware());
```

### Next.js App Router
```ts
// app/api/users/route.ts
import patchflow from './patchflow';
import { NextRequest, NextResponse } from 'next/server';

patchflow.init({ apiKey: 'pf_live_your_key_here' });

export const GET = patchflow.wrapNextHandler(async (request: NextRequest) => {
  const users = await db.findAll();
  return NextResponse.json(users);
});
```

### Hono
```ts
import { Hono } from 'hono';
import patchflow from './patchflow';

const app = new Hono();
patchflow.init({ apiKey: 'pf_live_your_key_here' });
app.use('*', patchflow.honoMiddleware());
```

### Manual capture
```js
patchflow.init({ apiKey: 'pf_live_your_key_here' });

try {
  riskyOperation();
} catch (e) {
  patchflow.captureException(e, { endpoint: '/api/payments', method: 'POST' });
  throw e;
}
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PATCHFLOW_HOST` | `https://api.patchflow.dev` | PatchFlow API host |
| `PATCHFLOW_ENV` | `NODE_ENV` value | Environment name |
