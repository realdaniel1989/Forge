export interface TrackedSet {
  reps: number;
  weight: number;
  completed: boolean;
}

export const BODY_PARTS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Legs', 'Core', 'Glutes', 'Forearms', 'Calves', 'Cardio'
] as const;

export type BodyPart = typeof BODY_PARTS[number];

export interface Exercise {
  _id?: string;
  bodyPart?: BodyPart;
  name: string;
  type?: 'strength' | 'cardio';
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
  tip?: string;
  actualSets?: number;
  actualReps?: number;
  actualWeight?: number;
  completed?: boolean;
  trackedSets?: TrackedSet[];
  plannedSets?: PlannedSet[];
}

export interface Tempo {
  down: number;        // eccentric, 0–10s
  holdBottom: number;  // pause at bottom, 0–10s
  up: number | 'X';    // concentric, 0–10s — 'X' = explosive
  holdTop: number;     // pause at top, 0–10s
}

export interface PlannedSet {
  reps: number;
  weight: number;
  tempo?: Tempo;
}

export interface Routine {
  id: string;
  userId: string;
  name: string;
  bodyPart?: string;
  exercises: Exercise[];
  isGenerated?: boolean;
  createdAt: number;
}

export interface WorkoutLog {
  id?: string;
  userId: string;
  routineId?: string;
  name: string;
  bodyPart?: string;
  date: number;
  unit: 'lbs' | 'kgs';
  exercises: Exercise[];
  calories?: number;
}

export interface Habit {
  id: string;
  userId: string;
  name: string;
  target: number;
  unit: string;
  createdAt: number;
  archived: boolean;
}

export interface HabitLog {
  id: string;
  userId: string;
  habitId: string;
  date: string;    // "YYYY-MM-DD"
  actual: number;
  createdAt: number;
}

export interface ExerciseEntry {
  id: string;
  userId: string;
  name: string;
  nameKey: string;
  bodyPart: BodyPart;
  type: 'strength' | 'cardio';
  createdAt: number;
}

export const normalizeExerciseName = (name: string): string =>
  name.trim().toLowerCase().replace(/\s+/g, '');
