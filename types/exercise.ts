import type { ProgressionType } from './database';

export interface Exercise {
  id: string;
  name: string;
  videoUrl: string | null;
  movementPattern: string | null;
  progressionType: ProgressionType;
  createdAt: string;
}

export interface CreateExerciseInput {
  name: string;
  videoUrl: string | null;
  movementPattern: string | null;
  progressionType: ProgressionType;
}

export interface UpdateExerciseInput extends CreateExerciseInput {
  id: string;
}

export interface DeleteExerciseInput {
  id: string;
}

export interface ListExercisesResult {
  exercises: Exercise[];
}
