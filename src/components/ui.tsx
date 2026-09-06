import { t } from '../i18n';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from './icons';
import { formatDateLong } from '../lib/date';

/* ---------------------------------------------------------------- Modal */

export function Modal({
  title, onClose, children, flush = false, actions,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  flush?: boolean;
  actions?: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  /*
   * Der Dialog haengt am Dokument, nicht an der Stelle, von der er geoeffnet
   * wurde. "position: fixed" bezieht sich sonst auf den naechsten Vorfahren
   * mit transform, filter oder Aehnlichem - und dann klebt ein Dialog, der aus
   * einer Uebungskarte heraus aufgeht, an dieser Karte statt am Bildschirm.
   */
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal__head">
          <h2 style={{ flex: 1, minWidth: 0 }}>{title}</h2>
          {actions}
          <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label={t("Schließen")}>
            <IconX />
          </button>
        </div>
        <div className={flush ? 'modal__body modal__body--flush' : 'modal__body'}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

/* -------------------------------------------------------------- Bestätigung */

export function ConfirmDialog({
  title, message, confirmLabel = t('Löschen'), onConfirm, onCancel,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="muted">{message}</p>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
        <button className="btn" onClick={onCancel}>{t("Abbrechen")}</button>
        <button className="btn btn--danger" onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- Toast */

/**
 * Kurze Rueckmeldung, wahlweise mit einem Handgriff daneben.
 *
 * Der Handgriff ist fast immer "Rueckgaengig". Loeschen ohne Umkehr ist in
 * einer App, die man mit feuchten Fingern neben der Hantelbank bedient, die
 * haerteste Strafe fuer einen Fehlgriff - und eine Rueckfrage vor jedem
 * Handgriff waere die zweithaerteste. Deshalb: erst tun, dann anbieten,
 * es zurueckzunehmen.
 */
export interface ToastAction {
  label: string;
  run: () => void;
}

interface ToastValue {
  show: (message: string, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastValue>({ show: () => {} });

/** Wie lange ein Rueckgaengig angeboten wird. */
const UNDO_MS = 7000;
const PLAIN_MS = 2400;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ text: string; action?: ToastAction; id: number } | null>(null);
  const timer = React.useRef<number | null>(null);

  const show = useCallback((text: string, action?: ToastAction) => {
    if (timer.current) window.clearTimeout(timer.current);
    const id = Date.now();
    setToast({ text, action, id });
    timer.current = window.setTimeout(
      () => setToast((current) => (current?.id === id ? null : current)),
      action ? UNDO_MS : PLAIN_MS,
    );
  }, []);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <div className="toast" role="status">
          <span className="toast__text">{toast.text}</span>
          {toast.action && (
            <button
              className="toast__action"
              onClick={() => {
                toast.action?.run();
                if (timer.current) window.clearTimeout(timer.current);
                setToast(null);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = (): ToastValue => useContext(ToastContext);

/* ---------------------------------------------------------- Zahlenfelder */

/**
 * Zahleneingabe, die auch leer sein darf. Waehrend des Tippens bleibt der
 * Rohtext erhalten, damit "12." oder "-" nicht sofort wegkorrigiert werden.
 */
export function NumberInput({
  value, onChange, placeholder, step = 1, min, max, suffix, className = '', ariaLabel,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  placeholder?: string;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value == null ? '' : String(value));

  const commit = (raw: string) => {
    setDraft(null);
    const text = raw.replace(',', '.').trim();
    if (text === '') { onChange(null); return; }
    const parsed = Number.parseFloat(text);
    if (!Number.isFinite(parsed)) { onChange(null); return; }
    let next = parsed;
    if (min != null) next = Math.max(min, next);
    if (max != null) next = Math.min(max, next);
    onChange(Math.round(next * 1000) / 1000);
  };

  return (
    <div style={{ position: 'relative' }}>
      <input
        className={`input input--num ${className}`}
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        value={shown}
        placeholder={placeholder}
        step={step}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') (event.target as HTMLInputElement).blur(); }}
      />
      {suffix && (
        <span className="tiny dim" style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}>
          {suffix}
        </span>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Datum */

/**
 * Datumsfeld mit Klartext daneben.
 *
 * Das native Feld richtet sich nach der Sprache des Browsers, nicht nach der
 * der App - auf einem englisch eingestellten Geraet steht dort mm/dd/yyyy und
 * man liest den 9. April statt den 4. September. Ein eigener Kalender waere
 * schlechter als der des Systems, deshalb bleibt das Feld und bekommt die
 * gelesene Fassung daneben gestellt.
 */
export function DateInput({
  value, onChange, max, min, ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  max?: string;
  min?: string;
  ariaLabel?: string;
}) {
  return (
    <div className="datefield">
      <input
        className="input"
        type="date"
        value={value}
        max={max}
        min={min}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && <span className="datefield__read">{formatDateLong(value)}</span>}
    </div>
  );
}

/**
 * Uhrzeitfeld mit Klartext daneben - aus demselben Grund wie beim Datum.
 *
 * Auf einem englisch eingestellten Geraet steht im nativen Feld "05:00 PM";
 * wer 17 Uhr eingestellt hat, liest dort erst einmal etwas anderes.
 */
export function TimeInput({
  value, onChange, ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  return (
    <div className="datefield">
      <input
        className="input"
        type="time"
        value={value}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && <span className="datefield__read">{t('{time} Uhr', { time: value })}</span>}
    </div>
  );
}

/* ----------------------------------------------------------------- Stat */

export function Stat({
  label, value, unit, sub, tone,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  tone?: 'accent' | 'success' | 'warn' | 'danger';
}) {
  const color = tone
    ? { accent: 'var(--accent)', success: 'var(--success)', warn: 'var(--warn)', danger: 'var(--danger)' }[tone]
    : undefined;
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value mono" style={color ? { color } : undefined}>
        {value}
        {unit && <span className="stat__unit">{unit}</span>}
      </div>
      {sub && <div className="stat__sub">{sub}</div>}
    </div>
  );
}

/* ------------------------------------------------------------- Aufklappen */

export function Collapsible({
  open, children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return <>{children}</>;
}

/* ------------------------------------------------------------- Abschnitt */

/**
 * Ueberschrift mit Linie statt Kasten.
 *
 * Neun gleich schwere Karten untereinander sind eine Liste ohne Rhythmus: Man
 * sieht nicht, was zusammengehoert und was neu anfaengt. Eine Ueberschrift mit
 * einer Linie darunter kostet nichts und gliedert.
 */
export function Section({
  title, note, children,
}: {
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="section">
      <div className="section__head">
        <h2 className="section__title">{title}</h2>
        {note && <span className="section__note">{note}</span>}
      </div>
      {children}
    </section>
  );
}

/** Ein Block innerhalb eines Abschnitts - mit Zeile darueber, ohne Rahmen. */
export function Block({
  title, note, children,
}: {
  title: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <div className="row row--between" style={{ marginBottom: 8 }}>
        <span className="block__title">{title}</span>
        {note && <span className="tiny dim">{note}</span>}
      </div>
      {children}
    </div>
  );
}

/* --------------------------------------------------------------- Leerer Zustand */

/**
 * Leerer Zustand.
 *
 * Bewusst ohne Symbol: Ein grosses Emoji ueber jeder leeren Liste sieht auf
 * Dauer beliebig aus und sagt nichts. Ein klarer Satz sagt mehr - und wo es
 * einen naechsten Schritt gibt, steht er als Knopf dabei. "Hier ist nichts"
 * ist eine Auskunft; "hier ist nichts, und so kommt etwas hin" ist eine Hilfe.
 */
export function EmptyState({
  title, hint, actionLabel, onAction,
}: {
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="empty">
      <div className="empty__title">{title}</div>
      {hint && <div className="empty__hint">{hint}</div>}
      {actionLabel && onAction && (
        <button className="btn btn--sm" style={{ marginTop: 12 }} onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

/**
 * Platzhalter, waehrend eine Seite nachgeladen wird - in der Form dessen,
 * was gleich kommt.
 */
export function PageSkeleton() {
  return (
    <div className="skeleton" aria-hidden="true">
      <div className="skeleton__bar" style={{ width: '45%' }} />
      <div className="skeleton__block" />
      <div className="skeleton__block" />
      <div className="skeleton__block" style={{ height: 140 }} />
    </div>
  );
}

/** Formatiert Zahlen kompakt (1.234 statt 1234). */
export const fmt = (value: number, digits = 0): string =>
  value.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtKg = (value: number): string =>
  `${value.toLocaleString('de-DE', { maximumFractionDigits: value % 1 === 0 ? 0 : 1 })} kg`;
