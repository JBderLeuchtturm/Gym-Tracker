import { isNativeApp } from '../native/platform';

/**
 * Eine Datei an den Nutzer geben.
 *
 * Im Browser ein Download-Link wie gehabt. In der Android-App tut ein solcher
 * Link nichts - dort oeffnet sich stattdessen der Teilen-Dialog, ueber den die
 * Datei in "Eigene Dateien", Drive oder eine Nachricht wandert.
 */
export async function saveBlob(filename: string, blob: Blob): Promise<void> {
  if (isNativeApp()) {
    const native = await import('../native/native');
    await native.saveFileNative(filename, blob);
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
