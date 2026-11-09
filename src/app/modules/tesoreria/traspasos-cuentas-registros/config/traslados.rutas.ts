import type { CreateDocumentProcessOption } from '../../../../shared/components/create-document/create-document.component';
import { NOMBRE_DOCUMENTO } from '../models/traslado.model';

/** Rutas e ids del traslado entre cuentas de registros. Los ids existen en `DEFAULT_PROCESS_TREE` (shared/utils/process-tree.util.ts). */
export const PROCESS_ROUTE = '/procesos/traspasos-cuentas-registros';
export const REQUEST_SEGMENT = 'solicitud';
export const REQUEST_ROUTE = `${PROCESS_ROUTE}/${REQUEST_SEGMENT}`;
export const CONSULTAS_ROUTE = `${PROCESS_ROUTE}/consultas`;

/**
 * MFD «Documentos» en `docs/menu-procesos.xlsx` (columna id): arma las migas de pan y el título de la pantalla.
 * Si se cambia el id en la planilla, cambiarlo aquí (`npm run menu:build` avisa).
 */
export const PROCESS_ID = 'doc-traslado-cta-registros';
/** MFD «Consultas y reportes» en `docs/menu-procesos.xlsx`. */
export const CONSULTAS_PROCESS_ID = 'cons-traslado-cta-registros';

/** Opción del panel «Crear documento» (shell y pestaña Documentos). */
export const CREATE_DOCUMENT_OPTIONS: CreateDocumentProcessOption[] = [
  {
    id: 'traslado-cuentas-registros',
    label: 'Traslado de recursos entre cuentas de registros',
    route: REQUEST_ROUTE,
    documents: [NOMBRE_DOCUMENTO],
    documentOptions: [{ label: NOMBRE_DOCUMENTO, route: REQUEST_ROUTE, actionTypes: ['Creación'] }],
    actionTypes: ['Creación'],
  },
];
