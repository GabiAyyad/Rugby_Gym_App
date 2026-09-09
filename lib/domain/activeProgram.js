/**
 * Which block is live for a team + position group on a given date.
 *
 * Blocks switch over purely on date, so a coach builds next month's block ahead
 * of time and it takes over on its own. `is_active_override` is the escape
 * hatch: true forces a block live, false takes one out of rotation.
 *
 * Ties (overlapping blocks) go to the one that started most recently, then to
 * the shorter block — a targeted 2-week block laid over a monthly one wins.
 *
 * `programs` is an array of `{ id, teamId, positionGroup, startDate, endDate,
 * isActiveOverride }` objects (a "ProgramLike" shape — callers pass either a
 * full Program or just this minimal projection of one). `filter` is an
 * optional `{ teamId?, positionGroup? }` to scope the search. Returns the
 * winning program object, or `null` if nothing is live.
 */
export function resolveActiveProgram(programs, date, filter) {
  // Narrow to the right team/position, and drop anything explicitly shelved
  // (isActiveOverride === false) before even considering dates.
  const scoped = programs.filter((p) => {
    if (filter?.teamId && p.teamId !== filter.teamId) return false;
    if (filter?.positionGroup && p.positionGroup !== filter.positionGroup) return false;
    return p.isActiveOverride !== false;
  });

  // A manually forced block always wins outright, regardless of its dates.
  const forced = scoped.filter((p) => p.isActiveOverride === true);
  const candidates = forced.length ? forced : scoped.filter((p) => date >= p.startDate && date <= p.endDate);

  if (candidates.length === 0) return null;

  return [...candidates].sort((a, b) => {
    // Latest start wins; on a tie the block that ends sooner wins (the tighter,
    // more specific block laid over a longer one).
    if (a.startDate !== b.startDate) return b.startDate.localeCompare(a.startDate);
    return a.endDate.localeCompare(b.endDate);
  })[0];
}

/** True if `program` itself is the one resolveActiveProgram would pick for its own team/position/date. */
export function isProgramActiveOn(program, programs, date) {
  const active = resolveActiveProgram(programs, date, {
    teamId: program.teamId,
    positionGroup: program.positionGroup,
  });
  return active?.id === program.id;
}
