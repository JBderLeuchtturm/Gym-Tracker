import { t } from '../../i18n';
import { useMemo, useState } from 'react';
import { useStore } from '../../storage/store';
import { useSync } from '../../sync/SyncProvider';
import type { Challenge, ChallengeMetric, Friend } from '../../sync/types';
import { buildProgressShare } from '../../sync/sharePayload';
import { addDays, formatDateShort, todayISO } from '../../lib/date';
import { EmptyState, Modal, fmt, useToast } from '../../components/ui';
import { IconPlus, IconTrash, IconTrophy } from '../../components/icons';

const METRIC_LABELS: Record<ChallengeMetric, string> = {
  workouts: 'Trainings',
  sets: 'Sätze',
  volume: 'Volumen',
};

const METRIC_UNITS: Record<ChallengeMetric, string> = {
  workouts: '', sets: '', volume: 'kg',
};

/**
 * Gemeinsame Ziele über einen Zeitraum.
 *
 * Gewertet wird aus den geteilten Auswertungen: Wer seinen Fortschritt nicht
 * freigegeben hat, taucht ohne Punktestand auf. Der eigene Stand kommt direkt
 * aus den lokalen Daten und ist damit immer aktuell.
 */
export function ChallengesSection({ friends }: { friends: Friend[] }) {
  const sync = useSync();
  const { state, getExercise } = useStore();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);

  const myProgress = useMemo(() => buildProgressShare(state, getExercise), [state, getExercise]);

  const boards = useMemo(() => sync.challenges.map((challenge) => {
    const rows: Array<{ name: string; emoji: string; score: number; joined: boolean }> = [];

    const scoreFrom = (sessions: Array<{ date: string; sets: number; volume: number }>) => {
      const inRange = sessions.filter(
        (item) => item.date >= challenge.startsOn && item.date <= challenge.endsOn);
      if (challenge.metric === 'workouts') return inRange.length;
      if (challenge.metric === 'sets') return inRange.reduce((sum, item) => sum + item.sets, 0);
      return inRange.reduce((sum, item) => sum + item.volume, 0);
    };

    if (challenge.memberIds.includes(sync.user?.id ?? '')) {
      rows.push({ name: 'Du', emoji: '⭐', score: scoreFrom(myProgress.recent), joined: true });
    }

    for (const friend of friends) {
      if (!challenge.memberIds.includes(friend.userId)) continue;
      const recent = sync.friendData[friend.userId]?.progress?.recent ?? [];
      rows.push({
        name: friend.displayName,
        emoji: friend.emoji,
        score: scoreFrom(recent),
        joined: true,
      });
    }

    rows.sort((a, b) => b.score - a.score);
    return { challenge, rows };
  }), [sync.challenges, sync.friendData, sync.user?.id, friends, myProgress]);

  const running = (challenge: Challenge) =>
    challenge.startsOn <= todayISO() && challenge.endsOn >= todayISO();

  return (
    <>
      {boards.length === 0 ? (
        <EmptyState
          icon="🏁"
          title={t("Noch keine Challenge")}
          hint={t("Setzt euch ein gemeinsames Ziel für ein paar Wochen.")}
        />
      ) : (
        <div className="list">
          {boards.map(({ challenge, rows }) => {
            const joined = challenge.memberIds.includes(sync.user?.id ?? '');
            const best = rows[0]?.score || 1;
            return (
              <div key={challenge.id} className="card">
                <div className="row row--between" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 7 }}>
                      <span className="bold">{challenge.title}</span>
                      {running(challenge)
                        ? <span className="chip chip--success">{t("läuft")}</span>
                        : challenge.endsOn < todayISO()
                          ? <span className="chip">{t("beendet")}</span>
                          : <span className="chip chip--accent">{t("geplant")}</span>}
                    </div>
                    <div className="tiny dim" style={{ marginTop: 2 }}>
                      {t(METRIC_LABELS[challenge.metric])} · {formatDateShort(challenge.startsOn)} bis {formatDateShort(challenge.endsOn)}
                    </div>
                  </div>
                </div>

                {rows.length > 0 && (
                  <div className="list" style={{ marginTop: 11, gap: 6 }}>
                    {rows.map((row, index) => (
                      <div key={`${row.name}-${index}`}>
                        <div className="row row--between tiny" style={{ marginBottom: 3 }}>
                          <span className="nowrap">
                            {['🥇', '🥈', '🥉'][index] ?? '　'} {row.emoji} {row.name}
                          </span>
                          <span className="mono dim">
                            {fmt(row.score)} {METRIC_UNITS[challenge.metric]}
                          </span>
                        </div>
                        <div className="progress-bar" style={{ height: 5 }}>
                          <div
                            className="progress-bar__fill"
                            style={{
                              width: `${best > 0 ? (row.score / best) * 100 : 0}%`,
                              background: row.name === 'Du' ? 'var(--accent)' : 'var(--violet)',
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="row row--wrap" style={{ gap: 7, marginTop: 11 }}>
                  {joined ? (
                    <button className="btn btn--sm btn--ghost" onClick={() => void sync.leaveChallenge(challenge.id)}>
                      Aussteigen
                    </button>
                  ) : (
                    <button className="btn btn--sm btn--primary" onClick={() => void sync.joinChallenge(challenge.id)}>
                      Mitmachen
                    </button>
                  )}
                  <span className="spacer" />
                  {challenge.ownerId === sync.user?.id && (
                    <button
                      className="btn btn--sm btn--ghost"
                      onClick={() => { void sync.deleteChallenge(challenge.id); toast.show(t("Challenge gelöscht")); }}
                      aria-label={t("Challenge löschen")}
                    >
                      <IconTrash />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button className="btn btn--block" onClick={() => setCreateOpen(true)}>
        <IconPlus /> {t('Neue Challenge')}
      </button>

      <div className="tiny dim center">
        <IconTrophy style={{ width: 13, height: 13, verticalAlign: '-2px' }} /> Gewertet wird aus den
        geteilten Auswertungen – wer seinen Fortschritt nicht freigibt, bleibt bei null.
      </div>

      {createOpen && <ChallengeDialog onClose={() => setCreateOpen(false)} />}
    </>
  );
}

function ChallengeDialog({ onClose }: { onClose: () => void }) {
  const sync = useSync();
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [metric, setMetric] = useState<ChallengeMetric>('workouts');
  const [startsOn, setStartsOn] = useState(todayISO());
  const [endsOn, setEndsOn] = useState(addDays(todayISO(), 27));
  const [groupId, setGroupId] = useState<string>('');
  const [failure, setFailure] = useState<string | null>(null);

  return (
    <Modal title={t("Neue Challenge")} onClose={onClose}>
      <div className="list">
        <div className="field">
          <label className="field__label">{t("Worum geht es?")}</label>
          <input
            className="input" value={title} autoFocus placeholder={t("z. B. 4 Wochen durchziehen")}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label">{t("Gewertet wird")}</label>
          <select
            className="select" value={metric}
            onChange={(event) => setMetric(event.target.value as ChallengeMetric)}
          >
            <option value="workouts">{t("Anzahl Trainings")}</option>
            <option value="sets">{t("Anzahl Sätze")}</option>
            <option value="volume">{t("Bewegtes Gewicht")}</option>
          </select>
        </div>

        <div className="grid-2">
          <div className="field">
            <label className="field__label">{t("Von")}</label>
            <input className="input" type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">{t("Bis")}</label>
            <input className="input" type="date" value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />
          </div>
        </div>

        {sync.groups.length > 0 && (
          <div className="field">
            <label className="field__label">{t("Für eine Gruppe (optional)")}</label>
            <select className="select" value={groupId} onChange={(event) => setGroupId(event.target.value)}>
              <option value="">{t("Nur für Eingeladene")}</option>
              {sync.groups.map((group) => (
                <option key={group.id} value={group.id}>{group.emoji} {group.name}</option>
              ))}
            </select>
          </div>
        )}

        {failure && <div className="small" style={{ color: 'var(--danger)' }}>{failure}</div>}

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>{t("Abbrechen")}</button>
          <button
            className="btn btn--primary"
            disabled={title.trim().length < 2 || endsOn < startsOn}
            onClick={async () => {
              setFailure(null);
              try {
                await sync.createChallenge({
                  title, metric, startsOn, endsOn, groupId: groupId || null,
                });
                toast.show(t("Challenge angelegt"));
                onClose();
              } catch (caught) {
                setFailure(caught instanceof Error ? caught.message : 'Anlegen fehlgeschlagen');
              }
            }}
          >
            Anlegen
          </button>
        </div>
      </div>
    </Modal>
  );
}
