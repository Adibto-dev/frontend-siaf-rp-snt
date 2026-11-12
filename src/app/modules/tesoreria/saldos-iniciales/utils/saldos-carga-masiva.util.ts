import { ABREVIATURAS } from '../../../../shared/utils/abreviaturas.util';

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

/** Importe de ejemplo de la plantilla precargada: distinto por cuenta y libreta, siempre mayor a cero. */
function importeDemo(cuenta: number, libreta: number): number {
  return Math.round((125_000 + cuenta * 48_250.5 + libreta * 17_340.25) * 100) / 100;
}

/**
 * Plantilla de carga masiva de saldos iniciales: una fila por cuenta de registro (libreta). Vacía, solo trae la
 * cabecera; precargada, trae las libretas de las cuentas elegidas con la fecha de hoy e importes de ejemplo, lista
 * para subirla en la demo.
 */
export async function descargarPlantillaSaldos(cuentas: string[]): Promise<void> {
  const Workbook = await libroExcel();
  const libro = new Workbook();
  const hoja = libro.addWorksheet('Plantilla');
  hoja.addRow(['Fecha de operación', 'Cuenta bancaria', '', '', 'Cuenta de registro', '', '', 'Libretas']);
  hoja.addRow(['', 'Número', 'Moneda', 'Denominación', ABREVIATURAS.idCorrelativo.termino, 'Número', 'Descripción', ABREVIATURAS.importeCuenta.termino]);
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

  // Precargada para la demo: fecha de hoy e importes de ejemplo, lista para subirla tal cual (se pueden editar).
  const hoy = new Date();
  const fechaHoy = [hoy.getDate(), hoy.getMonth() + 1].map((v) => String(v).padStart(2, '0')).join('/') + `/${hoy.getFullYear()}`;
  cuentas.forEach((numero, c) => {
    const cuenta = cuentaPorNumero(numero);
    if (!cuenta) return;
    cuentasRegistroDe(numero).forEach((libreta, l) => {
      hoja.addRow([fechaHoy, cuenta.numero, cuenta.moneda, cuenta.denominacion, libreta.idCorrelativo, libreta.numero, libreta.descripcion, importeDemo(c, l)]);
    });
  });
  hoja.getColumn(COLUMNAS.importe).numFmt = '#,##0.00';

  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  descargar(blob, cuentas.length ? 'Plantilla_saldos_iniciales_precargada.xlsx' : 'Plantilla_saldos_iniciales.xlsx');
}

/** Una observación de la carga: fila del Excel (null si es del archivo), campo y motivo (RN-1054). */
export interface ObservacionCarga {
  fila: number | null;
  campo: string;
  motivo: string;
}

export interface ResultadoCargaSaldos {
  saldos: SaldoInicial[];
  /** Textos para la pantalla («Fila 4: …»). */
  errores: string[];
  /** Todas las observaciones, para el Excel que se descarga. */
  observaciones: ObservacionCarga[];
}

/** Máximo de filas de datos (sin contar las dos de cabecera) que admite una carga: parámetro del taller. */
export const MAX_FILAS_CARGA = 500;

/** RN-1054: Excel con la fila, el campo y el motivo de cada observación, para corregir y volver a cargar. */
export async function descargarObservacionesCarga(observaciones: ObservacionCarga[]): Promise<void> {
  const Workbook = await libroExcel();
  const libro = new Workbook();
  const hoja = libro.addWorksheet('Observaciones');
  hoja.addRow(['Fila', 'Campo', 'Motivo']);
  hoja.getRow(1).font = { bold: true };
  [10, 26, 90].forEach((ancho, i) => (hoja.getColumn(i + 1).width = ancho));
  for (const o of observaciones) hoja.addRow([o.fila ?? '—', o.campo, o.motivo]);
  const buffer = await libro.xlsx.writeBuffer();
  descargar(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Observaciones_carga_saldos_iniciales.xlsx');
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
 * Lee la plantilla subida (RN-1054). Todas las filas deben estar correctas: con alguna observación no se carga nada y
 * se devuelven las observaciones (fila, campo y motivo) para la pantalla y para el Excel de observaciones. Cada cuenta
 * bancaria es un saldo; sus libretas se suman como en el formulario. `cuentasUsadas` son las cuentas que el archivo no
 * puede traer: las que ya están en el documento y las que tienen un saldo inicial aprobado.
 */
export async function leerPlantillaSaldos(
  archivo: File,
  entidadCodigo: string,
  cuentasUsadas: string[],
  nuevoId: () => string,
): Promise<ResultadoCargaSaldos> {
  const observaciones: ObservacionCarga[] = [];
  const observar = (fila: number | null, campo: string, motivo: string): void => { observaciones.push({ fila, campo, motivo }); };
  const resultado = (saldos: SaldoInicial[]): ResultadoCargaSaldos => {
    const errores = observaciones.map((o) => (o.fila ? `Fila ${o.fila}: ${o.motivo}` : o.motivo));
    const extra = errores.length - MAX_ERRORES;
    return { saldos, observaciones, errores: extra > 0 ? [...errores.slice(0, MAX_ERRORES), `… y ${extra} errores más.`] : errores };
  };

  const Workbook = await libroExcel();
  const libro = new Workbook();
  try {
    await libro.xlsx.load(await archivo.arrayBuffer());
  } catch {
    observar(null, 'Archivo', 'El archivo no es un Excel (.xlsx) válido.');
    return resultado([]);
  }
  const hoja = libro.worksheets[0];
  if (!hoja) { observar(null, 'Archivo', 'El archivo no tiene hojas.'); return resultado([]); }
  const filasDatos = Math.max(0, hoja.actualRowCount - (PRIMERA_FILA - 1));
  if (filasDatos > MAX_FILAS_CARGA) {
    observar(null, 'Archivo', `El archivo tiene ${filasDatos} filas de datos; el máximo es ${MAX_FILAS_CARGA}.`);
    return resultado([]);
  }

  const grupos = new Map<string, { fecha: string; importes: Record<string, number> }>();
  hoja.eachRow((fila, n) => {
    if (n < PRIMERA_FILA) return;
    const valor = (col: number) => fila.getCell(col).value;
    const numero = texto(valor(COLUMNAS.cuenta)).replace(/\s/g, '');
    const id = texto(valor(COLUMNAS.idCorrelativo)).replace(/\s/g, '');
    const fechaTexto = texto(valor(COLUMNAS.fecha));
    const vacio = (v: unknown) => v === null || v === undefined || texto(v) === '';
    if (!numero && !id && vacio(valor(COLUMNAS.importe)) && (!fechaTexto || fechaTexto === 'dd/mm/aaaa')) return; // fila vacía
    const monto = importe(valor(COLUMNAS.importe));

    const cuenta = cuentaPorNumero(numero);
    if (!cuenta) { observar(n, 'Cuenta bancaria', `la cuenta bancaria ${numero || '(vacía)'} no existe.`); return; }
    if (cuenta.entidadCodigo !== entidadCodigo) { observar(n, 'Cuenta bancaria', `la cuenta ${numero} no pertenece a la entidad financiera.`); return; }
    if (cuentasUsadas.includes(numero)) { observar(n, 'Cuenta bancaria', `la cuenta ${numero} ya está en el documento o tiene un saldo inicial aprobado.`); return; }
    const iso = fecha(valor(COLUMNAS.fecha));
    if (!iso) { observar(n, 'Fecha de operación', 'ingrese la fecha de operación (dd/mm/aaaa).'); return; }
    const libreta = cuentasRegistroDe(numero).find((l) => l.idCorrelativo === id.padStart(6, '0'));
    if (!libreta) { observar(n, ABREVIATURAS.idCorrelativo.termino, `el ${ABREVIATURAS.idCorrelativo.termino} ${id || '(vacío)'} no pertenece a la cuenta ${numero}.`); return; }
    // RN-1030: el saldo inicial admite importes mayores o iguales a cero.
    if (monto === null || monto < 0) { observar(n, ABREVIATURAS.importeCuenta.termino, 'el importe debe ser un número mayor o igual a cero.'); return; }

    const grupo = grupos.get(numero) ?? { fecha: iso, importes: {} };
    if (grupo.fecha !== iso) { observar(n, 'Fecha de operación', `la cuenta ${numero} tiene fechas de operación distintas.`); return; }
    if (libreta.idCorrelativo in grupo.importes) { observar(n, ABREVIATURAS.idCorrelativo.termino, `la libreta ${libreta.idCorrelativo} está repetida.`); return; }
    grupo.importes[libreta.idCorrelativo] = monto;
    grupos.set(numero, grupo);
  });

  if (!grupos.size && !observaciones.length) observar(null, 'Archivo', 'El archivo no tiene datos para cargar.');
  if (observaciones.length) return resultado([]);
  return resultado([...grupos].map(([numero, g]) => calcularSaldo(nuevoId(), g.fecha, numero, g.importes)));
}
