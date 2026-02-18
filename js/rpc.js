import { RPC_TIMEOUT_MS } from './config.js';

let requestId = 1;

export async function rpcCall(url, method, params = []) {
  const id = requestId++;
  const body = { jsonrpc: '2.0', method, params, id };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  const start = performance.now();

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const elapsed = Math.round(performance.now() - start);
    const json = await res.json();
    return { ok: true, data: json, ms: elapsed, request: body };
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    if (err.name === 'AbortError') {
      return { ok: false, error: `Request timed out after ${RPC_TIMEOUT_MS / 1000}s — network may be unreachable`, ms: elapsed, request: body };
    }
    return { ok: false, error: err.message, ms: elapsed, request: body };
  } finally {
    clearTimeout(timer);
  }
}

export async function rawRpcCall(url, payload) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
  const start = performance.now();

  try {
    const parsed = JSON.parse(payload);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
      signal: controller.signal,
    });
    const elapsed = Math.round(performance.now() - start);
    const json = await res.json();
    return { ok: true, data: json, ms: elapsed, request: parsed };
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    if (err.name === 'AbortError') {
      return { ok: false, error: `Request timed out after ${RPC_TIMEOUT_MS / 1000}s`, ms: elapsed };
    }
    if (err instanceof SyntaxError) {
      return { ok: false, error: 'Invalid JSON payload', ms: elapsed };
    }
    return { ok: false, error: err.message, ms: elapsed };
  } finally {
    clearTimeout(timer);
  }
}
