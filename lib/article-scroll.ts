// Headings appear in document order. Return the last one above the reading line.
export function findActiveHeading(offsets: readonly number[], position: number): number {
  let low = 0;
  let high = offsets.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (offsets[middle] <= position) low = middle + 1;
    else high = middle;
  }
  return low - 1;
}
