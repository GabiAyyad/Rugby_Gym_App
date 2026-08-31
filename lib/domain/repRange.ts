/**
 * target_reps is free text so a coach can write "8-10", "5", "AMRAP", "40m" or
 * "30s". Parsing it is what lets the progression rules reason about it.
 */

export interface RepRange {
  min: number;
  max: number;
}

/** "8-10" -> {min:8,max:10}; "5" -> {min:5,max:5}; "AMRAP" -> null. */
export function parseRepRange(target: string): RepRange | null {
  const cleaned = target.trim().replace(/\s/g, '');
  const range = cleaned.match(/^(\d+)[-–—to]+(\d+)$/i);
  if (range) {
    const min = Number(range[1]);
    const max = Number(range[2]);
    return min <= max ? { min, max } : { min: max, max: min };
  }
  const single = cleaned.match(/^(\d+)$/);
  if (single) {
    const n = Number(single[1]);
    return { min: n, max: n };
  }
  return null;
}

export interface Measure {
  value: number;
  unit: string;
}

/** "40m" -> {value:40,unit:'m'}; "30s" -> {value:30,unit:'s'}; "2 laps" -> {value:2,unit:'laps'}. */
export function parseMeasure(target: string): Measure | null {
  const match = target.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]*)$/);
  if (!match) return null;
  return { value: Number(match[1]), unit: match[2].toLowerCase() || 'reps' };
}

export function formatMeasure(measure: Measure): string {
  const rounded = Math.round(measure.value * 100) / 100;
  return measure.unit === 'reps' ? String(rounded) : `${rounded}${measure.unit}`;
}
