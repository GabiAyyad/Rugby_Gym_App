import type { ISODate } from './common';
import type { PositionGroup, ProgressionType } from './database';
import type { Exercise } from './exercise';

/* ------------------------------------------------------------------ progression */

export interface LoggedSet {
  setNumber: number;
  repsDone: number | null;
  weightUsed: number | null;
  distanceOrTime: string | null;
}

/** The player's most recent session for one program exercise. */
export interface LastSessionSummary {
  date: ISODate;
  sets: LoggedSet[];
}

export interface ProgressionInput {
  progressionType: ProgressionType;
  targetSets: number;
  /** "8-10", "5", "40m", "30s" — see lib/domain/repRange.ts */
  targetReps: string;
  last: LastSessionSummary | null;
}

export interface Suggestion {
  weight: number | null;
  reps: number | null;
  distanceOrTime: string | null;
  /** Player-facing one-liner explaining the number. */
  reason: string;
  /** True when this is a step up from last session rather than a hold. */
  isProgression: boolean;
}

/* ------------------------------------------------------------------ this week */

export type DayStatus = 'not_started' | 'in_progress' | 'completed';

export interface WeekDay {
  programDayId: string;
  dayNumber: number;
  label: string | null;
  exerciseCount: number;
  sessionId: string | null;
  date: ISODate | null;
  status: DayStatus;
}

/**
 * The player's week. Days are not pinned to weekdays: the player trains the next
 * unfinished day whenever they get to the gym, and may open any day directly.
 */
export interface WeekView {
  program: {
    id: string;
    name: string;
    positionGroup: PositionGroup;
    startDate: ISODate;
    endDate: ISODate;
  } | null;
  today: ISODate;
  weekStart: ISODate;
  weekEnd: ISODate;
  days: WeekDay[];
  /** Next unfinished day this week, or null when the week is complete. */
  nextDayNumber: number | null;
  completedThisWeek: number;
  scheduledThisWeek: number;
}

/* ------------------------------------------------------------------ logging */

export interface SessionExercise {
  programExerciseId: string;
  order: number;
  targetSets: number;
  targetReps: string;
  restSeconds: number;
  notes: string | null;
  exercise: Exercise;
  /** Sets already logged in THIS session. */
  sets: LoggedSet[];
  lastSession: LastSessionSummary | null;
  suggestion: Suggestion;
}

export interface SessionDetail {
  sessionId: string;
  programDayId: string;
  programName: string;
  dayNumber: number;
  label: string | null;
  date: ISODate;
  completedAt: string | null;
  exercises: SessionExercise[];
}

/**
 * One logged set. Carries programDayId + date so the server can resolve or create
 * the owning session — which is what makes an offline replay safe: the same entry
 * upserts on (session, exercise, set) instead of duplicating.
 */
export interface LogSetInput {
  programDayId: string;
  date: ISODate;
  programExerciseId: string;
  setNumber: number;
  repsDone: number | null;
  weightUsed: number | null;
  distanceOrTime: string | null;
}

/** A LogSetInput sitting in the offline queue, keyed for local dedupe. */
export interface QueuedLog extends LogSetInput {
  clientId: string;
  queuedAt: string;
}

export interface SyncLogsInput {
  entries: QueuedLog[];
}

export interface SyncLogsResult {
  accepted: string[];
  rejected: Array<{ clientId: string; error: string }>;
  /** programDayId|date -> sessionId, so the client can adopt server session ids. */
  sessionIds: Record<string, string>;
}

export interface CompleteSessionInput {
  sessionId: string;
}

export interface GetLastLogInput {
  programExerciseId: string;
}

/* ------------------------------------------------------------------ history */

export interface HistorySession {
  sessionId: string;
  date: ISODate;
  programName: string;
  dayNumber: number;
  label: string | null;
  exerciseCount: number;
  setCount: number;
  totalVolumeKg: number;
  completedAt: string | null;
}

export interface ProgressPoint {
  date: ISODate;
  topWeightKg: number | null;
  topSetReps: number | null;
  estimatedOneRepMaxKg: number | null;
  totalVolumeKg: number;
}

export interface PlayerHistoryResult {
  sessions: HistorySession[];
  /** Exercises this player has ever logged, for the chart selector. */
  loggedExercises: Array<{ id: string; name: string }>;
  /** Populated when an exerciseId is requested. */
  series: { exerciseId: string; exerciseName: string; points: ProgressPoint[] } | null;
}

/* ------------------------------------------------------------------ adherence */

export type AdherenceStatus = 'complete' | 'on_track' | 'behind' | 'not_started';

export interface AdherenceRow {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  positionGroup: PositionGroup | null;
  programName: string | null;
  sessionsLogged: number;
  sessionsScheduled: number;
  adherencePct: number;
  lastLogDate: ISODate | null;
  daysSinceLastLog: number | null;
  status: AdherenceStatus;
}

export interface AdherenceDashboard {
  weekStart: ISODate;
  weekEnd: ISODate;
  today: ISODate;
  teams: Array<{ id: string; name: string }>;
  rows: AdherenceRow[];
  summary: {
    playerCount: number;
    trainedThisWeek: number;
    notStarted: number;
    averageAdherencePct: number;
  };
}

/* ------------------------------------------------------------------ leaderboard */

export interface LeaderboardEntry {
  rank: number;
  playerId: string;
  playerName: string;
  positionGroup: PositionGroup | null;
  sessionsLogged: number;
  totalVolumeKg: number;
  isMe: boolean;
}

export interface LeaderboardResult {
  /** Admin switch on the team. */
  teamEnabled: boolean;
  /** This player's own opt-in. */
  optedIn: boolean;
  weekStart: ISODate;
  weekEnd: ISODate;
  entries: LeaderboardEntry[];
}
