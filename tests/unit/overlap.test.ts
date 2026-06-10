import { describe, it, expect } from 'vitest';
import { overlaps } from '../../src/utils/overlap.js';

describe('overlaps()', () => {
  it('detects a full containment overlap', () => {
    expect(overlaps('09:00', '10:00', '08:00', '11:00')).toBe(true);
  });

  it('detects a partial overlap — new starts before existing ends', () => {
    expect(overlaps('09:30', '10:30', '09:00', '10:00')).toBe(true);
  });

  it('detects a partial overlap — new ends after existing starts', () => {
    expect(overlaps('08:30', '09:30', '09:00', '10:00')).toBe(true);
  });

  it('detects identical time slots as overlapping', () => {
    expect(overlaps('09:00', '10:00', '09:00', '10:00')).toBe(true);
  });

  it('allows touching at end — new.end == existing.start', () => {
    expect(overlaps('08:00', '09:00', '09:00', '10:00')).toBe(false);
  });

  it('allows touching at start — new.start == existing.end', () => {
    expect(overlaps('10:00', '11:00', '09:00', '10:00')).toBe(false);
  });

  it('allows completely before', () => {
    expect(overlaps('07:00', '08:00', '09:00', '10:00')).toBe(false);
  });

  it('allows completely after', () => {
    expect(overlaps('11:00', '12:00', '09:00', '10:00')).toBe(false);
  });

  it('works correctly with ISO 8601 UTC strings', () => {
    expect(
      overlaps(
        '2026-06-11T09:00:00.000Z',
        '2026-06-11T10:00:00.000Z',
        '2026-06-11T09:30:00.000Z',
        '2026-06-11T10:30:00.000Z'
      )
    ).toBe(true);
  });

  it('allows touching ISO 8601 datetimes', () => {
    expect(
      overlaps(
        '2026-06-11T10:00:00.000Z',
        '2026-06-11T11:00:00.000Z',
        '2026-06-11T09:00:00.000Z',
        '2026-06-11T10:00:00.000Z'
      )
    ).toBe(false);
  });
});
