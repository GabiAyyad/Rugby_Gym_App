import 'server-only';
import type { SessionUser } from '@/types/common';
import type { CreateProgramInput, Program } from '@/types/program';
import { insertProgram } from '@/lib/supabase/queries/programs';
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
export async function createProgram(
  session: SessionUser,
  input: CreateProgramInput,
): Promise<Program> {
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
