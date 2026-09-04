/**
 * Kurzer Signalton ohne Audiodatei - erzeugt im Browser selbst.
 *
 * Absichtlich sparsam: zwei kurze Toene, leise, und nur wenn der Browser die
 * Tonausgabe erlaubt. Schlaegt etwas fehl, passiert nichts weiter - ein
 * fehlender Ton darf das Training nicht stoeren.
 */
export function beep(times = 2): void {
  try {
    const Ctor = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const context = new Ctor();
    const start = context.currentTime;

    for (let index = 0; index < times; index += 1) {
      const at = start + index * 0.28;
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, at);
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.22, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.2);

      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.22);
    }

    // Den Kontext wieder freigeben, sonst bleibt er auf manchen Geraeten offen.
    window.setTimeout(() => { void context.close(); }, 300 + times * 300);
  } catch {
    /* Ton ist Beiwerk - Fehler werden bewusst geschluckt. */
  }
}
