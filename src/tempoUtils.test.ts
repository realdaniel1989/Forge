import { describe, it, expect } from 'vitest';
import { getPlannedSets, formatTempo, emptyTempo } from './tempoUtils';
import type { Exercise, PlannedSet } from './types';

describe('getPlannedSets', () => {
  it('returns plannedSets when present', () => {
    const planned: PlannedSet[] = [
      { reps: 10, weight: 60, tempo: { down: 3, holdBottom: 1, up: 2, holdTop: 0 } },
      { reps: 8, weight: 65 },
    ];
    const ex: Exercise = { name: 'Bench', plannedSets: planned };
    expect(getPlannedSets(ex)).toBe(planned);
  });

  it('derives plannedSets from legacy sets/reps/weight when missing', () => {
    const ex: Exercise = { name: 'Squat', sets: 3, reps: 5, weight: 100 };
    expect(getPlannedSets(ex)).toEqual([
      { reps: 5, weight: 100 },
      { reps: 5, weight: 100 },
      { reps: 5, weight: 100 },
    ]);
  });

  it('returns empty array when legacy fields are missing', () => {
    const ex: Exercise = { name: 'Mystery' };
    expect(getPlannedSets(ex)).toEqual([]);
  });

  it('treats sets=0 as empty', () => {
    const ex: Exercise = { name: 'Zero', sets: 0, reps: 10, weight: 50 };
    expect(getPlannedSets(ex)).toEqual([]);
  });

  it('treats an empty plannedSets array as legacy fallback', () => {
    const ex: Exercise = { name: 'Bench', plannedSets: [], sets: 2, reps: 5, weight: 50 };
    expect(getPlannedSets(ex)).toEqual([
      { reps: 5, weight: 50 },
      { reps: 5, weight: 50 },
    ]);
  });
});

describe('formatTempo', () => {
  it('formats numeric tempo with middle dots', () => {
    expect(formatTempo({ down: 3, holdBottom: 1, up: 2, holdTop: 0 })).toBe('3·1·2·0');
  });

  it('formats X concentric', () => {
    expect(formatTempo({ down: 3, holdBottom: 1, up: 'X', holdTop: 0 })).toBe('3·1·X·0');
  });

  it('returns null for undefined tempo', () => {
    expect(formatTempo(undefined)).toBeNull();
  });
});

describe('emptyTempo', () => {
  it('returns all-zero tempo', () => {
    expect(emptyTempo()).toEqual({ down: 0, holdBottom: 0, up: 0, holdTop: 0 });
  });
});
