'use client';

import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, ApiError } from '@/lib/api';
import { formatShortDate } from '@/lib/domain/week';
import { Card, CardBody, CardHeader, EmptyState, ErrorNote, Select, cn } from '@/components/shared';

const TOP_SET_COLOUR = 'var(--pitch-500)'; // the solid line: heaviest weight logged that session
const ONE_RM_COLOUR = 'var(--flare-500)'; // the dashed line: estimated one-rep-max from that top set

/**
 * Line chart of weight-over-time for one exercise, on /player/history. Backed
 * by recharts, which measures the DOM to lay itself out — that only works in
 * the browser, so this whole component is client-only ('use client' above)
 * and must never run during the server render.
 *
 * @param {object} props
 * @param {Array<{id: string, name: string}>} props.exercises Every exercise the
 *   player has ever logged, for the dropdown selector.
 * @param {object|null} props.initialSeries The chart series for whichever
 *   exercise the page picked by default (most recently logged), rendered
 *   server-side so the chart has data on first paint.
 */
export function ProgressChart({ exercises, initialSeries }) {
  const [series, setSeries] = useState(initialSeries);
  const [selected, setSelected] = useState(initialSeries?.exerciseId ?? exercises[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  /** Fires when the exercise dropdown changes: re-fetches just that exercise's series. */
  async function choose(exerciseId) {
    setSelected(exerciseId);
    setBusy(true);
    setError(null);
    try {
      // limit=1 keeps the session list out of the payload; only the series matters.
      const result = await api.get(`/api/player/history?exerciseId=${encodeURIComponent(exerciseId)}&limit=1`);
      setSeries(result.series);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load that exercise.');
    } finally {
      setBusy(false);
    }
  }

  if (exercises.length === 0) {
    return <EmptyState title="No progress to plot yet" description="Once you have logged an exercise twice, your weight over time shows up here." />;
  }

  const points = series?.points ?? [];
  // Bodyweight exercises log reps but no weight — `weighted` narrows to points
  // that actually have a weight, since that's the only thing this chart plots.
  const weighted = points.filter((point) => point.topWeightKg !== null);
  const latest = weighted[weighted.length - 1] ?? null;
  const best = weighted.reduce((top, point) => (top === null || (point.topWeightKg ?? 0) > (top.topWeightKg ?? 0) ? point : top), null);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <Select label="Progress" value={selected} disabled={busy} onChange={(event) => void choose(event.target.value)}>
          {exercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name}
            </option>
          ))}
        </Select>
        <ErrorNote message={error} />
      </CardHeader>

      <CardBody className={cn(busy && 'opacity-50')}>
        {weighted.length < 2 ? (
          <div className="py-6 text-center">
            <p className="text-sm font-semibold text-ink-200">Not enough data yet</p>
            <p className="mt-1 text-sm text-ink-400" style={{ maxWidth: '20rem', margin: '0.25rem auto 0' }}>
              {weighted.length === 1
                ? `One session logged at ${formatWeight(weighted[0].topWeightKg)}. Log this exercise again to see the trend.`
                : points.length > 0
                  ? 'No weights logged for this exercise — bodyweight work is tracked by reps instead.'
                  : 'Log this exercise twice and the line appears here.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-4 pb-3">
              <Figure label="Latest top set" value={formatWeight(latest?.topWeightKg ?? null)} colour={TOP_SET_COLOUR} />
              <Figure label="Best top set" value={formatWeight(best?.topWeightKg ?? null)} colour={TOP_SET_COLOUR} />
              <Figure label="Est. 1RM" value={formatWeight(latest?.estimatedOneRepMaxKg ?? null)} colour={ONE_RM_COLOUR} />
            </div>

            <div style={{ height: '14rem', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid vertical={false} stroke="var(--ink-800)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tickFormatter={shortTick} tick={{ fill: 'var(--ink-400)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--ink-800)' }} minTickGap={28} />
                  <YAxis width={44} tick={{ fill: 'var(--ink-400)', fontSize: 11 }} tickLine={false} axisLine={false} domain={['dataMin - 5', 'dataMax + 5']} allowDecimals={false} />
                  <Tooltip
                    trigger="click"
                    cursor={{ stroke: 'var(--ink-600)', strokeWidth: 1 }}
                    contentStyle={{ background: 'var(--ink-900)', border: '1px solid var(--ink-700)', borderRadius: 12, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
                    labelStyle={{ color: 'var(--ink-200)', marginBottom: 4 }}
                    itemStyle={{ padding: 0 }}
                    labelFormatter={(value) => formatShortDate(String(value))}
                  />
                  <Line type="monotone" dataKey="topWeightKg" name="Top set" unit=" kg" stroke={TOP_SET_COLOUR} strokeWidth={2.5} dot={{ r: 3, fill: TOP_SET_COLOUR, strokeWidth: 0 }} activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
                  <Line type="monotone" dataKey="estimatedOneRepMaxKg" name="Est. 1RM" unit=" kg" stroke={ONE_RM_COLOUR} strokeWidth={2} strokeDasharray="5 4" dot={false} activeDot={{ r: 4 }} connectNulls isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <p className="pt-2 text-center text-xs text-ink-400">Tap the chart to read a session.</p>
          </>
        )}
      </CardBody>
    </Card>
  );
}

/** One small labelled number above the chart (Latest/Best top set, Est. 1RM), with a coloured dot matching its line. */
function Figure({ label, value, colour }) {
  return (
    <div>
      <p className="flex items-center gap-1-5 text-ink-400" style={{ fontSize: '0.7rem' }}>
        <span aria-hidden className="size-3 rounded-full" style={{ background: colour }} />
        {label}
      </p>
      <p className="tabular text-lg font-semibold text-ink-50">{value}</p>
    </div>
  );
}

/** Formats a nullable weight as "102.5 kg", or an em-dash if there's no data. */
function formatWeight(value) {
  return value === null ? '—' : `${round1(value)} kg`;
}

/** Rounds to 1 decimal place. */
function round1(value) {
  return Math.round(value * 10) / 10;
}

/** Turns an x-axis date ('YYYY-MM-DD') into "31/8" — short enough that ticks never collide on a phone. */
function shortTick(value) {
  const [, month, day] = value.split('-');
  return `${Number(day)}/${Number(month)}`;
}
