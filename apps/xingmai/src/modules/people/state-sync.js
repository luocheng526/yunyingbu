// A read that started before a save must never put its old snapshot back over
// the new state. Writes are serialized and receive an immutable snapshot.
export function stateSync() {
  let revision = 0, pending = Promise.resolve();
  return {
    async read(load, apply) {
      const seen = revision;
      await pending;
      const value = await load();
      if (seen === revision) apply(value);
      else await pending;
    },
    write(snapshot, save) {
      revision++;
      const data = structuredClone(snapshot);
      const work = pending.then(() => save(data));
      pending = work.catch(() => {});
      return work;
    }
  };
}
