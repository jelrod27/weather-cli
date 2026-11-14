import { createServer } from 'node:http';
import { describe, expect, it, vi } from 'vitest';
import httpClient from '../../src/api/http.js';

async function withServer(handler, run) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await run(`http://127.0.0.1:${server.address().port}/weather`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

function requestOptions(clarifyTimeoutError = false) {
  return {
    timeout: 100,
    proxy: false,
    transitional: { clarifyTimeoutError },
    'axios-retry': { retryDelay: () => 0, onRetry: () => {} }
  };
}

describe('HTTP retry recovery', () => {
  it.each([false, true])(
    'recovers a timed-out GET with a fresh deadline (clarifyTimeoutError=%s)',
    async (clarifyTimeoutError) => {
      let requests = 0;
      const result = await withServer(
        (_request, response) => {
          requests++;
          if (requests === 1) return;
          response.setHeader('Content-Type', 'application/json');
          response.end('{"ok":true}');
        },
        (url) => httpClient.get(url, requestOptions(clarifyTimeoutError))
      );
      expect(result.data).toEqual({ ok: true });
      expect(requests).toBe(2);
    }
  );

  it('stops after the bounded retries when every GET times out', async () => {
    let requests = 0;
    await expect(
      withServer(
        () => requests++,
        (url) => httpClient.get(url, requestOptions())
      )
    ).rejects.toMatchObject({ code: 'ECONNABORTED' });
    expect(requests).toBe(4);
  });

  it.each([false, true])(
    'does not retry timed-out POST requests (%s)',
    async (clarifyTimeoutError) => {
      let requests = 0;
      await expect(
        withServer(
          () => requests++,
          (url) => httpClient.post(url, {}, requestOptions(clarifyTimeoutError))
        )
      ).rejects.toMatchObject({ code: clarifyTimeoutError ? 'ETIMEDOUT' : 'ECONNABORTED' });
      expect(requests).toBe(1);
    }
  );

  it('does not retry an explicitly canceled request', async () => {
    const controller = new AbortController();
    let requests = 0;
    let retries = 0;
    await expect(
      withServer(
        () => {
          requests++;
          controller.abort();
        },
        (url) =>
          httpClient.get(url, {
            ...requestOptions(),
            signal: controller.signal,
            'axios-retry': { retryDelay: () => 0, onRetry: () => retries++ }
          })
      )
    ).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(requests).toBe(1);
    expect(retries).toBe(0);
  });

  it('does not retry a permanent client error', async () => {
    let requests = 0;
    await expect(
      withServer(
        (_request, response) => {
          requests++;
          response.statusCode = 400;
          response.end('Bad request');
        },
        (url) => httpClient.get(url, requestOptions())
      )
    ).rejects.toMatchObject({ response: { status: 400 } });
    expect(requests).toBe(1);
  });

  it('writes retry diagnostics to stderr without contaminating JSON stdout', async () => {
    const stdout = vi.spyOn(console, 'log').mockImplementation(() => {});
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
    let requests = 0;
    try {
      const result = await withServer(
        (_request, response) => {
          requests++;
          response.statusCode = requests === 1 ? 503 : 200;
          response.setHeader('Content-Type', 'application/json');
          response.end('{"ok":true}');
        },
        (url) =>
          httpClient.get(url, {
            ...requestOptions(),
            'axios-retry': { retryDelay: () => 0 }
          })
      );
      expect(result.data).toEqual({ ok: true });
      expect(stdout).not.toHaveBeenCalled();
      expect(stderr).toHaveBeenCalled();
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  });
});
