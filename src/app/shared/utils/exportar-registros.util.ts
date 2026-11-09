import type { DocumentsRecordsColumn, DocumentsRecordsRow } from '../types/documents-records.types';

/**
 * Descarga en Excel los registros de la pestaña Registros de `siaf-documents-records-page`: una columna por cada
 * columna visible, con su término completo (el `tooltip` del glosario, si la cabecera muestra una abreviatura).
 * exceljs se carga al exportar, así no pesa en la pantalla hasta que se usa.
 */
export async function exportarRegistrosExcel(nombreProceso: string, columnas: DocumentsRecordsColumn[], filas: DocumentsRecordsRow[]): Promise<void> {
  const { Workbook } = await import('exceljs');
  const libro = new Workbook();
  const hoja = libro.addWorksheet('Registros');
  hoja.columns = columnas.map((c) => ({ header: c.tooltip || c.label, key: c.key, width: Math.max(14, (c.tooltip || c.label).length + 4) }));
  hoja.getRow(1).font = { bold: true };
  filas.forEach((fila) => hoja.addRow(Object.fromEntries(columnas.map((c) => [c.key, fila[c.key] ?? '']))));

  const buffer = await libro.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = `${nombreArchivo(nombreProceso)}-registros-${new Date().toISOString().slice(0, 10)}.xlsx`;
  enlace.click();
  URL.revokeObjectURL(url);
}

/** «Documentos de autorización» → «documentos-de-autorizacion». */
function nombreArchivo(texto: string): string {
  const base = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return base || 'proceso';
}
