import type { DocumentsRecordsColumn, DocumentsRecordsRow } from '../types/documents-records.types';
import { DatoConsulta, exportarConsultaExcel, nombreArchivo } from './excel-siaf.util';

/**
 * Descarga en Excel, con el formato SIAF (libros Resumen y Resultado, ver `excel-siaf.util.ts`), lo que muestra una
 * pestaña de `siaf-documents-records-page`: una columna por cada columna visible, con su término completo (el `tooltip`
 * del glosario, si la cabecera muestra una abreviatura).
 *
 * @param titulo Título del Resumen: el del proceso para Documentos, o «Registros de …» para Registros.
 * @param consulta Filtros aplicados en la bandeja, para «Datos de la consulta».
 * @param sufijo Parte del nombre del archivo que dice qué se exportó: `documentos` o `registros`.
 */
export async function exportarBandejaExcel(
  titulo: string,
  consulta: DatoConsulta[],
  columnas: DocumentsRecordsColumn[],
  filas: DocumentsRecordsRow[],
  sufijo: 'documentos' | 'registros',
): Promise<void> {
  await exportarConsultaExcel({
    titulo,
    consulta,
    columnas: columnas.map((c) => ({ titulo: c.tooltip || c.label, clave: c.key, grupo: c.headerGroup })),
    filas,
    archivo: `${nombreArchivo(titulo)}-${sufijo}-${new Date().toISOString().slice(0, 10)}`,
  });
}
