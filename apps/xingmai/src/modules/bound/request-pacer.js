import { setTimeout as delay } from "node:timers/promises";

// Space request starts, not responses: slow reads may overlap, but never burst.
export function createRequestPacer({ intervalMs = 750, now = Date.now, sleep = delay } = {}) {
  let turn = Promise.resolve(), lastStart = -Infinity, holdUntil = 0, spacing = intervalMs, healthy = 0;
  return {
    async run(send, { signal, deferCooldown = false } = {}) {
      const cooldown = () => {
        const retryAfterMs = holdUntil - now();
        return retryAfterMs > 0 ? { blocked: "upstream_cooldown", retryAfterMs } : null;
      };
      signal?.throwIfAborted();
      const deferredAtEntry = deferCooldown && cooldown();
      if (deferredAtEntry) return deferredAtEntry;
      const ready = turn.then(async () => {
        // An in-flight response can extend the hold while this caller is waiting.
        for (;;) {
          signal?.throwIfAborted();
          const deferred = deferCooldown && cooldown();
          if (deferred) return deferred;
          const wait = Math.max(lastStart + spacing, holdUntil) - now();
          if (wait <= 0) break;
          await sleep(Math.min(wait, 2 ** 31 - 1), undefined, { signal });
        }
        lastStart = now();
      });
      turn = ready.catch(() => {});
      const deferred = await ready;
      if (deferred) return deferred;
      signal?.throwIfAborted();
      try {
        const result = await send();
        const rateLimited = result.httpStatus === 429 || result.payload?.code === 429 ||
          (result.payload?.code !== 0 && [result.payload?.content, result.payload?.message]
            .some(message => typeof message === "string" && /(?:请求|访问)(?:过于|太)频繁/.test(message)));
        if (rateLimited || result.httpStatus >= 500) {
          spacing = Math.min(6000, Math.max(1500, spacing * 2));
          holdUntil = Math.max(holdUntil, now() + Math.max(15000, result.retryAfterMs || (rateLimited ? 60000 : 0)));
          healthy = 0;
          if (rateLimited && deferCooldown) return { ...result, ...cooldown() };
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
