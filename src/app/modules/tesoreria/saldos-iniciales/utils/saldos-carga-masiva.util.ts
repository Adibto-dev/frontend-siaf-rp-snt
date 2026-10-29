import { SaldoInicial, calcularSaldo, cuentaPorNumero, cuentasRegistroDe } from '../models/saldo-inicial.model';

/** Columnas de la plantilla (fila 2): A fecha · B-D cuenta bancaria · E-G cuenta de registro · H importe. */
const COLUMNAS = { fecha: 1, cuenta: 2, idCorrelativo: 5, importe: 8 } as const;
/** Los datos empiezan después de las dos filas de cabecera. */
const PRIMERA_FILA = 3;
/** Se muestran solo los primeros errores: con eso basta para corregir el archivo. */
const MAX_ERRORES = 10;

/** Constructor de libros de exceljs (según el empaquetado llega directo o dentro de `default`). */
export async function libroExcel(): Promise<typeof import('exceljs').Workbook> {
  const mod = (await import('exceljs')) as typeof import('exceljs') & { default?: typeof import('exceljs') };
  return mod.Workbook ?? mod.default!.Workbook;
}

function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/**
 * Plantilla de carga masiva de saldos iniciales: una fila por cuenta de registro (libreta). Vacía, solo trae la
 * cabecera; precargada, trae las libretas de las cuentas elegidas para completar la fecha y los importes.
 */
export async function descargarPlantillaSaldos(cuentas: string[]): Promise<void> {
  const Workbook = await libroExcel();
  const libro = new Workbook();
  const hoja = libro.addWorksheet('Plantilla');
  hoja.addRow(['Fecha de operación', 'Cuenta bancaria', '', '', 'Cuenta de registro', '', '', 'Libretas']);
  hoja.addRow(['', 'Número', 'Moneda', 'Denominación', 'ID. corr.', 'Número', 'Descripción', 'Imp. M. cuenta']);
  hoja.mergeCells('A1:A2');
  hoja.mergeCells('B1:D1');
  hoja.mergeCells('E1:G1');
  hoja.mergeCells('H1:H2');
  [18, 24, 10, 34, 12, 30, 34, 18].forEach((ancho, i) => (hoja.getColumn(i + 1).width = ancho));
  for (const n of [1, 2]) {
    const fila = hoja.getRow(n);
    fila.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    fila.alignment = { horizontal: 'center', vertical: 'middle' };
    fila.eachCell((celda) => (celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3A86C8' } }));
  }

  for (const numero of cuentas) {
    const cuenta = cuentaPorNumero(numero);
    if (!cuenta) continue;
    for (const libreta of cuentasRegistroDe(numero)) {
      hoja.addRow(['dd/mm/aaaa', cuenta.numero, cuenta.moneda, cuenta.denominacion, libreta.idCorrelativo, libreta.numero, libreta.descripcion, 0]);
    }
  }
  hoja.getColumn(COLUMNAS.importe).numFmt = '#,##0.00';

  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  descargar(blob, cuentas.length ? 'Plantilla_saldos_iniciales_precargada.xlsx' : 'Plantilla_saldos_iniciales.xlsx');
}

export interface ResultadoCargaSaldos {
  saldos: SaldoInicial[];
  errores: string[];
}

/** Valor de una celda como texto (exceljs devuelve texto enriquecido o fórmulas como objetos). */
function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString();
  if (typeof valor === 'object') {
    const v = valor as { richText?: { text: string }[]; result?: unknown; text?: string };
    if (v.richText) return v.richText.map((t) => t.text).join('').trim();
    if ('result' in v) return texto(v.result);
    if (v.text) return String(v.text).trim();
  }
  return String(valor).trim();
}

/** Fecha de una celda: fecha de Excel o texto dd/mm/aaaa. Devuelve AAAA-MM-DD o null. */
function fecha(valor: unknown): string | null {
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor.toISOString().slice(0, 10);
  const m = texto(valor).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!m) return null;
  const [, d, mes, a] = m;
  const anio = a.length === 2 ? `20${a}` : a;
  const iso = `${anio}-${mes.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const prueba = new Date(`${iso}T00:00:00Z`);
  return isNaN(prueba.getTime()) || prueba.toISOString().slice(0, 10) !== iso ? null : iso;
}

/** Importe de una celda; vacío cuenta como 0. Devuelve null si no es un número. */
function importe(valor: unknown): number | null {
  if (typeof valor === 'number') return valor;
  const t = texto(valor).replace(/,/g, '');
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lee la plantilla subida. Todas las filas deben estar correctas: con algún error no se carga nada y se devuelven los
 * errores (con su fila). Cada cuenta bancaria es un saldo; sus libretas se suman como en el formulario.
 */
export async function leerPlantillaSaldos(
  archivo: File,
  entidadCodigo: string,
  cuentasUsadas: string[],
  nuevoId: () => string,
): Promise<ResultadoCargaSaldos> {
  const Workbook = await libroExcel();
  const libro = new Workbook();
  try {
    await libro.xlsx.load(await archivo.arrayBuffer());
  } catch {
    return { saldos: [], errores: ['El archivo no es un Excel (.xlsx) válido.'] };
  }
  const hoja = libro.worksheets[0];
  if (!hoja) return { saldos: [], errores: ['El archivo no tiene hojas.'] };

  const errores: string[] = [];
  const grupos = new Map<string, { fecha: string; importes: Record<string, number> }>();
  hoja.eachRow((fila, n) => {
    if (n < PRIMERA_FILA) return;
    const valor = (col: number) => fila.getCell(col).value;
    const numero = texto(valor(COLUMNAS.cuenta)).replace(/\s/g, '');
    const id = texto(valor(COLUMNAS.idCorrelativo)).replace(/\s/g, '');
    const fechaTexto = texto(valor(COLUMNAS.fecha));
    const monto = importe(valor(COLUMNAS.importe));
    if (!numero && !id && !monto && (!fechaTexto || fechaTexto === 'dd/mm/aaaa')) return; // fila vacía

    const cuenta = cuentaPorNumero(numero);
    if (!cuenta) { errores.push(`Fila ${n}: la cuenta bancaria ${numero || '(vacía)'} no existe.`); return; }
    if (cuenta.entidadCodigo !== entidadCodigo) { errores.push(`Fila ${n}: la cuenta ${numero} no pertenece a la entidad financiera.`); return; }
    if (cuentasUsadas.includes(numero)) { errores.push(`Fila ${n}: la cuenta ${numero} ya está en el documento.`); return; }
    const iso = fecha(valor(COLUMNAS.fecha));
    if (!iso) { errores.push(`Fila ${n}: ingrese la fecha de operación (dd/mm/aaaa).`); return; }
    const libreta = cuentasRegistroDe(numero).find((l) => l.idCorrelativo === id.padStart(6, '0'));
    if (!libreta) { errores.push(`Fila ${n}: el ID. corr. ${id || '(vacío)'} no pertenece a la cuenta ${numero}.`); return; }
    if (monto === null || monto < 0) { errores.push(`Fila ${n}: el importe debe ser un número mayor o igual a cero.`); return; }

    const grupo = grupos.get(numero) ?? { fecha: iso, importes: {} };
    if (grupo.fecha !== iso) { errores.push(`Fila ${n}: la cuenta ${numero} tiene fechas de operación distintas.`); return; }
    if (libreta.idCorrelativo in grupo.importes) { errores.push(`Fila ${n}: la libreta ${libreta.idCorrelativo} está repetida.`); return; }
    grupo.importes[libreta.idCorrelativo] = monto;
    grupos.set(numero, grupo);
  });

  for (const [numero, g] of grupos) {
    if (!Object.values(g.importes).some((v) => v > 0)) errores.push(`La cuenta ${numero} no tiene importes mayores a cero.`);
  }
  if (!grupos.size && !errores.length) errores.push('El archivo no tiene datos para cargar.');
  if (errores.length) {
    const extra = errores.length - MAX_ERRORES;
    return { saldos: [], errores: extra > 0 ? [...errores.slice(0, MAX_ERRORES), `… y ${extra} errores más.`] : errores };
  }
  const saldos = [...grupos].map(([numero, g]) => calcularSaldo(nuevoId(), g.fecha, numero, g.importes));
  return { saldos, errores: [] };
}
