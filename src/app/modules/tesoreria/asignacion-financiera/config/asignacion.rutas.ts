import type { CreateDocumentProcessOption } from '../../../../shared/components/create-document/create-document.component';
import { NOMBRE_DOCUMENTO } from '../models/asignacion.model';

/** Rutas e ids de la asignación financiera. Los ids existen en `DEFAULT_PROCESS_TREE` (shared/utils/process-tree.util.ts). */
export const PROCESS_ROUTE = '/procesos/asignacion-financiera';
export const REQUEST_SEGMENT = 'solicitud';
export const REQUEST_ROUTE = `${PROCESS_ROUTE}/${REQUEST_SEGMENT}`;

/**
 * MFD «Documentos de asignación financiera» en `docs/menu-procesos.xlsx` (columna id): arma las migas de pan y el
 * título de la pantalla. Si se cambia el id en la planilla, cambiarlo aquí (`npm run menu:build` avisa).
 */
export const PROCESS_ID = 'doc-asigna-financiera';

/** Opción del panel «Crear documento» (shell y pestaña Documentos). */
export const CREATE_DOCUMENT_OPTIONS: CreateDocumentProcessOption[] = [
  {
    id: 'asignacion-financiera',
    label: 'Asignación financiera',
    route: REQUEST_ROUTE,
    documents: [NOMBRE_DOCUMENTO],
    documentOptions: [{ label: NOMBRE_DOCUMENTO, route: REQUEST_ROUTE, actionTypes: ['Creación'] }],
    actionTypes: ['Creación'],
  },
];
