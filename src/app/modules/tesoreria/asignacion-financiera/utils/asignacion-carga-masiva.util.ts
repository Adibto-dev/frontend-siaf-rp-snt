import { ABREVIATURAS } from '../../../../shared/utils/abreviaturas.util';
import { redondear } from '../../saldos-iniciales/models/saldo-inicial.model';
import { libroExcel } from '../../saldos-iniciales/utils/saldos-carga-masiva.util';
import type { LibretaSaldo } from '../../traspasos-cuentas-registros/models/traslado.model';
import { clasificacionDe, codigo } from './clasificacion-cuentas.util';

/**
 * Carga masiva de la asignación financiera: un Excel con una fila por cuenta de destino (ID correlativo e importe a
 * asignar). La plantilla precargada trae las cuentas de registro elegidas, en el mismo orden que la tabla de destinos:
 * primero el Clasificador Institucional del titular y luego la cuenta de registro.
 */

/**
 * Cabecera en dos filas. Columnas: A Grupo · B Sub grupo · C Descripción (Clasificador institucional) · D ID
 * correlativo · E Número · F Descripción (Cuenta de registro) · G Importe a asignar.
 */
const COLUMNAS = { idCorrelativo: 4, importe: 7 } as const;
const PRIMERA_FILA = 3;
const MAX_ERRORES = 10;
export const MAX_FILAS_ASIGNACION = 500;

/** Hoja «Instrucciones» de la plantilla. */
const INSTRUCCIONES = [
  'Carga masiva de cuentas de destino · Solicitud de Asignación Financiera',
  '',
  '1. Complete la hoja «Plantilla» desde la fila 3: una fila por cuenta de registro de destino (crédito).',
  '2. ID correlativo: el de la cuenta de registro (6 dígitos, ej. 000033). Debe pertenecer a la cuenta bancaria elegida.',
  '3. No incluya la cuenta de origen ni repita un ID correlativo.',
  '4. Importe a asignar: número mayor o igual a 0 con hasta 2 decimales. Las filas con 0 o vacías se ignoran.',
  '5. Son informativos y el sistema no los lee: Clasificador institucional (Grupo, Sub grupo y Descripción de la entidad) y el Número y la Descripción de la cuenta. El sistema toma el ID correlativo y el importe.',
  `6. Máximo ${MAX_FILAS_ASIGNACION} filas. Guarde en formato XLSX y súbalo desde «Carga masiva».`,
  '7. Las cuentas cargadas reemplazan a los destinos que ya tenga el documento.',
  '8. La suma de importes no debe superar el saldo disponible de la cuenta de origen.',
];

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/** Plantilla vacía (solo cabecera) o precargada con las cuentas de destino posibles e importe 0. */
export async function descargarPlantillaAsignacion(destinos: LibretaSaldo[]): Promise<void> {
  const Workbook = await libroExcel();
  const libro = new Workbook();
  const hoja = libro.addWorksheet('Plantilla');
  const importeTitulo = ABREVIATURAS.importeAsignar.termino;
  hoja.addRow(['Clasificador institucional', '', '', 'Cuenta de registro', '', '', importeTitulo]);
  hoja.addRow(['Grupo', 'Sub grupo', 'Descripción', ABREVIATURAS.idCorrelativo.termino, 'Número', 'Descripción', '']);
  hoja.mergeCells('A1:C1');
  hoja.mergeCells('D1:F1');
  hoja.mergeCells('G1:G2');
  for (const n of [1, 2]) {
    const fila = hoja.getRow(n);
    fila.font = { bold: true };
    fila.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  [10, 12, 40, 16, 32, 40, 22].forEach((ancho, i) => (hoja.getColumn(i + 1).width = ancho));
  for (const l of destinos) {
    const c = clasificacionDe(l.idCorrelativo);
    hoja.addRow([codigo(c.grupo), codigo(c.subgrupo), c.entidad, l.idCorrelativo, l.numero, l.descripcion, 0]);
  }
  // El ID como texto: Excel no le quita los ceros a la izquierda.
  hoja.getColumn(COLUMNAS.idCorrelativo).numFmt = '@';
  hoja.getColumn(COLUMNAS.importe).numFmt = '#,##0.00';
  hoja.views = [{ state: 'frozen', ySplit: 2 }];

  // La carga lee solo la primera hoja: las instrucciones van en la segunda.
  const instrucciones = libro.addWorksheet('Instrucciones');
  instrucciones.getColumn(1).width = 110;
  INSTRUCCIONES.forEach((t) => instrucciones.addRow([t]));
  instrucciones.getRow(1).font = { bold: true, size: 12 };
  const buffer = await libro.xlsx.writeBuffer();
  descargar(new Blob([buffer], { type: TIPO_XLSX }), destinos.length ? 'Plantilla_asignacion_financiera_precargada.xlsx' : 'Plantilla_asignacion_financiera.xlsx');
}

export interface DestinoCargado {
  destino: string;
  importe: number;
}

export interface ResultadoCargaAsignacion {
  destinos: DestinoCargado[];
  errores: string[];
}

function texto(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'object') {
    const v = valor as { richText?: { text: string }[]; result?: unknown; text?: string };
    if (v.richText) return v.richText.map((t) => t.text).join('').trim();
    if ('result' in v) return texto(v.result);
    if (v.text) return String(v.text).trim();
  }
  return String(valor).trim();
}

function importe(valor: unknown): number | null {
  if (typeof valor === 'number') return valor;
  const t = texto(valor).replace(/,/g, '');
  if (!t) return 0;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Lee el Excel: cada fila con importe mayor a cero es un destino. Revisa que la cuenta exista en la cuenta bancaria,
 * que no sea la de origen, que no se repita y que el importe sea un número positivo. Con un error no carga nada.
 */
export async function leerPlantillaAsignacion(archivo: File, libretas: LibretaSaldo[], origen: string): Promise<ResultadoCargaAsignacion> {
  const errores: string[] = [];
  const destinos: DestinoCargado[] = [];
  try {
    const Workbook = await libroExcel();
    const libro = new Workbook();
    await libro.xlsx.load(await archivo.arrayBuffer());
    const hoja = libro.worksheets[0];
    if (!hoja) return { destinos, errores: ['El archivo no tiene hojas.'] };
    if (hoja.rowCount - (PRIMERA_FILA - 1) > MAX_FILAS_ASIGNACION) return { destinos, errores: [`El archivo supera las ${MAX_FILAS_ASIGNACION} filas.`] };
    const ids = new Set(libretas.map((l) => l.idCorrelativo));
    const vistos = new Set<string>();
    for (let n = PRIMERA_FILA; n <= hoja.rowCount; n++) {
      const fila = hoja.getRow(n);
      const id = texto(fila.getCell(COLUMNAS.idCorrelativo).value);
      const valor = importe(fila.getCell(COLUMNAS.importe).value);
      if (!id && !valor) continue;
      if (!ids.has(id)) errores.push(`Fila ${n}: la cuenta de registro «${id || '--'}» no pertenece a la cuenta bancaria.`);
      else if (id === origen) errores.push(`Fila ${n}: la cuenta ${id} es la de origen.`);
      else if (vistos.has(id)) errores.push(`Fila ${n}: la cuenta ${id} está repetida.`);
      else if (valor === null || valor < 0) errores.push(`Fila ${n}: el importe a asignar no es válido.`);
      else if (valor > 0) destinos.push({ destino: id, importe: redondear(valor) });
      vistos.add(id);
    }
    if (!errores.length && !destinos.length) errores.push('El archivo no tiene importes a asignar.');
  } catch {
    return { destinos: [], errores: ['No se pudo leer el archivo. Use la plantilla en formato XLSX.'] };
  }
  return errores.length ? { destinos: [], errores: errores.slice(0, MAX_ERRORES) } : { destinos, errores };
}
