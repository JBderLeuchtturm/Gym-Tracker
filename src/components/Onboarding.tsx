import { t } from '../i18n';
import { useState } from 'react';
import { useStore } from '../storage/store';
import { Modal } from './ui';

/**
 * Der erste Eindruck.
 *
 * Bisher landete man beim allerersten Start einfach auf einer Seite mit dem
 * Beispielplan - niemand sagte, was die App eigentlich ist oder tut. Das
 * hier ist bewusst ein einzelner, kurzer Bildschirm statt eines
 * mehrstufigen Assistenten mit Fortschrittspunkten: eine Zeile, ein
 * optionales Namensfeld, ein Knopf. Erscheint genau einmal - egal ob
 * durchgelaufen oder weggetippt, danach ist "onboarded" gesetzt und bleibt
 * es.
 */
export function Onboarding() {
  const { state, updateProfile, updateSettings } = useStore();
  const [name, setName] = useState(state.profile.name);

  if (state.settings.onboarded) return null;

  const finish = () => {
    const trimmed = name.trim();
    if (trimmed && trimmed !== state.profile.name) updateProfile({ name: trimmed });
    updateSettings({ onboarded: true });
  };

  return (
    <Modal title={t('Willkommen')} onClose={finish}>
      <p className="small dim" style={{ marginTop: 0 }}>
        {t('Ein Trainingsbuch, das dir gehört: Pläne, Sätze, Ränge, Fotos – alles bleibt auf diesem Gerät, bis du selbst ein Konto verbindest.')}
      </p>
      <div className="field">
        <label className="field__label">{t('Wie sollen wir dich nennen?')}</label>
        <input
          className="input"
          value={name}
          autoFocus
          placeholder={t('Optional')}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') finish(); }}
        />
      </div>
      <button className="btn btn--primary btn--block" onClick={finish}>{t('Los geht’s')}</button>
    </Modal>
  );
}
