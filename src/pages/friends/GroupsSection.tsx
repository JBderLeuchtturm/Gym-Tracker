import { t } from '../../i18n';
import { useState } from 'react';
import { useSync } from '../../sync/SyncProvider';
import { EmptyState, Modal, useToast } from '../../components/ui';
import { IconCopy, IconPlus, IconTrash } from '../../components/icons';

const GROUP_EMOJIS = ['👥', '🏋️', '🔥', '🐺', '🦍', '⚡', '🏆', '🎯'];

/**
 * Gruppen buendeln mehrere Leute zu einer Bestenliste.
 * Wer beitritt, gibt den anderen automatisch seinen Fortschritt frei - mehr
 * nicht. Gewicht und Kalorien bleiben aussen vor.
 */
export function GroupsSection() {
  const sync = useSync();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('👥');
  const [failure, setFailure] = useState<string | null>(null);

  const join = async () => {
    setFailure(null);
    try {
      const groupName = await sync.joinGroup(joinCode);
      setJoinCode('');
      toast.show(t('„{name}“ beigetreten', { name: groupName }));
    } catch (caught) {
      setFailure(caught instanceof Error ? caught.message : 'Beitritt fehlgeschlagen');
    }
  };

  return (
    <>
      <div className="card">
        <div className="card__title" style={{ marginBottom: 9 }}>{t("Gruppe beitreten")}</div>
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input"
            placeholder={t("Beitrittscode, z. B. k7mq2xr")}
            value={joinCode}
            onChange={(event) => setJoinCode(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') void join(); }}
          />
          <button className="btn btn--primary" disabled={!joinCode.trim()} onClick={join}>
            Beitreten
          </button>
        </div>
        {failure && <div className="tiny" style={{ color: 'var(--danger)', marginTop: 6 }}>{failure}</div>}
        <div className="tiny dim" style={{ marginTop: 7 }}>
          In einer Gruppe sehen alle Mitglieder gegenseitig ihren Fortschritt.
          Körpergewicht und Kalorien bleiben privat.
        </div>
      </div>

      {sync.groups.length === 0 ? (
        <EmptyState icon="👥" title={t("Noch in keiner Gruppe")} hint={t("Leg eine an oder tritt mit einem Code bei.")} />
      ) : (
        <div className="list">
          {sync.groups.map((group) => (
            <div key={group.id} className="card">
              <div className="row" style={{ gap: 11 }}>
                <span style={{ fontSize: '1.6rem' }}>{group.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bold">{group.name}</div>
                  <div className="tiny dim">
                    {group.memberCount} {group.memberCount === 1 ? t('Mitglied') : t('Mitglieder')}
                    {group.ownerId === sync.user?.id && ' · von dir'}
                  </div>
                </div>
              </div>

              <div className="row row--wrap tiny" style={{ gap: 5, marginTop: 10 }}>
                {group.members.map((member) => (
                  <span key={member.userId} className="chip">
                    {member.emoji} {member.userId === sync.user?.id ? 'Du' : member.displayName}
                  </span>
                ))}
              </div>

              <div className="row row--wrap" style={{ gap: 7, marginTop: 11 }}>
                <button
                  className="btn btn--sm"
                  onClick={() => {
                    void navigator.clipboard?.writeText(group.joinCode);
                    toast.show(t("Beitrittscode kopiert"));
                  }}
                >
                  <IconCopy /> Code: {group.joinCode}
                </button>
                <span className="spacer" />
                <button
                  className="btn btn--sm btn--ghost"
                  onClick={() => { void sync.leaveGroup(group.id); toast.show(t("Gruppe verlassen")); }}
                >
                  <IconTrash /> {t('Verlassen')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn--block" onClick={() => setCreateOpen(true)}>
        <IconPlus /> {t('Neue Gruppe')}
      </button>

      {createOpen && (
        <Modal title={t("Neue Gruppe")} onClose={() => setCreateOpen(false)}>
          <div className="list">
            <div className="field">
              <label className="field__label">{t("Name")}</label>
              <input
                className="input" value={name} autoFocus placeholder={t("z. B. Montagscrew")}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div className="field">
              <label className="field__label">{t("Symbol")}</label>
              <div className="row row--wrap" style={{ gap: 6 }}>
                {GROUP_EMOJIS.map((item) => (
                  <button
                    key={item}
                    className={`chip chip--button ${emoji === item ? 'chip--accent' : ''}`}
                    style={{ fontSize: '1.1rem', padding: '5px 10px' }}
                    onClick={() => setEmoji(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setCreateOpen(false)}>{t("Abbrechen")}</button>
              <button
                className="btn btn--primary"
                disabled={name.trim().length < 2}
                onClick={async () => {
                  await sync.createGroup(name, emoji);
                  setName(''); setCreateOpen(false);
                  toast.show(t("Gruppe angelegt"));
                }}
              >
                Anlegen
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
