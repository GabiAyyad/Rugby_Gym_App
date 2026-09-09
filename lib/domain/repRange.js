/**
 * target_reps is free text so a coach can write "8-10", "5", "AMRAP", "40m" or
 * "30s". Parsing it is what lets the progression rules reason about it.
 */

/**
 * "8-10" -> {min:8,max:10}; "5" -> {min:5,max:5}; "AMRAP" -> null.
 * Accepts a hyphen, en/em dash, or the word "to" between the two numbers
 * (coaches type all three). Returns null when the text isn't a rep range at
 * all (e.g. "AMRAP", or a distance/time target — see parseMeasure for those).
 */
export function parseRepRange(target) {
  const cleaned = target.trim().replace(/\s/g, '');
  const range = cleaned.match(/^(\d+)[-–—to]+(\d+)$/i);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    // A coach might type "10-8" by mistake; normalise so min is always <= max.
    return min <= max ? { min, max } : { min: max, max: min };
  }
  const single = cleaned.match(/^(\d+)$/);
  if (single) {
    const n = Number(single[1]);
    return { min: n, max: n };
  }
  return null;
}

/** "40m" -> {value:40,unit:'m'}; "30s" -> {value:30,unit:'s'}; "2 laps" -> {value:2,unit:'laps'}. */
export function parseMeasure(target) {
  const match = target.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/);
  if (!match) return null;
  return { value: Number(match[1]), unit: match[2].toLowerCase() || 'reps' };
}

/** Renders a {value, unit} measure back to display text, e.g. {40,'m'} -> "40m". */
export function formatMeasure(measure) {
  const rounded = Math.round(measure.value * 100) / 100;
  return measure.unit === 'reps' ? String(rounded) : `${rounded}${measure.unit}`;
}
