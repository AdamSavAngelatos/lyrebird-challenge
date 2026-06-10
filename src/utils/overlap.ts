/**
 * Returns true if [aStart, aEnd) overlaps [bStart, bEnd).
 * Touching at endpoints (aEnd === bStart) is NOT an overlap.
 * All values are ISO 8601 UTC strings, which sort lexicographically.
 */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && aEnd > bStart;
}
