import { t } from '../../i18n';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';

/** Misst die verfuegbare Breite, damit die Charts auf jedem Bildschirm passen. */
function useWidth(): [React.RefObject<HTMLDivElement>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(element.clientWidth || 320);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}

export interface Point {
  /** X-Wert als Zeitachse (ISO-Datum) oder Kategorie. */
  label: string;
  value: number;
  /** Zusatztext im Tooltip. */
  detail?: string;
}

/** Erzeugt "schoene" Achsenwerte (1, 2, 5, 10, ...). */
function niceTicks(min: number, max: number, count = 4): number[] {
  if (max === min) return [min];
  const rawStep = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  const step = (normalized >= 5 ? 10 : normalized >= 2 ? 5 : normalized >= 1 ? 2 : 1) * magnitude;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + step * 0.5; value += step) ticks.push(value);
  return ticks;
}

const formatTick = (value: number): string => {
  if (Math.abs(value) >= 10000) return `${Math.round(value / 1000)}k`;
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1).replace('.', ',')}k`;
  return value.toLocaleString('de-DE', { maximumFractionDigits: Math.abs(value) < 10 ? 1 : 0 });
};

/* ------------------------------------------------------------- Liniendiagramm */

export function LineChart({
  points, height = 190, color = 'var(--accent)', unit = '', showArea = true, formatValue,
}: {
  points: Point[];
  height?: number;
  color?: string;
  unit?: string;
  showArea?: boolean;
  formatValue?: (value: number) => string;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const padding = { top: 12, right: 10, bottom: 24, left: 38 };
  const innerWidth = Math.max(10, width - padding.left - padding.right);
  const innerHeight = height - padding.top - padding.bottom;

  const { min, max, ticks } = useMemo(() => {
    const values = points.map((point) => point.value);
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) { lo = 0; hi = 1; }
    if (lo === hi) { lo = lo - Math.max(1, Math.abs(lo) * 0.1); hi = hi + Math.max(1, Math.abs(hi) * 0.1); }
    const span = hi - lo;
    const paddedLo = Math.max(0, lo - span * 0.12);
    const paddedHi = hi + span * 0.12;
    return { min: paddedLo, max: paddedHi, ticks: niceTicks(paddedLo, paddedHi, 4) };
  }, [points]);

  const gradientId = useMemo(() => `grad_${Math.random().toString(36).slice(2, 8)}`, []);

  if (points.length === 0) {
    return <div ref={ref} className="empty tiny">{t("Noch keine Daten")}</div>;
  }

  const xOf = (index: number) =>
    padding.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
  const yOf = (value: number) =>
    padding.top + innerHeight - ((value - min) / (max - min || 1)) * innerHeight;

  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${xOf(index).toFixed(1)},${yOf(point.value).toFixed(1)}`).join(' ');
  const area = `${line} L${xOf(points.length - 1).toFixed(1)},${(padding.top + innerHeight).toFixed(1)} L${xOf(0).toFixed(1)},${(padding.top + innerHeight).toFixed(1)} Z`;

  const active = hover != null ? points[hover] : null;
  const show = (value: number) => (formatValue ? formatValue(value) : formatTick(value));

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <svg
        width={width}
        height={height}
        role="img"
        onMouseLeave={() => setHover(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.clientX - rect.left - padding.left;
          const index = Math.round((x / innerWidth) * (points.length - 1));
          setHover(Math.min(points.length - 1, Math.max(0, index)));
        }}
        onTouchStart={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const x = event.touches[0].clientX - rect.left - padding.left;
          const index = Math.round((x / innerWidth) * (points.length - 1));
          setHover(Math.min(points.length - 1, Math.max(0, index)));
        }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left} x2={width - padding.right}
              y1={yOf(tick)} y2={yOf(tick)}
              stroke="var(--border-soft)" strokeWidth="1"
            />
            <text
              x={padding.left - 6} y={yOf(tick) + 3.5}
              textAnchor="end" fontSize="9.5" fill="var(--text-dim)"
            >
              {formatTick(tick)}
            </text>
          </g>
        ))}

        {showArea && <path d={area} fill={`url(#${gradientId})`} />}
        <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />

        {points.map((point, index) => (
          <circle
            key={`${point.label}-${index}`}
            cx={xOf(index)} cy={yOf(point.value)}
            r={hover === index ? 4.6 : points.length > 30 ? 0 : 2.8}
            fill={hover === index ? color : 'var(--bg)'}
            stroke={color} strokeWidth="2"
          />
        ))}

        {hover != null && (
          <line
            x1={xOf(hover)} x2={xOf(hover)} y1={padding.top} y2={padding.top + innerHeight}
            stroke={color} strokeWidth="1" strokeDasharray="3 3" opacity="0.5"
          />
        )}

        <text x={padding.left} y={height - 6} fontSize="9.5" fill="var(--text-dim)">{points[0].label}</text>
        {points.length > 1 && (
          <text x={width - padding.right} y={height - 6} fontSize="9.5" fill="var(--text-dim)" textAnchor="end">
            {points[points.length - 1].label}
          </text>
        )}
      </svg>

      {active && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(Math.max(4, xOf(hover!) - 50), Math.max(4, width - 116)),
            top: 2,
          }}
        >
          <div className="bold">{show(active.value)}{unit && ` ${unit}`}</div>
          <div className="dim tiny">{active.detail ?? active.label}</div>
        </div>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Balken */

export function BarChart({
  points, height = 170, color = 'var(--accent)', unit = '',
}: {
  points: Point[];
  height?: number;
  color?: string;
  unit?: string;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  if (points.length === 0) {
    return <div ref={ref} className="empty tiny">{t("Noch keine Daten")}</div>;
  }

  const padding = { top: 12, right: 8, bottom: 22, left: 38 };
  const innerWidth = Math.max(10, width - padding.left - padding.right);
  const innerHeight = height - padding.top - padding.bottom;
  const max = Math.max(...points.map((point) => point.value), 1);
  const ticks = niceTicks(0, max, 3);
  const top = Math.max(max, ticks[ticks.length - 1]);
  const slot = innerWidth / points.length;
  const barWidth = Math.max(4, Math.min(34, slot * 0.62));
  // Jede Beschriftung braucht ~34 px - sonst nur jede n-te anzeigen.
  const labelStep = Math.max(1, Math.ceil(34 / slot));

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <svg width={width} height={height} onMouseLeave={() => setHover(null)}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left} x2={width - padding.right}
              y1={padding.top + innerHeight - (tick / top) * innerHeight}
              y2={padding.top + innerHeight - (tick / top) * innerHeight}
              stroke="var(--border-soft)"
            />
            <text
              x={padding.left - 6}
              y={padding.top + innerHeight - (tick / top) * innerHeight + 3.5}
              textAnchor="end" fontSize="9.5" fill="var(--text-dim)"
            >
              {formatTick(tick)}
            </text>
          </g>
        ))}

        {points.map((point, index) => {
          const barHeight = (point.value / top) * innerHeight;
          const x = padding.left + slot * index + (slot - barWidth) / 2;
          const y = padding.top + innerHeight - barHeight;
          return (
            <g key={`${point.label}-${index}`} onMouseEnter={() => setHover(index)}>
              <rect
                x={padding.left + slot * index} y={padding.top}
                width={slot} height={innerHeight} fill="transparent"
              />
              <rect
                x={x} y={y} width={barWidth} height={Math.max(1.5, barHeight)}
                rx={Math.min(4, barWidth / 2)}
                fill={color} opacity={hover == null || hover === index ? 1 : 0.45}
              />
              {index % labelStep === 0 && (
                <text
                  x={x + barWidth / 2} y={height - 6}
                  textAnchor="middle" fontSize="9" fill="var(--text-dim)"
                >
                  {point.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hover != null && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(Math.max(4, padding.left + slot * hover - 30), Math.max(4, width - 120)),
            top: 2,
          }}
        >
          <div className="bold">{formatTick(points[hover].value)}{unit && ` ${unit}`}</div>
          <div className="dim tiny">{points[hover].detail ?? points[hover].label}</div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ Sparkline */

export function Sparkline({
  values, width = 74, height = 26, color = 'var(--accent)',
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const path = values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * (width - 2) + 1;
      const y = height - 2 - ((value - min) / span) * (height - 4);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ------------------------------------------------- Gestapeltes Balkendiagramm */

export interface StackedPoint {
  label: string;
  /** Reihenname -> Wert. */
  values: Record<string, number>;
  detail?: string;
}

/**
 * Zeigt mehrere Reihen uebereinander - hier: Saetze je Muskelgruppe und Woche.
 * So sieht man Gesamtumfang und Verteilung in einem Bild.
 */
export function StackedBarChart({
  points, series, colors, height = 200, unit = '',
}: {
  points: StackedPoint[];
  /** Reihenfolge der Reihen von unten nach oben. */
  series: string[];
  colors: Record<string, string>;
  height?: number;
  unit?: string;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const padding = { top: 12, right: 8, bottom: 22, left: 34 };
  const innerWidth = Math.max(10, width - padding.left - padding.right);
  const innerHeight = height - padding.top - padding.bottom;

  const totals = points.map((point) =>
    series.reduce((sum, name) => sum + (point.values[name] ?? 0), 0));
  const max = Math.max(1, ...totals);
  const ticks = niceTicks(0, max, 3);
  const top = Math.max(max, ticks[ticks.length - 1]);

  if (points.length === 0) {
    return <div ref={ref} className="empty tiny">{t("Noch keine Daten")}</div>;
  }

  const slot = innerWidth / points.length;
  const barWidth = Math.max(4, Math.min(32, slot * 0.66));
  const labelStep = Math.max(1, Math.ceil(34 / slot));

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <svg width={width} height={height} onMouseLeave={() => setHover(null)}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={padding.left} x2={width - padding.right}
              y1={padding.top + innerHeight - (tick / top) * innerHeight}
              y2={padding.top + innerHeight - (tick / top) * innerHeight}
              stroke="var(--border-soft)"
            />
            <text
              x={padding.left - 6}
              y={padding.top + innerHeight - (tick / top) * innerHeight + 3.5}
              textAnchor="end" fontSize="9.5" fill="var(--text-dim)"
            >
              {formatTick(tick)}
            </text>
          </g>
        ))}

        {points.map((point, index) => {
          const x = padding.left + slot * index + (slot - barWidth) / 2;
          let cursor = padding.top + innerHeight;
          return (
            <g key={`${point.label}-${index}`} onMouseEnter={() => setHover(index)}>
              <rect
                x={padding.left + slot * index} y={padding.top}
                width={slot} height={innerHeight} fill="transparent"
              />
              {series.map((name) => {
                const value = point.values[name] ?? 0;
                if (value <= 0) return null;
                const segment = (value / top) * innerHeight;
                cursor -= segment;
                return (
                  <rect
                    key={name}
                    x={x} y={cursor} width={barWidth} height={Math.max(1, segment - 0.5)}
                    fill={colors[name] ?? 'var(--text-dim)'}
                    opacity={hover == null || hover === index ? 1 : 0.4}
                    rx={1.5}
                  />
                );
              })}
              {index % labelStep === 0 && (
                <text
                  x={x + barWidth / 2} y={height - 6}
                  textAnchor="middle" fontSize="9" fill="var(--text-dim)"
                >
                  {point.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hover != null && (
        <div
          className="chart-tooltip"
          style={{
            left: Math.min(Math.max(4, padding.left + slot * hover - 40), Math.max(4, width - 150)),
            top: 2,
          }}
        >
          <div className="bold">{points[hover].detail ?? points[hover].label}</div>
          {series
            .filter((name) => (points[hover].values[name] ?? 0) > 0)
            .map((name) => (
              <div key={name} className="tiny" style={{ color: colors[name] }}>
                {name}: {points[hover].values[name]}{unit && ` ${unit}`}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
