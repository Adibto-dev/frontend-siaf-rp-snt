import { ESTADO } from '../../../../core/models/documento.model';
import type {
  DocumentsRecordsColumn,
  DocumentsRecordsConfig,
  DocumentsRecordsFilterOption,
  DocumentsRecordsMenuOption,
} from '../../../../shared/types/documents-records.types';
import { ABREVIATURAS } from '../../../../shared/utils/abreviaturas.util';
import { buildProcessBreadcrumbs } from '../../../../shared/utils/breadcrumbs.util';
import { nombreDeProceso } from '../../../../shared/utils/process-tree.util';
import { CREATE_DOCUMENT_OPTIONS, PROCESS_ID, PROCESS_ROUTE, REQUEST_ROUTE } from './asignacion.rutas';

/**
 * Configuración de «Documentos de asignación financiera» (Figma 781:62657). La pantalla la pinta
 * `siaf-documents-records-page`: aquí solo van las columnas, los filtros y las opciones.
 */

const documentColumns: DocumentsRecordsColumn[] = [
  { key: 'document', label: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[340px]', kind: 'document-link' },
  { key: 'number', label: 'Número', visibility: 'visible', group: 'default', widthClass: 'w-[280px]' },
  { key: 'actionType', label: 'Tipo de acción', visibility: 'visible', group: 'default', widthClass: 'w-[160px]' },
  { key: 'status', label: 'Estado', visibility: 'visible', group: 'default', widthClass: 'w-[150px]', kind: 'flow-status' },
  { key: 'system', label: 'Sistema', visibility: 'visible', group: 'default', widthClass: 'w-[160px]' },
  { key: 'date', label: 'Fecha de registro', visibility: 'visible', group: 'default', widthClass: 'w-[170px]' },
  { key: 'entity', label: 'Entidad', visibility: 'visible', group: 'default', widthClass: 'w-[320px]' },
  { key: 'creator', label: 'Creador', visibility: 'hidden', group: 'more', widthClass: 'w-[220px]' },
  { key: 'subject', label: 'Asunto/Motivo', visibility: 'hidden', group: 'more', widthClass: 'w-[280px]' },
  { key: 'requesterArea', label: 'Área solicitante', visibility: 'hidden', group: 'more', widthClass: 'w-[240px]' },
  { key: 'evaluationDate', label: 'Fecha de evaluación', visibility: 'hidden', group: 'more', widthClass: 'w-[200px]' },
  { key: 'evaluationUser', label: 'Usuario de evaluación', visibility: 'hidden', group: 'more', widthClass: 'w-[220px]' },
  { key: 'approvalDate', label: 'Fecha de aprobación', visibility: 'hidden', group: 'more', widthClass: 'w-[200px]' },
  { key: 'approvalUser', label: 'Usuario de aprobación', visibility: 'hidden', group: 'more', widthClass: 'w-[220px]' },
];

const recordColumns: DocumentsRecordsColumn[] = [
  { key: 'secuencia', label: ABREVIATURAS.secuencia.abreviatura, tooltip: ABREVIATURAS.secuencia.termino, visibility: 'visible', group: 'default', widthClass: 'w-[100px]' },
  { key: 'cuentaBancaria', label: 'Cuenta bancaria', visibility: 'visible', group: 'default', widthClass: 'w-[210px]' },
  { key: 'denominacion', label: 'Denominación', visibility: 'visible', group: 'default', widthClass: 'w-[240px]' },
  { key: 'periodo', label: 'Periodicidad', visibility: 'visible', group: 'default', widthClass: 'w-[260px]' },
  { key: 'origenes', label: 'Origen', visibility: 'visible', group: 'default', widthClass: 'w-[120px]' },
  { key: 'destinos', label: 'Destino', visibility: 'visible', group: 'default', widthClass: 'w-[180px]' },
  { key: 'moneda', label: 'Moneda', visibility: 'visible', group: 'default', widthClass: 'w-[110px]' },
  { key: 'total', label: 'Importe asignado', visibility: 'visible', group: 'default', widthClass: 'w-[170px]', align: 'right' },
  { key: 'number', label: 'N° documento', visibility: 'visible', group: 'default', widthClass: 'w-[280px]' },
  { key: 'fechaRegistro', label: 'Fecha de registro', visibility: 'visible', group: 'default', widthClass: 'w-[160px]' },
  { key: 'status', label: 'Estado', visibility: 'visible', group: 'default', widthClass: 'w-[120px]', kind: 'record-status' },
];

const fieldsMenuOptions: DocumentsRecordsMenuOption[] = [
  { label: 'Documento' },
  { label: 'Tipo de acción' },
  { label: 'Estado' },
  { label: 'Fecha de registro', hasChildren: true },
  { label: 'Entidad' },
];

const filterCampoOptions: DocumentsRecordsFilterOption[] = [
  { label: 'Documento', value: 'document' },
  { label: 'Número', value: 'number' },
  { label: 'Tipo de acción', value: 'actionType' },
  { label: 'Estado', value: 'status' },
  { label: 'Fecha', value: 'date' },
  { label: 'Entidad', value: 'entity' },
];

const filterValorOptions: DocumentsRecordsFilterOption[] = [
  { label: ESTADO.ELABORADO, value: ESTADO.ELABORADO },
  { label: ESTADO.VERIFICADO, value: ESTADO.VERIFICADO },
  { label: ESTADO.APROBADO, value: ESTADO.APROBADO },
  { label: 'Creación', value: 'Creación' },
];

export const ASIGNACION_DOCUMENTS_CONFIG: DocumentsRecordsConfig = {
  // Título = nombre del MFD en el menú de procesos.
  title: nombreDeProceso(PROCESS_ID, 'Documentos de asignación financiera'),
  processId: PROCESS_ID,
  defaultRequestRoute: REQUEST_ROUTE,
  createDocumentOptions: CREATE_DOCUMENT_OPTIONS,
  breadcrumbs: buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE),
  documentRows: [],
  recordRows: [],
  documentColumns,
  recordColumns,
  documentTableMinWidthClass: 'min-w-[1700px]',
  recordTableMinWidthClass: 'min-w-[1900px]',
  recordTrackKey: 'recordId',
  recordHistoryDocumentLabel: 'Solicitud de Asignación Financiera',
  recordHistoryKind: 'propio',
  statusFilterOptions: [ESTADO.ELABORADO, ESTADO.VERIFICADO, ESTADO.OBSERVADO, ESTADO.APROBADO, ESTADO.RECHAZADO],
  actionTypeFilterOptions: ['Creación'],
  filterCampoOptions,
  filterValorOptions,
  fieldsMenuOptions,
  recordFilter1Label: 'Periodicidad',
  recordFilter1Key: 'tipoPeriodicidad',
  recordFilter1Options: ['Mensual', 'Semestral', 'Anual'],
  recordFilter2Label: 'Moneda',
  recordFilter2Key: 'moneda',
  recordFilter2Options: ['PEN', 'USD'],
  recordFilterCampoOptions: [
    { label: 'Cuenta bancaria', value: 'cuentaBancaria' },
    { label: 'Periodicidad', value: 'tipoPeriodicidad' },
    { label: 'Moneda', value: 'moneda' },
  ],
  recordFilterValorOptions: [
    { label: 'Mensual', value: 'Mensual' },
    { label: 'Semestral', value: 'Semestral' },
    { label: 'Anual', value: 'Anual' },
    { label: 'PEN', value: 'PEN' },
    { label: 'USD', value: 'USD' },
  ],
};
