import { logger } from './logger';

const log = logger.scope('Retry');

/**
 * Retry utility — wraps any async operation with configurable retries.
 * Useful for flaky API calls, WebSocket race conditions, etc.
 *
 * Usage:
 *   const result = await retry(() => api.sendMessage(uid, text), { attempts: 3, delay: 1000 });
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: { attempts?: number; delay?: number; label?: string } = {}
): Promise<T> {
  const { attempts = 3, delay = 1000, label = 'operation' } = options;

  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === attempts) {
        log.error(`${label} failed after ${attempts} attempts: ${(err as Error).message}`);
        throw err;
      }
      log.warn(`${label} attempt ${i}/${attempts} failed, retrying in ${delay}ms...`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw new Error('Unreachable');
}

/**
 * Wait for a condition to become true, polling at intervals.
 *
 * Usage:
 *   await waitFor(() => page.locator('.element').isVisible(), { timeout: 10000 });
 */
export async function waitFor(
  condition: () => Promise<boolean>,
  options: { timeout?: number; interval?: number; label?: string } = {}
): Promise<void> {
  const { timeout = 15000, interval = 500, label = 'condition' } = options;
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition().catch(() => false)) return;
    await new Promise(r => setTimeout(r, interval));
  }

  throw new Error(`waitFor: "${label}" not met after ${timeout}ms`);
}
