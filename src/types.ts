export interface TrackedSet {
  reps: number;
  weight: number;
  completed: boolean;
}

export interface Exercise {
  _id?: string;
  name: string;
  type?: 'strength' | 'cardio';
  sets?: number;
  reps?: number;
  weight?: number;
  duration?: number; // for cardio (minutes)
  distance?: number; // for cardio (km/miles)
  tip?: string;
  actualSets?: number;
  actualReps?: number;
  actualWeight?: number;
  completed?: boolean;
  trackedSets?: TrackedSet[];
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
}
