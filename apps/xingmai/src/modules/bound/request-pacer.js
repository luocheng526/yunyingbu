import { setTimeout as delay } from "node:timers/promises";

// Space request starts, not responses: slow reads may overlap, but never burst.
export function createRequestPacer({ intervalMs = 750, now = Date.now, sleep = delay } = {}) {
  let turn = Promise.resolve(), lastStart = -Infinity, holdUntil = 0, spacing = intervalMs, healthy = 0;
  return {
    async run(send) {
      const ready = turn.then(async () => {
        // An in-flight response can extend the hold while this caller is waiting.
        for (let wait; (wait = Math.max(lastStart + spacing, holdUntil) - now()) > 0;) await sleep(wait);
        lastStart = now();
      });
      turn = ready.catch(() => {});
      await ready;
      try {
        const result = await send();
        if (result.httpStatus === 429 || result.httpStatus >= 500) {
          spacing = Math.min(6000, Math.max(1500, spacing * 2));
          holdUntil = Math.max(holdUntil, now() + Math.max(15000, result.retryAfterMs || 0));
          healthy = 0;
        } else if (result.httpStatus === 200 && result.payload?.code === 0 && ++healthy >= 10) {
          spacing = Math.max(intervalMs, spacing / 2); healthy = 0;
        }
        return result;
      } catch (error) {
        spacing = Math.min(6000, Math.max(1500, spacing * 2));
        holdUntil = Math.max(holdUntil, now() + 15000); healthy = 0;
        throw error;
      }
    }
  };
}
