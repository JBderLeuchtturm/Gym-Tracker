import { shrinkImage } from './photos';

/**
 * Bilder an Aufgaben.
 *
 * Aus demselben Grund wie die Fortschrittsfotos nicht Teil des
 * synchronisierten Zustands: Ein Foto vom Regal im Baumarkt gehoert auf das
 * Geraet, mit dem es aufgenommen wurde, und nicht in ein JSON, das per
 * Zwischenablage weitergereicht wird.
 *
 * Eigene Datenbank statt eines zweiten Speichers neben den Fortschrittsfotos:
 * Ein zusaetzlicher Speicher braucht eine hoehere Versionsnummer, und ein
 * fehlgeschlagener Aufstieg wuerde die vorhandenen Fotos mitnehmen. Eine
 * eigene Datenbank kann das nicht.
 */

export interface TodoPhoto {
  id: string;
  todoId: string;
  blob: Blob;
  width: number;
  height: number;
  createdAt: string;
}

const DB_NAME = 'gym-tracker-todo-files';
const STORE = 'files';

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

export const todoFilesAvailable = (): boolean => typeof indexedDB !== 'undefined';

/** Die Bilder zu einer Aufgabe, aelteste zuerst. */
export async function loadTodoPhotos(ids: string[]): Promise<TodoPhoto[]> {
  if (!todoFilesAvailable() || ids.length === 0) return [];
  try {
    const db = await openDb();
    const store = db.transaction(STORE, 'readonly').objectStore(STORE);
    const photos = await Promise.all(ids.map((id) => new Promise<TodoPhoto | undefined>((resolve) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result as TodoPhoto | undefined);
      request.onerror = () => resolve(undefined);
    })));
    db.close();
    return photos.filter((photo): photo is TodoPhoto => Boolean(photo));
  } catch {
    return [];
  }
}

/** Legt ein Bild verkleinert ab und gibt seine ID zurueck. */
export async function addTodoPhoto(todoId: string, file: File): Promise<string | null> {
  if (!todoFilesAvailable()) return null;
  try {
    const { blob, width, height } = await shrinkImage(file);
    const photo: TodoPhoto = {
      id: `tf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
      todoId,
      blob,
      width,
      height,
      createdAt: new Date().toISOString(),
    };
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).put(photo);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    db.close();
    return photo.id;
  } catch {
    return null;
  }
}

export async function deleteTodoPhoto(id: string): Promise<void> {
  if (!todoFilesAvailable()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve) => {
      const request = db.transaction(STORE, 'readwrite').objectStore(STORE).delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
    });
    db.close();
  } catch {
    /* Ein Bild, das sich nicht loeschen laesst, ist kein Grund abzubrechen. */
  }
}
