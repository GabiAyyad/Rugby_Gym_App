import type { ISODate } from '@/types/common';
import type { PositionGroup } from '@/types/database';
import type { AdherenceRow, AdherenceStatus } from '@/types/session';
import { daysBetween } from './week';

export interface AdherencePlayer {
  playerId: string;
  playerName: string;
  teamId: string;
  teamName: string;
  positionGroup: PositionGroup | null;
  programName: string | null;
  /** Days in this player's active block; 0 when they have no live program. */
  sessionsScheduled: number;
}

/** One session that has at least one log against it — i.e. the player actually trained. */
export interface LoggedSession {
  playerId: string;
  date: ISODate;
  programDayId: string;
}

export interface AdherenceInput {
  players: AdherencePlayer[];
  /** Every logged session, not just this week's — last-log date needs the history. */
  loggedSessions: LoggedSession[];
  weekStart: ISODate;
  weekEnd: ISODate;
  today: ISODate;
}

function statusFor(logged: number, scheduled: number): AdherenceStatus {
  if (logged === 0) return 'not_started';
  if (scheduled === 0) return 'on_track';
  if (logged >= scheduled) return 'complete';
  return logged / scheduled >= 0.5 ? 'on_track' : 'behind';
}

/**
 * Adherence is derived, never stored: a player trained on a day exactly when a
 * session of theirs carries logs. Repeats of the same program day inside one
 * week count once, so re-opening Day 2 to fix a set does not inflate the number.
 */
export function calculateAdherence(input: AdherenceInput): AdherenceRow[] {
  const { players, loggedSessions, weekStart, weekEnd, today } = input;

  const thisWeekDays = new Map<string, Set<string>>();
  const lastLog = new Map<string, ISODate>();

  for (const session of loggedSessions) {
    const previous = lastLog.get(session.playerId);
    if (!previous || session.date > previous) lastLog.set(session.playerId, session.date);

    if (session.date >= weekStart && session.date <= weekEnd) {
      const days = thisWeekDays.get(session.playerId) ?? new Set<string>();
      days.add(session.programDayId);
      thisWeekDays.set(session.playerId, days);
    }
  }

  return players.map((player) => {
    const scheduled = player.sessionsScheduled;
    const logged = thisWeekDays.get(player.playerId)?.size ?? 0;
    const last = lastLog.get(player.playerId) ?? null;

    return {
      playerId: player.playerId,
      playerName: player.playerName,
      teamId: player.teamId,
      teamName: player.teamName,
      positionGroup: player.positionGroup,
      programName: player.programName,
      sessionsLogged: logged,
      sessionsScheduled: scheduled,
      adherencePct: scheduled === 0 ? 0 : Math.round((Math.min(logged, scheduled) / scheduled) * 100),
      lastLogDate: last,
      daysSinceLastLog: last ? daysBetween(last, today) : null,
      status: statusFor(logged, scheduled),
    } satisfies AdherenceRow;
  });
}

/** Default sort: the people falling behind float to the top. */
export function sortByRisk(rows: AdherenceRow[]): AdherenceRow[] {
  const rank: Record<AdherenceStatus, number> = {
    not_started: 0,
    behind: 1,
    on_track: 2,
    complete: 3,
  };
  return [...rows].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (a.adherencePct !== b.adherencePct) return a.adherencePct - b.adherencePct;
    const aStale = a.daysSinceLastLog ?? Number.MAX_SAFE_INTEGER;
    const bStale = b.daysSinceLastLog ?? Number.MAX_SAFE_INTEGER;
    if (aStale !== bStale) return bStale - aStale;
    return a.playerName.localeCompare(b.playerName);
  });
}

/** Epley, rounded — good enough to draw a trend line, not a 1RM test. */
export function estimateOneRepMax(weightKg: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}
