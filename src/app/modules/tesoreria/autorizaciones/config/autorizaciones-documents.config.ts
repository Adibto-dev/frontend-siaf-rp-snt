import { ESTADO } from '../../../../core/models/documento.model';
import type { DocumentsRecordsColumn, DocumentsRecordsConfig } from '../../../../shared/types/documents-records.types';
import { buildProcessBreadcrumbs } from '../../../../shared/utils/breadcrumbs.util';
import { nombreDeProceso } from '../../../../shared/utils/process-tree.util';
import { NOMBRE_DOCUMENTO } from '../models/autorizacion.model';
import { ACCIONES, CREATE_DOCUMENT_OPTIONS, PROCESS_ID, PROCESS_ROUTE, REQUEST_ROUTE } from './autorizaciones.rutas';

/** «Documentos de autorización»: columnas, filtros y opciones de `siaf-documents-records-page`. */

const documentColumns: DocumentsRecordsColumn[] = [
  { key: 'document', label: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[320px]', kind: 'document-link' },
  { key: 'number', label: 'Número', visibility: 'visible', group: 'default', widthClass: 'w-[280px]' },
  { key: 'actionType', label: 'Tipo de acción', visibility: 'visible', group: 'default', widthClass: 'w-[160px]' },
  { key: 'status', label: 'Estado', visibility: 'visible', group: 'default', widthClass: 'w-[150px]', kind: 'flow-status' },
  { key: 'system', label: 'Sistemas Nacionales', visibility: 'visible', group: 'default', widthClass: 'w-[240px]' },
  { key: 'date', label: 'Fecha de registro', visibility: 'visible', group: 'default', widthClass: 'w-[170px]' },
  { key: 'creator', label: 'Creador', visibility: 'visible', group: 'more', widthClass: 'w-[220px]' },
  { key: 'subject', label: 'Asunto/Motivo', visibility: 'hidden', group: 'more', widthClass: 'w-[280px]' },
  { key: 'requesterArea', label: 'Área solicitante', visibility: 'hidden', group: 'more', widthClass: 'w-[240px]' },
  { key: 'entity', label: 'Entidad', visibility: 'visible', group: 'more', widthClass: 'w-[320px]' },
  { key: 'approvalDate', label: 'Fecha de autorización', visibility: 'hidden', group: 'more', widthClass: 'w-[200px]' },
  { key: 'approvalUser', label: 'Usuario que autorizó', visibility: 'hidden', group: 'more', widthClass: 'w-[220px]' },
];

/** Registros (Figma 24416:106177): procedimiento, responsable, cuenta bancaria, estado y documento. */
const recordColumns: DocumentsRecordsColumn[] = [
  { key: 'procedimiento', label: 'Procedimiento', visibility: 'visible', group: 'default', widthClass: 'w-[260px]' },
  { key: 'usuario', label: 'Usuario', headerGroup: 'Responsable', visibility: 'visible', group: 'default', widthClass: 'w-[110px]' },
  { key: 'dni', label: 'N° documento', headerGroup: 'Responsable', visibility: 'visible', group: 'default', widthClass: 'w-[160px]' },
  { key: 'nombres', label: 'Nombres y apellidos', headerGroup: 'Responsable', visibility: 'visible', group: 'default', widthClass: 'w-[220px]' },
  { key: 'numeroCuenta', label: 'Número', headerGroup: 'Cuenta bancaria', visibility: 'visible', group: 'default', widthClass: 'w-[220px]' },
  { key: 'denominacion', label: 'Denominación', headerGroup: 'Cuenta bancaria', visibility: 'visible', group: 'default', widthClass: 'w-[220px]' },
  { key: 'moneda', label: 'Moneda', headerGroup: 'Cuenta bancaria', visibility: 'visible', group: 'default', widthClass: 'w-[90px]' },
  { key: 'entidad', label: 'Entidad', headerGroup: 'Cuenta bancaria', visibility: 'visible', group: 'default', widthClass: 'w-[220px]' },
  { key: 'fechaDesde', label: 'Desde', headerGroup: 'Vigencia', visibility: 'visible', group: 'default', widthClass: 'w-[120px]' },
  { key: 'fechaHasta', label: 'Hasta', headerGroup: 'Vigencia', visibility: 'visible', group: 'default', widthClass: 'w-[120px]' },
  { key: 'status', label: 'Estado de registro', visibility: 'visible', group: 'default', widthClass: 'w-[130px]', kind: 'record-status' },
  { key: 'number', label: 'Número', headerGroup: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[280px]' },
];

export const AUTORIZACIONES_DOCUMENTS_CONFIG: DocumentsRecordsConfig = {
  title: nombreDeProceso(PROCESS_ID, 'Documentos de autorización'),
  processId: PROCESS_ID,
  defaultRequestRoute: REQUEST_ROUTE,
  createDocumentOptions: CREATE_DOCUMENT_OPTIONS,
  breadcrumbs: buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE),
  documentRows: [],
  recordRows: [],
  documentColumns,
  recordColumns,
  documentTableMinWidthClass: 'min-w-[2200px]',
  recordTableMinWidthClass: 'min-w-[2150px]',
  // El creador autorizador graba y autoriza en el formulario: no hay Verificar ni Aprobar en bloque.
  flujoDirecto: true,
  recordTrackKey: 'recordId',
  recordHistoryDocumentLabel: NOMBRE_DOCUMENTO,
  // El historial de un registro es el del último documento que lo creó o modificó.
  recordHistoryKind: 'documento',
  statusFilterOptions: [ESTADO.ELABORADO, ESTADO.VERIFICADO, ESTADO.APROBADO],
  actionTypeFilterOptions: ACCIONES,
  filterCampoOptions: [
    { label: 'Documento', value: 'document' },
    { label: 'Número', value: 'number' },
    { label: 'Tipo de acción', value: 'actionType' },
    { label: 'Estado', value: 'status' },
  ],
  filterValorOptions: [
    { label: ESTADO.ELABORADO, value: ESTADO.ELABORADO },
    { label: ESTADO.VERIFICADO, value: ESTADO.VERIFICADO },
    { label: ESTADO.APROBADO, value: ESTADO.APROBADO },
    { label: 'Creación', value: 'Creación' },
    { label: 'Modificación', value: 'Modificación' },
  ],
  fieldsMenuOptions: [{ label: 'Documento' }, { label: 'Tipo de acción' }, { label: 'Estado' }, { label: 'Fecha de registro', hasChildren: true }, { label: 'Entidad' }],
  recordFilter1Label: 'Estado',
  recordFilter1Key: 'status',
  recordFilter1Options: ['Activo', 'Inactivo'],
  recordFilter2Label: 'Moneda',
  recordFilter2Key: 'moneda',
  recordFilter2Options: ['PEN', 'USD'],
  recordFilterCampoOptions: [
    { label: 'Estado', value: 'status' },
    { label: 'Moneda', value: 'moneda' },
  ],
  recordFilterValorOptions: [
    { label: 'Activo', value: 'Activo' },
    { label: 'Inactivo', value: 'Inactivo' },
    { label: 'PEN', value: 'PEN' },
    { label: 'USD', value: 'USD' },
  ],
};
