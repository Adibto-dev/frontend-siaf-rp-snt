/**
 * Búsqueda por palabras sin distinguir tildes ni mayúsculas, y resaltado de lo encontrado.
 * La usan el menú de procesos (filtrar) y `siaf-tree-view` (marcar en negrita).
 */

const sinTilde = (texto: string): string => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** La búsqueda arranca desde esta cantidad de letras (texto total, sin espacios a los lados). */
export const MIN_LETRAS_BUSQUEDA = 3;

/** Conectores que no filtran ni se resaltan: aparecen en casi todas las etiquetas. */
const CONECTORES = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'al', 'a', 'en', 'y', 'o', 'e', 'u', 'por', 'para', 'con']);

/**
 * Palabras de la búsqueda, normalizadas y sin repetir. Reglas:
 * - Con menos de `MIN_LETRAS_BUSQUEDA` letras en total no hay búsqueda (lista vacía).
 * - Los conectores (`de`, `la`, `en`…) y las palabras de 1 o 2 letras no cuentan: «saldos de li» → ['saldos'].
 * Si no queda ninguna palabra, la lista sale vacía y quien filtra no filtra.
 */
export function palabrasDeBusqueda(busqueda: string): string[] {
  const texto = sinTilde(busqueda).trim();
  if (texto.length < MIN_LETRAS_BUSQUEDA) return [];
  const palabras = texto.split(/\s+/).filter((p) => p.length >= MIN_LETRAS_BUSQUEDA && !CONECTORES.has(p));
  return [...new Set(palabras)];
}

/** El texto contiene todas las palabras, en cualquier orden. */
export function contieneTodas(texto: string, palabras: string[]): boolean {
  const normal = sinTilde(texto);
  return palabras.every((p) => normal.includes(p));
}

/**
 * Parte `texto` en tramos marcados (los que coinciden con alguna palabra) y sin marcar, conservando el texto
 * original (tildes y mayúsculas). Los tramos que se superponen se unen.
 */
export function tramosResaltados(texto: string, palabras: string[]): { texto: string; marca: boolean }[] {
  if (!palabras.length || !texto) return [{ texto, marca: false }];
  // Cada carácter del original produce exactamente un carácter normalizado: los índices coinciden.
  const normal = texto.split('').map((c) => sinTilde(c).charAt(0) || c).join('');
  const marcado = new Array<boolean>(texto.length).fill(false);
  for (const palabra of palabras) {
    for (let i = normal.indexOf(palabra); i >= 0; i = normal.indexOf(palabra, i + 1)) {
      marcado.fill(true, i, i + palabra.length);
    }
  }
  const tramos: { texto: string; marca: boolean }[] = [];
  for (let i = 0; i < texto.length; i++) {
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && ultimo.marca === marcado[i]) ultimo.texto += texto[i];
    else tramos.push({ texto: texto[i], marca: marcado[i] });
  }
  return tramos;
}
