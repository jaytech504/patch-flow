# PatchFlow Python SDK

Captures unhandled exceptions from your Python API and sends them to PatchFlow,
which automatically generates a fix and opens a draft PR.

## Install

```bash
pip install httpx  # optional but recommended for async-safe HTTP
```

Copy `patchflow.py` into your project root, or install via pip once published:
```bash
pip install patchflow-agent
```

## Usage

### FastAPI (one line)
```python
# main.py
from fastapi import FastAPI
import patchflow

app = FastAPI()
patchflow.init(api_key="pf_live_your_key_here")

@app.get("/users")
async def get_users():
    ...
```

### Flask (one line)
```python
# app.py
from flask import Flask
import patchflow

app = Flask(__name__)
patchflow.init(api_key="pf_live_your_key_here", app=app)
```

### Manual capture
```python
import patchflow
pf = patchflow.init(api_key="pf_live_your_key_here")

try:
    risky_operation()
except Exception as e:
    pf.capture_exception(e)
    raise
```

### Decorator
```python
import patchflow
patchflow.init(api_key="pf_live_your_key_here")

@app.get("/orders")
@patchflow.monitor
async def get_orders():
    ...
```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PATCHFLOW_HOST` | `https://api.patchflow.dev` | PatchFlow API host |
| `PATCHFLOW_ENV` | `production` | Environment name |
| `APP_ENV` | — | Fallback environment name |
