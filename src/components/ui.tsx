import { t } from '../i18n';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { IconX } from './icons';

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

  return (
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
    </div>
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

interface ToastValue { show: (message: string) => void; }
const ToastContext = createContext<ToastValue>({ show: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  const show = useCallback((text: string) => {
    setMessage(text);
    window.setTimeout(() => setMessage((current) => (current === text ? null : current)), 2400);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {message && <div className="toast" role="status">{message}</div>}
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

/* --------------------------------------------------------------- Leerer Zustand */

/**
 * Leerer Zustand.
 *
 * Bewusst ohne Symbol: Ein grosses Emoji ueber jeder leeren Liste sieht auf
 * Dauer beliebig aus und sagt nichts. Ein klarer Satz sagt mehr.
 */
export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty">
      <div className="empty__title">{title}</div>
      {hint && <div className="empty__hint">{hint}</div>}
    </div>
  );
}

/** Formatiert Zahlen kompakt (1.234 statt 1234). */
export const fmt = (value: number, digits = 0): string =>
  value.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtKg = (value: number): string =>
  `${value.toLocaleString('de-DE', { maximumFractionDigits: value % 1 === 0 ? 0 : 1 })} kg`;
