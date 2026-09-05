/**
 * Ein sehr kleiner ZIP-Schreiber.
 *
 * Nur so viel, wie zum Herausgeben von Fotos noetig ist: Dateien werden ohne
 * Kompression abgelegt (Methode "gespeichert"). Bei JPEG bringt Kompression
 * ohnehin fast nichts, und dafuer eine Bibliothek von einigen zehn Kilobyte
 * mitzuliefern, waere in einer App, die offline starten soll, schlecht
 * getauscht.
 *
 * Erzeugt wird das klassische Format ohne ZIP64 - bei ein paar hundert Fotos
 * reicht das mit Abstand.
 */

/** Pruefsumme nach CRC-32, wie das ZIP-Format sie verlangt. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Datum und Uhrzeit im Format von MS-DOS, das ZIP bis heute benutzt. */
function dosDateTime(date: Date): { time: number; date: number } {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2)),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
  modified?: Date;
}

export function createZip(entries: ZipEntry[]): Blob {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const { time, date } = dosDateTime(entry.modified ?? new Date());

    const local = new Uint8Array(30 + nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);   // Kennung
    localView.setUint16(4, 20, true);           // benoetigte Fassung
    localView.setUint16(6, 0x0800, true);       // Namen sind UTF-8
    localView.setUint16(8, 0, true);            // gespeichert, nicht komprimiert
    localView.setUint16(10, time, true);
    localView.setUint16(12, date, true);
    localView.setUint32(14, crc, true);
    localView.setUint32(18, entry.data.length, true);
    localView.setUint32(22, entry.data.length, true);
    localView.setUint16(26, nameBytes.length, true);
    localView.setUint16(28, 0, true);           // kein Zusatzfeld
    local.set(nameBytes, 30);

    chunks.push(local, entry.data);

    const record = new Uint8Array(46 + nameBytes.length);
    const recordView = new DataView(record.buffer);
    recordView.setUint32(0, 0x02014b50, true);
    recordView.setUint16(4, 20, true);
    recordView.setUint16(6, 20, true);
    recordView.setUint16(8, 0x0800, true);
    recordView.setUint16(10, 0, true);
    recordView.setUint16(12, time, true);
    recordView.setUint16(14, date, true);
    recordView.setUint32(16, crc, true);
    recordView.setUint32(20, entry.data.length, true);
    recordView.setUint32(24, entry.data.length, true);
    recordView.setUint16(28, nameBytes.length, true);
    recordView.setUint32(42, offset, true);
    record.set(nameBytes, 46);
    central.push(record);

    offset += local.length + entry.data.length;
  }

  const centralSize = central.reduce((sum, item) => sum + item.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  return new Blob([...chunks, ...central, end] as BlobPart[], { type: 'application/zip' });
}

/** Laedt einen Blob als Datei herunter. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
