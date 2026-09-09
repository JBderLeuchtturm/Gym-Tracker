import { t } from '../i18n';
import { DIVISION_LABELS, TIERS, TIER_LABELS, type Division, type Rank, type RankTier } from '../lib/ranks';

/**
 * Das Rang-Abzeichen.
 *
 * Selbst gezeichnet wie alles andere hier - ein Wappen, dessen Form fuer alle
 * Stufen gleich bleibt und dessen Farbe und Fuellung sie unterscheidet. Die
 * Division steht als roemische Ziffer darin.
 *
 * Warum ueberhaupt ein Bild und nicht nur das Wort "Gold II"? Weil man ein
 * Abzeichen im Vorbeigehen erkennt. Auf der Trainingsseite steht es klein
 * neben jeder Uebung; wer dort liest, hat schon verloren.
 */

export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

const PIXELS: Record<BadgeSize, number> = { xs: 20, sm: 28, md: 44, lg: 84 };

/** Wie viele Punkte die Stufe im Wappen bekommt - je hoeher, desto reicher. */
const ORNAMENT: Record<RankTier, number> = {
  bronze: 0, silber: 0, gold: 1, diamant: 2, emerald: 2, elite: 3,
};

export function RankBadge({
  rank, size = 'sm', showLabel = false, dim = false,
}: {
  rank: Rank;
  size?: BadgeSize;
  showLabel?: boolean;
  dim?: boolean;
}) {
  const px = PIXELS[size];
  const id = `${rank.tier}-${rank.division}`;
  const label = t('{tier} {division}', {
    tier: t(TIER_LABELS[rank.tier]), division: DIVISION_LABELS[rank.division],
  });

  return (
    <span className={`rbadge rbadge--${size} ${dim ? 'rbadge--dim' : ''}`}>
      <svg
        className={`rbadge__art rbadge__art--${rank.tier}`}
        width={px}
        height={px}
        viewBox="0 0 48 48"
        role="img"
        aria-label={label}
      >
        <defs>
          <linearGradient id={`rb-${id}`} x1="0" y1="0" x2="0.4" y2="1">
            <stop offset="0%" stopColor="var(--tier-light)" />
            <stop offset="100%" stopColor="var(--tier-dark)" />
          </linearGradient>
        </defs>

        {/* Das Wappen: oben breit, unten spitz. */}
        <path
          d="M24 2 43 9v17c0 9-8 16-19 20C13 42 5 35 5 26V9z"
          fill={`url(#rb-${id})`}
          stroke="var(--tier-edge)"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        {/* Innenkante - gibt dem Metall Tiefe. */}
        <path
          d="M24 7 38 12v14c0 6.6-5.9 11.9-14 15.1C15.9 37.9 10 32.6 10 26V12z"
          fill="none"
          stroke="var(--tier-edge)"
          strokeWidth="0.9"
          opacity="0.5"
        />

        <text
          x="24"
          y="27"
          textAnchor="middle"
          className="rbadge__roman"
          fill="var(--tier-ink)"
        >
          {DIVISION_LABELS[rank.division]}
        </text>

        {/* Sterne fuer die hoeheren Stufen. */}
        {Array.from({ length: ORNAMENT[rank.tier] }, (_, index) => {
          const count = ORNAMENT[rank.tier];
          const spread = 6.5;
          const x = 24 + (index - (count - 1) / 2) * spread;
          return <circle key={index} cx={x} cy={35} r="1.7" fill="var(--tier-ink)" opacity="0.85" />;
        })}
      </svg>

      {showLabel && <span className="rbadge__label">{label}</span>}
    </span>
  );
}

/**
 * Alle achtzehn Abzeichen in einer Reihe - fuer die Erklaerung.
 * Das erreichte hebt sich ab, der Rest steht blass daneben.
 */
export function RankLadder({ current }: { current: Rank }) {
  return (
    <div className="rladder">
      {TIERS.map((tier) => (
        <div key={tier} className="rladder__tier">
          <div className="rladder__badges">
            {([1, 2, 3] as Division[]).map((division) => {
              const reached = TIERS.indexOf(tier) < TIERS.indexOf(current.tier)
                || (tier === current.tier && division <= current.division);
              const isNow = tier === current.tier && division === current.division;
              return (
                <span key={division} className={isNow ? 'is-now' : ''}>
                  <RankBadge
                    rank={{
                      tier,
                      division,
                      score: 0,
                      share: 0,
                      toNext: null,
                      label: `${TIER_LABELS[tier]} ${DIVISION_LABELS[division]}`,
                    }}
                    size="xs"
                    dim={!reached}
                  />
                </span>
              );
            })}
          </div>
          <div className="tiny dim">{t(TIER_LABELS[tier])}</div>
        </div>
      ))}
    </div>
  );
}
