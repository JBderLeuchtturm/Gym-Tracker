/**
 * Fortschrittsfotos.
 *
 * Bewusst NICHT Teil des synchronisierten Zustands: Die Bilder bleiben auf dem
 * Geraet, auf dem sie aufgenommen wurden. Sie wandern nicht auf den Server,
 * werden nie mit Freunden geteilt und tauchen in keinem Backup-JSON auf.
 * Wer sie mitnehmen will, exportiert sie einzeln.
 *
 * Gespeichert wird in IndexedDB, weil localStorage fuer Bilder viel zu klein
 * ist. Vor dem Ablegen wird jedes Bild verkleinert - ein Handyfoto mit 4 MB
 * bringt fuer den Vergleich nichts gegenueber 1200 Pixeln Kantenlaenge.
 */

export type PhotoPose = 'front' | 'side' | 'back';

export interface ProgressPhoto {
  id: string;
  date: string; // yyyy-mm-dd
  pose: PhotoPose;
  note?: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: string;
}

export const POSE_LABELS: Record<PhotoPose, string> = {
  front: 'Vorne',
  side: 'Seite',
  back: 'Hinten',
};

const DB_NAME = 'gym-tracker-photos';
const STORE = 'photos';
const MAX_EDGE = 1200;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Ist der Bilderspeicher in diesem Browser ueberhaupt nutzbar? */
export function photosAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

export async function listPhotos(): Promise<ProgressPhoto[]> {
  if (!photosAvailable()) return [];
  try {
    const db = await openDb();
    const photos = await new Promise<ProgressPhoto[]>((resolve, reject) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      request.onsuccess = () => resolve(request.result as ProgressPhoto[]);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return photos.sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

export async function savePhoto(photo: ProgressPhoto): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(photo);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
  db.close();
}

/**
 * Verkleinert ein aufgenommenes Bild auf eine vernuenftige Kantenlaenge und
 * gibt es als JPEG zurueck. Schlaegt das Zeichnen fehl, wird die Datei
 * unveraendert uebernommen - lieber ein grosses Bild als gar keins.
 */
export async function shrinkImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Bild konnte nicht gelesen werden'));
      element.src = url;
    });

    const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
    const width = Math.round(image.width * scale);
    const height = Math.round(image.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return { blob: file, width: image.width, height: image.height };
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, 'image/jpeg', 0.82);
    });
    return { blob: blob ?? file, width, height };
  } catch {
    return { blob: file, width: 0, height: 0 };
  } finally {
    URL.revokeObjectURL(url);
  }
}
