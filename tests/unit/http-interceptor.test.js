import { describe, it, expect } from 'vitest';
import httpClient from '../../src/api/http.js';

/**
 * Tests the response interceptor's rate-limit handling by invoking the
 * registered interceptor handlers directly (avoiding real network calls).
 */
describe('httpClient response interceptor — rate limiting', () => {
  const respHandlers = httpClient.interceptors.response.handlers;

  // Identify OUR rate-limit interceptor: it's the one that rewrites a 429
  // error's message (axios-retry's interceptor passes errors through unchanged).
  const rateLimitHandler = respHandlers
    .map((h) => h.rejected)
    .find((fn) => typeof fn === 'function' && String(fn).includes('Rate limit exceeded'));

  it('has a registered rate-limit interceptor', () => {
    expect(typeof rateLimitHandler).toBe('function');
  });

  it('rewrites 429 message to include Retry-After header', async () => {
    const error = {
      response: { status: 429, headers: { 'retry-after': '30' } }
    };
    await expect(rateLimitHandler(error)).rejects.toMatchObject({
      message: expect.stringContaining('Rate limit exceeded')
    });
    expect(error.message).toContain('30');
  });

  it('reports generic rate-limit message when no Retry-After header', async () => {
    const error = { response: { status: 429, headers: {} } };
    await expect(rateLimitHandler(error)).rejects.toMatchObject({
      message: expect.stringContaining('Please wait before retrying')
    });
  });

  it('passes through non-429 errors unchanged', async () => {
    const error = { message: 'normal error', response: { status: 500 } };
    await expect(rateLimitHandler(error)).rejects.toBe(error);
  });
});

describe('httpClient request interceptor — request ID', () => {
  const reqHandlers = httpClient.interceptors.request.handlers;
  const requestIdHandler = reqHandlers.find((h) => typeof h.fulfilled === 'function')?.fulfilled;

  it('injects a unique X-Request-ID header per request', () => {
    const cfg1 = requestIdHandler({ headers: {} });
    const cfg2 = requestIdHandler({ headers: {} });
    expect(cfg1.headers['X-Request-ID']).toMatch(/^req_/);
    expect(cfg2.headers['X-Request-ID']).toMatch(/^req_/);
    expect(cfg1.headers['X-Request-ID']).not.toBe(cfg2.headers['X-Request-ID']);
  });
});
