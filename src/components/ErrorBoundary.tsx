import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../i18n';

/**
 * Faengt einen Fehler in einer Seite ab, statt die ganze App abstuerzen zu
 * lassen. Im Studio waere ein weisser Bildschirm die schlechteste Rueckmeldung -
 * hier steht wenigstens, was los ist, und ein Knopf laedt neu. Die
 * Trainingsdaten liegen im Speicher und sind davon unberuehrt.
 */
interface Props {
  children: ReactNode;
  /** Wechselt dieser Wert, wird ein abgefangener Fehler zurueckgesetzt (z. B. Reiterwechsel). */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Kein Fehlerdienst: nur die Konsole, damit man beim Debuggen etwas sieht.
    console.error('Seite abgestürzt:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="empty" style={{ borderTop: 0, paddingTop: 40 }}>
        <div className="empty__title">{t('Diese Seite ist abgestürzt')}</div>
        <div className="empty__hint">
          {t('Deine Trainingsdaten sind sicher – sie liegen im Speicher des Geräts. Lade die App neu, dann geht es weiter.')}
        </div>
        <div className="row" style={{ gap: 8, marginTop: 14 }}>
          <button className="btn btn--sm btn--primary" onClick={() => window.location.reload()}>
            {t('Neu laden')}
          </button>
          <button className="btn btn--sm" onClick={() => this.setState({ error: null })}>
            {t('Noch einmal versuchen')}
          </button>
        </div>
        <div className="tiny dim mono" style={{ marginTop: 12, wordBreak: 'break-word' }}>
          {this.state.error.message}
        </div>
      </div>
    );
  }
}
