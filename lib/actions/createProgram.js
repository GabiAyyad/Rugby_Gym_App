import 'server-only';
import { insertProgram } from '@/lib/db/queries/programs';
import { assertProgramInput, updateProgram } from '@/lib/actions/updateProgram';

/**
 * Start a new monthly block for the caller's team.
 *
 * The block is always created under `session.teamId` — a team id is never
 * accepted from the caller, so an admin cannot write programming into the other
 * squad even by hand-crafting a request.
 *
 * The row goes in first and its days are then laid out by the same replacement
 * pass a save uses, so there is exactly one code path that writes a block's
 * days and exercises.
 */
/** `input` is a full CreateProgramInput: `{ positionGroup, name, startDate, endDate, isActiveOverride, days }`. */
export async function createProgram(session, input) {
  assertProgramInput(input);

  const row = await insertProgram(session.teamId, {
    positionGroup: input.positionGroup,
    name: input.name.trim(),
    startDate: input.startDate,
    endDate: input.endDate,
    isActiveOverride: input.isActiveOverride,
  });

  return updateProgram(session, { ...input, id: row.id });
}
