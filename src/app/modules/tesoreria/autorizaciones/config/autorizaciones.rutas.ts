import type { CreateDocumentProcessOption } from '../../../../shared/components/create-document/create-document.component';
import { NOMBRE_DOCUMENTO } from '../models/autorizacion.model';

/** Rutas e ids del proceso de autorizaciones. */
export const PROCESS_ROUTE = '/procesos/autorizaciones';
export const REQUEST_SEGMENT = 'solicitud';
export const REQUEST_ROUTE = `${PROCESS_ROUTE}/${REQUEST_SEGMENT}`;

/** MFD «Documentos de autorización» en `docs/menu-procesos.xlsx` (columna id). */
export const PROCESS_ID = 'doc-autorizacion';

export const ACCIONES = ['Creación', 'Modificación'];

/** Opción del panel «Crear documento» (pestaña Documentos). */
export const CREATE_DOCUMENT_OPTIONS: CreateDocumentProcessOption[] = [
  {
    id: 'autorizaciones',
    label: 'Documentos de autorización',
    route: REQUEST_ROUTE,
    documents: [NOMBRE_DOCUMENTO],
    documentOptions: [{ label: NOMBRE_DOCUMENTO, route: REQUEST_ROUTE, actionTypes: ACCIONES }],
    actionTypes: ACCIONES,
  },
];
