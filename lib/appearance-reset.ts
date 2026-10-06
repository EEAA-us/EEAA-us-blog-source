/** A delayed reset must never replace an adjustment made while it was loading. */
export async function applyLoadedAppearanceReset<T>(
  load: () => Promise<T>,
  revision: () => string,
  apply: (defaults: T) => void,
): Promise<boolean> {
  const before = revision();
  const defaults = await load();
  if (revision() !== before) return false;
  apply(defaults);
  return true;
}
