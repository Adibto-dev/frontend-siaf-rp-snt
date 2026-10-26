import type { CreateDocumentProcessOption } from '../../../../shared/components/create-document/create-document.component';
import { NOMBRE_DOCUMENTO } from '../models/saldo-inicial.model';

/** Rutas e ids del proceso de saldos iniciales. */
export const PROCESS_ROUTE = '/procesos/saldos-iniciales';
export const REQUEST_SEGMENT = 'solicitud';
export const REQUEST_ROUTE = `${PROCESS_ROUTE}/${REQUEST_SEGMENT}`;

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
