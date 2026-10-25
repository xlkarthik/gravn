'use client';

import {
  buildMeasurementSeries,
  type MeasurementDefinition,
  type MeasurementEntry,
  type MeasurementUnit,
} from '@gravn/shared';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';

import { deleteBodyMeasurementAction, recordBodyMeasurementAction } from '../app/workout-actions';

interface Props {
  subjectUserId: string;
  workspaceId: string | null;
  unitSystem: 'metric' | 'imperial';
  definitions: MeasurementDefinition[];
  entries: MeasurementEntry[];
  subjectLabel?: string;
}

export function MeasurementsPanel({
  subjectUserId,
  workspaceId,
  unitSystem,
  definitions,
  entries,
  subjectLabel,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedDefId, setSelectedDefId] = useState<string>(definitions[0]?.id ?? 'weight');
  const [valueInput, setValueInput] = useState('');
  const [dateInput, setDateInput] = useState(() => new Date().toISOString().slice(0, 10));
  const [noteInput, setNoteInput] = useState('');

  const activeDef = useMemo(
    () => definitions.find((d) => d.id === selectedDefId) ?? definitions[0] ?? null,
    [definitions, selectedDefId],
  );

  const activeUnit: MeasurementUnit = useMemo(() => {
    if (!activeDef) return 'kg';
    return (
      unitSystem === 'imperial' ? activeDef.imperial_unit : activeDef.metric_unit
    ) as MeasurementUnit;
  }, [activeDef, unitSystem]);

  const filteredEntries = useMemo(
    () => entries.filter((e) => e.definition_id === selectedDefId),
    [entries, selectedDefId],
  );

  const series = useMemo(() => buildMeasurementSeries(filteredEntries), [filteredEntries]);

  // Build SVG path segments where null points break the path (gaps stay gaps, never 0)
  const svgPaths = useMemo(() => {
    const validPoints = series.points.filter((p) => p.value !== null);
    if (validPoints.length === 0)
      return {
        segments: [] as string[],
        circles: [] as { cx: number; cy: number; label: string; date: string }[],
      };

    const W = 640;
    const H = 180;
    const padX = 28;
    const padY = 24;

    const maxDay = Math.max(1, series.points[series.points.length - 1]?.dayOffset ?? 1);
    const minVal = series.minValue ?? 0;
    const maxVal = series.maxValue ?? 100;
    const spanVal = Math.max(1, maxVal - minVal);

    const segments: string[] = [];
    const circles: { cx: number; cy: number; label: string; date: string }[] = [];
    let currentPath = '';

    for (const pt of series.points) {
      if (pt.value === null) {
        if (currentPath) {
          segments.push(currentPath);
          currentPath = '';
        }
        continue;
      }
      const x = validPoints.length === 1 ? W / 2 : padX + (pt.dayOffset / maxDay) * (W - padX * 2);
      const y = spanVal === 0 ? H / 2 : H - padY - ((pt.value - minVal) / spanVal) * (H - padY * 2);

      currentPath += currentPath
        ? ` L ${x.toFixed(1)} ${y.toFixed(1)}`
        : `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      circles.push({
        cx: x,
        cy: y,
        label: `${pt.value} ${activeUnit}`,
        date: pt.date,
      });
    }
    if (currentPath) segments.push(currentPath);
    return { segments, circles };
  }, [series, activeUnit]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Definition Selector Pills */}
      <div className="lux-pills">
        {definitions.map((def) => {
          const count = entries.filter((e) => e.definition_id === def.id).length;
          return (
            <button
              key={def.id}
              type="button"
              className={`lux-pill ${selectedDefId === def.id ? 'active' : ''}`}
              onClick={() => setSelectedDefId(def.id)}
            >
              {def.label}
              {count > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
      </div>

      {/* Summary Stat Strip */}
      {activeDef && (
        <div className="lux-stats-row" style={{ marginBottom: 0 }}>
          <div className="lux-stat">
            <span className="lux-stat-label">Latest {activeDef.label}</span>
            <span className="lux-stat-value mono">
              {series.latestValue !== null ? (
                <>
                  {series.latestValue}{' '}
                  <small style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    {activeUnit}
                  </small>
                </>
              ) : (
                '—'
              )}
            </span>
            <span className="lux-stat-sub">
              {filteredEntries[0]
                ? `Recorded ${filteredEntries[0].measured_on.slice(0, 10)}`
                : 'No entries yet'}
            </span>
          </div>

          <div className="lux-stat">
            <span className="lux-stat-label">Net Change</span>
            <span className="lux-stat-value mono">
              {series.delta !== null ? (
                <>
                  {series.delta > 0 ? `+${series.delta}` : series.delta}{' '}
                  <small style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
                    {activeUnit}
                  </small>
                </>
              ) : (
                '—'
              )}
            </span>
            <span className="lux-stat-sub">Since first entry</span>
          </div>

          <div className="lux-stat">
            <span className="lux-stat-label">Recorded Range</span>
            <span className="lux-stat-value mono" style={{ fontSize: '1.6rem' }}>
              {series.minValue !== null && series.maxValue !== null
                ? `${series.minValue} – ${series.maxValue}`
                : '—'}
            </span>
            <span className="lux-stat-sub">{filteredEntries.length} total check-ins</span>
          </div>
        </div>
      )}

      {/* Gap-Preserving Line Chart + Quick Record Form */}
      <div className="lux-surface">
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            marginBottom: 18,
          }}
        >
          <div>
            <span className="eyebrow">{subjectLabel ? `${subjectLabel} · ` : ''}Trendline</span>
            <h3 className="serif-md">
              {activeDef?.label ?? 'Measurement'} ({activeUnit})
            </h3>
          </div>
          {series.hasGaps && (
            <span className="muted" style={{ fontSize: 12 }}>
              Unrecorded dates shown as true intervals
            </span>
          )}
        </div>

        {svgPaths.circles.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              background: 'var(--bg)',
              borderRadius: 10,
              border: '1px dashed var(--border-strong)',
              marginBottom: 20,
            }}
          >
            <p className="muted">
              Record your first {activeDef?.label.toLowerCase()} check-in below to start your
              trendline.
            </p>
          </div>
        ) : (
          <div
            style={{
              background: 'var(--bg)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '16px 12px 10px',
              marginBottom: 20,
            }}
          >
            <svg
              viewBox="0 0 640 180"
              style={{ width: '100%', height: 180, overflow: 'visible' }}
              role="img"
              aria-label={`${activeDef?.label} trendline`}
            >
              <line
                x1="28"
                y1="24"
                x2="612"
                y2="24"
                stroke="rgba(255,255,255,0.05)"
                strokeDasharray="4 4"
              />
              <line
                x1="28"
                y1="90"
                x2="612"
                y2="90"
                stroke="rgba(255,255,255,0.05)"
                strokeDasharray="4 4"
              />
              <line
                x1="28"
                y1="156"
                x2="612"
                y2="156"
                stroke="rgba(255,255,255,0.05)"
                strokeDasharray="4 4"
              />

              {svgPaths.segments.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {svgPaths.circles.map((c, idx) => (
                <g key={idx}>
                  <circle
                    cx={c.cx}
                    cy={c.cy}
                    r="4.5"
                    fill="var(--bg)"
                    stroke="var(--accent)"
                    strokeWidth="2.5"
                  />
                  <title>{`${c.date}: ${c.label}`}</title>
                </g>
              ))}
            </svg>
          </div>
        )}

        {/* Log New Entry Bar */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
            alignItems: 'flex-end',
            paddingTop: 12,
            borderTop: '1px solid var(--border)',
          }}
        >
          <div style={{ width: 130 }}>
            <label className="lux-label">Value ({activeUnit})</label>
            <input
              className="lux-input mono"
              style={{ width: '100%', marginTop: 4 }}
              inputMode="decimal"
              placeholder={activeDef?.id === 'weight' ? '75.0' : '80.0'}
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
            />
          </div>

          <div style={{ width: 155 }}>
            <label className="lux-label">Date</label>
            <input
              type="date"
              className="lux-input mono"
              style={{ width: '100%', marginTop: 4 }}
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
            />
          </div>

          <div style={{ flex: 1, minWidth: 160 }}>
            <label className="lux-label">Note (Optional)</label>
            <input
              className="lux-input"
              style={{ width: '100%', marginTop: 4 }}
              placeholder="Morning check-in, post-training…"
              value={noteInput}
              onChange={(e) => setNoteInput(e.target.value)}
            />
          </div>

          <button
            type="button"
            className="btn"
            disabled={!valueInput.trim() || Number(valueInput) <= 0 || isPending}
            onClick={() => {
              const num = Number(valueInput);
              if (!Number.isFinite(num) || num <= 0 || !activeDef) return;
              startTransition(async () => {
                await recordBodyMeasurementAction({
                  subjectUserId,
                  workspaceId,
                  definitionId: activeDef.id,
                  value: num,
                  unit: activeUnit,
                  measuredOn: dateInput,
                  note: noteInput.trim(),
                });
                setValueInput('');
                setNoteInput('');
                router.refresh();
              });
            }}
          >
            {isPending ? 'Saving…' : `+ Log ${activeDef?.label ?? 'Entry'}`}
          </button>
        </div>
      </div>

      {/* Historical Entries List */}
      {filteredEntries.length > 0 && (
        <div className="lux-surface-flush">
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
            <span className="lux-label">
              {activeDef?.label} History ({filteredEntries.length})
            </span>
          </div>
          <div className="lux-list">
            {filteredEntries.map((entry) => (
              <div key={entry.id} className="lux-row">
                <div>
                  <div className="lux-row-title mono">
                    {entry.value} {entry.unit}
                  </div>
                  <div className="lux-row-sub">
                    {entry.measured_on.slice(0, 10)}
                    {entry.note ? ` · ${entry.note}` : ''}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn ghost sm"
                  disabled={isPending}
                  onClick={() => {
                    startTransition(async () => {
                      await deleteBodyMeasurementAction(entry.id, workspaceId);
                      router.refresh();
                    });
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
