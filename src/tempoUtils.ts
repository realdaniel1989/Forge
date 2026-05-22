import type { Exercise, PlannedSet, Tempo } from './types';

export function getPlannedSets(exercise: Exercise): PlannedSet[] {
  if (exercise.plannedSets && exercise.plannedSets.length > 0) {
    return exercise.plannedSets;
  }
  const count = exercise.sets ?? 0;
  if (count <= 0) return [];
  const reps = exercise.reps ?? 0;
  const weight = exercise.weight ?? 0;
  return Array.from({ length: count }, () => ({ reps, weight }));
}

export function formatTempo(tempo: Tempo | undefined): string | null {
  if (!tempo) return null;
  return `${tempo.down}·${tempo.holdBottom}·${tempo.up}·${tempo.holdTop}`;
}

export function emptyTempo(): Tempo {
  return { down: 0, holdBottom: 0, up: 0, holdTop: 0 };
}
