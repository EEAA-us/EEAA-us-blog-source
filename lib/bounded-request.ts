// Bound the whole operation, including body parsing and browser permission waits.
export async function withRequestDeadline<T>(signal: AbortSignal, timeoutMs: number,
  work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  signal.throwIfAborted();
  const bounded = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);
  let cancel: () => void = () => {};
  const cancelled = new Promise<never>((_, reject) => {
    cancel = () => reject(bounded.reason);
    if (bounded.aborted) cancel();
    else bounded.addEventListener("abort", cancel, { once: true });
  });
  try {
    bounded.throwIfAborted();
    return await Promise.race([cancelled, work(bounded)]);
  } finally { bounded.removeEventListener("abort", cancel); }
}
