/**
 * Archivos de sustento del taller: el backend real los guarda en su servidor; aquí se guardan en IndexedDB del
 * navegador (localStorage no alcanza para un PDF). Cada archivo tiene un id que el documento guarda junto al nombre.
 *
 * Si el navegador no permite IndexedDB, guardar devuelve null y el documento queda solo con el nombre del archivo
 * (el visor muestra entonces el PDF de ejemplo).
 */

const BASE = 'taller-siaf-rp-archivos';
const ALMACEN = 'archivos';

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BASE, 1);
    pedido.onupgradeneeded = () => pedido.result.createObjectStore(ALMACEN);
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error);
  });
}

async function operar<T>(modo: IDBTransactionMode, accion: (almacen: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const base = await abrir();
  try {
    return await new Promise<T>((resolve, reject) => {
      const pedido = accion(base.transaction(ALMACEN, modo).objectStore(ALMACEN));
      pedido.onsuccess = () => resolve(pedido.result);
      pedido.onerror = () => reject(pedido.error);
    });
  } finally {
    base.close();
  }
}

/** Guarda el archivo y devuelve su id; null si el navegador no lo permite. */
export async function guardarArchivo(archivo: Blob): Promise<string | null> {
  const id = `arch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    await operar('readwrite', (a) => a.put(archivo, id));
    return id;
  } catch {
    return null;
  }
}

/** El archivo guardado con ese id, o null si no existe (o se reiniciaron los datos). */
export async function leerArchivo(id: string | null | undefined): Promise<Blob | null> {
  if (!id) return null;
  try {
    return ((await operar('readonly', (a) => a.get(id))) as Blob | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Borra todos los archivos (al reiniciar los datos de la demo). */
export async function borrarArchivos(): Promise<void> {
  try {
    await operar('readwrite', (a) => a.clear());
  } catch {
    /* sin IndexedDB: no hay nada que borrar */
  }
}
