import type { PositionGroup } from './database';
import type { Exercise } from './exercise';
import type { ISODate } from './common';

export interface ProgramExercise {
  id: string;
  exerciseId: string;
  exercise: Exercise;
  order: number;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  notes: string | null;
}

export interface ProgramDay {
  id: string;
  dayNumber: number;
  label: string | null;
  exercises: ProgramExercise[];
}

/** List-view shape: no nested days, cheap to fetch. */
export interface ProgramSummary {
  id: string;
  teamId: string;
  positionGroup: PositionGroup;
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  isActiveOverride: boolean | null;
  /** Derived by resolveActiveProgram for today's date. */
  isActive: boolean;
  dayCount: number;
  exerciseCount: number;
  createdAt: string;
}

export interface Program extends Omit<ProgramSummary, 'dayCount' | 'exerciseCount'> {
  days: ProgramDay[];
}

export interface ProgramExerciseInput {
  exerciseId: string;
  order: number;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  notes: string | null;
}

export interface ProgramDayInput {
  dayNumber: number;
  label: string | null;
  exercises: ProgramExerciseInput[];
}

export interface CreateProgramInput {
  positionGroup: PositionGroup;
  name: string;
  startDate: ISODate;
  endDate: ISODate;
  isActiveOverride: boolean | null;
  days: ProgramDayInput[];
}

export interface UpdateProgramInput extends CreateProgramInput {
  id: string;
}

export interface DeleteProgramInput {
  id: string;
}

export interface ListProgramsResult {
  programs: ProgramSummary[];
}
