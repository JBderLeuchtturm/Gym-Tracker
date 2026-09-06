/**
 * Zeichnet einen Wochenrückblick als Bild - zum Teilen mit Freunden.
 *
 * Alles auf einer Leinwand, ohne fremde Bibliothek: ein dunkler Grund, die vier
 * Zahlen gross, darunter die Wochen als Balken. Die Farben sind aus der App
 * uebernommen, damit das Bild als ihres erkennbar bleibt.
 */

export interface WeekCardData {
  title: string;
  rangeLabel: string;
  stats: Array<{ label: string; value: string }>;
  /** Bis zu 12 Wochen Volumen fuer die Balkenreihe. */
  weeks: Array<{ label: string; value: number }>;
  footer: string;
}

const W = 1080;
const H = 1350;

const COLORS = {
  bg: '#0c0d0f',
  card: '#14161a',
  border: '#313640',
  text: '#e9e6e1',
  dim: '#9d9890',
  accent: '#c8813c',
  time: '#6b8ca6',
};

export async function renderWeekCard(data: WeekCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas nicht verfügbar');

  const font = (size: number, weight = 400) =>
    `${weight} ${size}px -apple-system, "Segoe UI", Roboto, sans-serif`;

  ctx.fillStyle = COLORS.bg;
  ctx.fillRect(0, 0, W, H);

  const pad = 80;

  // Kopf
  ctx.fillStyle = COLORS.text;
  ctx.font = font(58, 700);
  ctx.fillText(data.title, pad, 140);
  ctx.fillStyle = COLORS.dim;
  ctx.font = font(30, 500);
  ctx.fillText(data.rangeLabel, pad, 186);

  // Kennzahlen: zwei Spalten, zwei Zeilen
  const cellW = (W - pad * 2 - 40) / 2;
  const cellH = 190;
  data.stats.slice(0, 4).forEach((stat, index) => {
    const col = index % 2;
    const rowIndex = Math.floor(index / 2);
    const x = pad + col * (cellW + 40);
    const y = 250 + rowIndex * (cellH + 24);
    ctx.fillStyle = COLORS.card;
    roundRect(ctx, x, y, cellW, cellH, 20);
    ctx.fill();
    ctx.fillStyle = COLORS.dim;
    ctx.font = font(28, 600);
    ctx.fillText(stat.label, x + 36, y + 60);
    ctx.fillStyle = COLORS.text;
    ctx.font = font(84, 400);
    ctx.fillText(stat.value, x + 36, y + 150);
  });

  // Balkenreihe
  const chartTop = 250 + 2 * (cellH + 24) + 40;
  const chartH = 320;
  const chartW = W - pad * 2;
  const max = Math.max(1, ...data.weeks.map((week) => week.value));
  const slot = chartW / Math.max(data.weeks.length, 1);
  const barW = Math.min(70, slot * 0.6);

  ctx.fillStyle = COLORS.dim;
  ctx.font = font(26, 600);
  ctx.fillText('Volumen je Woche', pad, chartTop - 24);

  data.weeks.forEach((week, index) => {
    const barH = (week.value / max) * chartH;
    const x = pad + slot * index + (slot - barW) / 2;
    const y = chartTop + chartH - barH;
    ctx.fillStyle = index === data.weeks.length - 1 ? COLORS.accent : COLORS.time;
    roundRect(ctx, x, y, barW, Math.max(4, barH), 8);
    ctx.fill();
    if (index % 2 === 0) {
      ctx.fillStyle = COLORS.dim;
      ctx.font = font(20, 500);
      ctx.fillText(week.label, x - 6, chartTop + chartH + 34);
    }
  });

  // Fuss
  ctx.fillStyle = COLORS.dim;
  ctx.font = font(26, 500);
  ctx.fillText(data.footer, pad, H - 70);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Bild konnte nicht erzeugt werden'))), 'image/png');
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

/**
 * Bietet das Bild zum Teilen oder Speichern an. Wo die Datei-Freigabe fehlt,
 * wird es als Download angeboten.
 */
export async function shareOrDownload(blob: Blob, filename: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return 'shared';
    } catch {
      /* Abgebrochen ist kein Fehler - dann eben herunterladen. */
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return 'downloaded';
}
