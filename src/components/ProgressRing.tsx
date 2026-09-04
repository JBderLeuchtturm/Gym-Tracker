/**
 * Runder Fortschrittsanzeiger fuer die Tagesuebersicht.
 * Zeigt auf einen Blick, wie viel vom geplanten Training schon steht.
 */
export function ProgressRing({
  value, max, size = 84, stroke = 8, color = 'var(--accent)', children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = max > 0 ? Math.min(1, value / max) : 0;
  const complete = ratio >= 1;

  return (
    <div className="hero__ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="var(--surface-3)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none"
          stroke={complete ? 'var(--success)' : color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          style={{ transition: 'stroke-dashoffset 0.6s cubic-bezier(0.2, 0.8, 0.3, 1), stroke 0.3s' }}
        />
      </svg>
      <div className="hero__ring-label">{children}</div>
    </div>
  );
}
