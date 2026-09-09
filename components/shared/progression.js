/**
 * How the four progression types are described to a coach — the single source
 * of truth for their wording, colour and explanation.
 *
 * The hints track the table in CLAUDE.md and the branches in
 * lib/domain/progression.js. If a rule changes there, change the hint here:
 * this is what a coach reads when deciding how an exercise should behave.
 */
export const PROGRESSION_TYPES = [
  {
    value: 'heavy_compound',
    label: 'Heavy compound',
    shortLabel: 'Heavy compound',
    tone: 'good',
    hint: 'Squat, deadlift, bench, barbell row. All sets hit the top of the rep range last time, suggest +2.5kg. Any set short, hold the weight.',
  },
  {
    value: 'light_compound_isolation',
    label: 'Isolation / light compound',
    shortLabel: 'Isolation',
    tone: 'info',
    hint: 'Curls, lateral raises, triceps. Top of the range on every set, suggest +1kg and drop back to the bottom of the range. Otherwise chase one more rep.',
  },
  {
    value: 'bodyweight_plyo',
    label: 'Bodyweight / plyometric',
    shortLabel: 'Bodyweight / plyo',
    tone: 'warn',
    hint: 'Box jumps, sprints, core. No weight suggestion at all. The player is shown last session and told to match or beat it, so you steer volume through the block.',
  },
  {
    value: 'carry_loaded',
    label: 'Loaded carry',
    shortLabel: 'Carry / sled',
    tone: 'neutral',
    hint: 'Farmer’s carries, sled work. Progresses on distance or time. Target hit last time, suggest more load, or a longer carry if there is no load to add.',
  },
];

// Quick value -> full entry lookup, so the three helpers below don't each re-scan the array.
const BY_VALUE = new Map(PROGRESSION_TYPES.map((entry) => [entry.value, entry]));

/** Full label for a progression type (e.g. "Heavy compound"), for forms/dropdowns. */
export function progressionLabel(type) {
  return BY_VALUE.get(type)?.label ?? type;
}

/** Compact label for a progression type (e.g. "Heavy compound" shortened), for badges in dense lists. */
export function progressionShortLabel(type) {
  return BY_VALUE.get(type)?.shortLabel ?? type;
}

/** Badge colour tone associated with a progression type. */
export function progressionTone(type) {
  return BY_VALUE.get(type)?.tone ?? 'neutral';
}
