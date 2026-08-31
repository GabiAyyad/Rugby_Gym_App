'use client';

import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, ApiError } from '@/lib/api';
import { formatShortDate } from '@/lib/domain/week';
import type { PlayerHistoryResult, ProgressPoint } from '@/types/session';
import { Card, CardBody, CardHeader, EmptyState, ErrorNote, Select, cn } from '@/components/shared';

type Series = PlayerHistoryResult['series'];

const TOP_SET_COLOUR = 'var(--color-pitch-500)';
const ONE_RM_COLOUR = 'var(--color-flare-500)';

/**
 * Weight over time for one exercise. Client-only: recharts measures the DOM, so
 * it must not run during the server render.
 */
export function ProgressChart({
  exercises,
  initialSeries,
}: {
  exercises: Array<{ id: string; name: string }>;
  initialSeries: Series;
}) {
  const [series, setSeries] = useState<Series>(initialSeries);
  const [selected, setSelected] = useState(initialSeries?.exerciseId ?? exercises[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(exerciseId: string) {
    setSelected(exerciseId);
    setBusy(true);
    setError(null);
    try {
      // limit=1 keeps the session list out of the payload; only the series matters.
      const result = await api.get<PlayerHistoryResult>(
        `/api/player/history?exerciseId=${encodeURIComponent(exerciseId)}&limit=1`,
      );
      setSeries(result.series);
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not load that exercise.');
    } finally {
      setBusy(false);
    }
  }

  if (exercises.length === 0) {
    return (
      <EmptyState
        title="No progress to plot yet"
        description="Once you have logged an exercise twice, your weight over time shows up here."
      />
    );
  }

  const points = series?.points ?? [];
  const weighted = points.filter((point) => point.topWeightKg !== null);
  const latest = weighted[weighted.length - 1] ?? null;
  const best = weighted.reduce<ProgressPoint | null>(
    (top, point) => (top === null || (point.topWeightKg ?? 0) > (top.topWeightKg ?? 0) ? point : top),
    null,
  );

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <Select
          label="Progress"
          value={selected}
          disabled={busy}
          onChange={(event) => void choose(event.target.value)}
        >
          {exercises.map((exercise) => (
            <option key={exercise.id} value={exercise.id}>
              {exercise.name}
            </option>
          ))}
        </Select>
        <ErrorNote message={error} />
      </CardHeader>

      <CardBody className={cn('transition-opacity', busy && 'opacity-50')}>
        {weighted.length < 2 ? (
          <div className="py-6 text-center">
            <p className="text-sm font-semibold text-ink-200">Not enough data yet</p>
            <p className="mx-auto mt-1 max-w-xs text-sm text-ink-400">
              {weighted.length === 1
                ? `One session logged at ${formatWeight(weighted[0].topWeightKg)}. Log this exercise again to see the trend.`
                : points.length > 0
                  ? 'No weights logged for this exercise — bodyweight work is tracked by reps instead.'
                  : 'Log this exercise twice and the line appears here.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-6 gap-y-2 pb-3">
              <Figure label="Latest top set" value={formatWeight(latest?.topWeightKg ?? null)} colour={TOP_SET_COLOUR} />
              <Figure label="Best top set" value={formatWeight(best?.topWeightKg ?? null)} colour={TOP_SET_COLOUR} />
              <Figure
                label="Est. 1RM"
                value={formatWeight(latest?.estimatedOneRepMaxKg ?? null)}
                colour={ONE_RM_COLOUR}
              />
            </div>

            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
                  <CartesianGrid vertical={false} stroke="var(--color-ink-800)" strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortTick}
                    tick={{ fill: 'var(--color-ink-400)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-ink-800)' }}
                    minTickGap={28}
                  />
                  <YAxis
                    width={44}
                    tick={{ fill: 'var(--color-ink-400)', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    domain={['dataMin - 5', 'dataMax + 5']}
                    allowDecimals={false}
                  />
                  <Tooltip
                    trigger="click"
                    cursor={{ stroke: 'var(--color-ink-600)', strokeWidth: 1 }}
                    contentStyle={{
                      background: 'var(--color-ink-900)',
                      border: '1px solid var(--color-ink-700)',
                      borderRadius: 12,
                      fontSize: 12,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                    labelStyle={{ color: 'var(--color-ink-200)', marginBottom: 4 }}
                    itemStyle={{ padding: 0 }}
                    labelFormatter={(value) => formatShortDate(String(value))}
                  />
                  <Line
                    type="monotone"
                    dataKey="topWeightKg"
                    name="Top set"
                    unit=" kg"
                    stroke={TOP_SET_COLOUR}
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: TOP_SET_COLOUR, strokeWidth: 0 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="estimatedOneRepMaxKg"
                    name="Est. 1RM"
                    unit=" kg"
                    stroke={ONE_RM_COLOUR}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{ r: 4 }}
                    connectNulls
                    isAnimationActive={false}
                  />
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

function Figure({ label, value, colour }: { label: string; value: string; colour: string }) {
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[0.7rem] text-ink-400">
        <span aria-hidden className="size-2 rounded-full" style={{ background: colour }} />
        {label}
      </p>
      <p className="tabular text-lg font-semibold text-ink-50">{value}</p>
    </div>
  );
}

function formatWeight(value: number | null): string {
  return value === null ? '—' : `${round1(value)} kg`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** "31/8" — short enough that ticks never collide on a phone. */
function shortTick(value: string): string {
  const [, month, day] = value.split('-');
  return `${Number(day)}/${Number(month)}`;
}
