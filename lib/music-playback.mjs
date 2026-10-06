export function getEndedTransition(mode, current, length, random = Math.random) {
  if (length <= 0 || current < 0 || current >= length) return { type: "stop" };
  if (mode === "once") return { type: "stop" };
  if (mode === "single" || length === 1) return { type: "repeat", index: current };
  if (mode === "random") {
    const candidates = Array.from({ length }, (_, index) => index).filter((index) => index !== current);
    return { type: "advance", index: candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))] };
  }
  return { type: "advance", index: (current + 1) % length };
}

export function getAutomaticFailureNextIndex(mode, current, length, tried = new Set(), random = Math.random) {
  if (mode !== "loop" && mode !== "random") return null;
  if (length <= 0 || current < 0 || current >= length) return null;
  const visited = new Set(tried);
  visited.add(current);
  if (visited.size >= length) return null;
  if (mode === "random") {
    const candidates = Array.from({ length }, (_, index) => index).filter((index) => !visited.has(index));
    return candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))] ?? null;
  }
  for (let offset = 1; offset <= length; offset++) {
    const candidate = (current + offset) % length;
    if (!visited.has(candidate)) return candidate;
  }
  return null;
}
