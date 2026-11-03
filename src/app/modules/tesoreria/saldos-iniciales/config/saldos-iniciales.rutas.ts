import type { CreateDocumentProcessOption } from '../../../../shared/components/create-document/create-document.component';
import { NOMBRE_DOCUMENTO } from '../models/saldo-inicial.model';

/** Rutas e ids del proceso de saldos iniciales. */
export const PROCESS_ROUTE = '/procesos/saldos-iniciales';
export const REQUEST_SEGMENT = 'solicitud';
export const REQUEST_ROUTE = `${PROCESS_ROUTE}/${REQUEST_SEGMENT}`;
/** Detalle de un saldo aprobado (pestaña Registros): `${RECORD_ROUTE}/:registroId`. */
export const RECORD_ROUTE = `${PROCESS_ROUTE}/registro`;
/**
 * Detalle de un saldo abierto desde la tabla de su documento: `${DOCUMENT_SALDO_ROUTE}/:documentoId/saldo/:saldoId`.
 * Si el documento ya está aprobado muestra el registro; si no, el saldo tal como está en el documento.
 */
export const DOCUMENT_SALDO_ROUTE = `${PROCESS_ROUTE}/documento`;
/** Ruta del detalle de un saldo desde su documento. */
export const rutaSaldoDeDocumento = (documentoId: string, saldoId: string): string[] => [DOCUMENT_SALDO_ROUTE, documentoId, 'saldo', saldoId];
/** Vista de un registro automático de saldos de apertura: `${AUTOMATIC_ROUTE}/:id`. */
export const AUTOMATIC_ROUTE = `${PROCESS_ROUTE}/automatico`;
/** Vista de un ajuste de saldo inicial (RSIN con tipo de operación 2): `${ADJUSTMENT_ROUTE}/:id`. */
export const ADJUSTMENT_ROUTE = `${PROCESS_ROUTE}/ajuste`;

/**
 * MFD «Documentos de saldos iniciales» en `docs/menu-procesos.xlsx` (columna id): arma las migas de pan y el título.
 * Si se cambia el id en la planilla, cambiarlo aquí (`npm run menu:build` avisa).
 */
export const PROCESS_ID = 'doc-saldos-iniciales';

/** Opción del panel «Crear documento» (pestaña Documentos). */
export const CREATE_DOCUMENT_OPTIONS: CreateDocumentProcessOption[] = [
  {
    id: 'saldos-iniciales',
    label: 'Registro de saldos iniciales en libro bancos y libretas',
    route: REQUEST_ROUTE,
    documents: [NOMBRE_DOCUMENTO],
    documentOptions: [{ label: NOMBRE_DOCUMENTO, route: REQUEST_ROUTE, actionTypes: ['Creación'] }],
    actionTypes: ['Creación'],
  },
];
