import { ESTADO } from '../../../../core/models/documento.model';
import type {
  DocumentsRecordsColumn,
  DocumentsRecordsConfig,
  DocumentsRecordsFilterOption,
  DocumentsRecordsMenuOption,
} from '../../../../shared/types/documents-records.types';
import { buildProcessBreadcrumbs } from '../../../../shared/utils/breadcrumbs.util';
import { nombreDeProceso } from '../../../../shared/utils/process-tree.util';
import { ABREVIATURAS } from '../../../../shared/utils/abreviaturas.util';
import { NOMBRE_DOCUMENTO } from '../models/traslado.model';
import { CREATE_DOCUMENT_OPTIONS, PROCESS_ID, PROCESS_ROUTE, REQUEST_ROUTE } from './traslados.rutas';

/**
 * Configuración de «Documentos y registros» del traslado entre cuentas de registros (Figma 2.10.6.6). La pantalla
 * completa la pinta `siaf-documents-records-page`: aquí solo se dice qué columnas, filtros y opciones tiene.
 */

const documentColumns: DocumentsRecordsColumn[] = [
  { key: 'document', label: 'Documento', visibility: 'visible', group: 'default', widthClass: 'w-[380px]', kind: 'document-link' },
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
  { key: 'denominacion', label: 'Denominación', visibility: 'visible', group: 'default', widthClass: 'w-[260px]' },
  { key: 'modalidad', label: 'Modalidad', visibility: 'visible', group: 'default', widthClass: 'w-[120px]' },
  { key: 'origenes', label: 'Origen', visibility: 'visible', group: 'default', widthClass: 'w-[180px]' },
  { key: 'destinos', label: 'Destino', visibility: 'visible', group: 'default', widthClass: 'w-[180px]' },
  { key: 'moneda', label: 'Moneda', visibility: 'visible', group: 'default', widthClass: 'w-[110px]' },
  { key: 'total', label: 'Importe trasladado', visibility: 'visible', group: 'default', widthClass: 'w-[170px]', align: 'right' },
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

export const TRASLADOS_DOCUMENTS_CONFIG: DocumentsRecordsConfig = {
  // Título = nombre del MFD en el menú de procesos.
  title: nombreDeProceso(PROCESS_ID, 'Traslado de recursos entre cuentas de registros'),
  processId: PROCESS_ID,
  defaultRequestRoute: REQUEST_ROUTE,
  createDocumentOptions: CREATE_DOCUMENT_OPTIONS,
  breadcrumbs: buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE),
  documentRows: [],
  recordRows: [],
  documentColumns,
  recordColumns,
  documentTableMinWidthClass: 'min-w-[1800px]',
  recordTableMinWidthClass: 'min-w-[1900px]',
  recordTrackKey: 'recordId',
  recordHistoryDocumentLabel: NOMBRE_DOCUMENTO,
  // El historial de un registro es el del documento que lo creó.
  recordHistoryKind: 'documento',
  statusFilterOptions: [ESTADO.ELABORADO, ESTADO.VERIFICADO, ESTADO.OBSERVADO, ESTADO.APROBADO, ESTADO.RECHAZADO],
  actionTypeFilterOptions: ['Creación'],
  filterCampoOptions,
  filterValorOptions,
  fieldsMenuOptions,
  recordFilter1Label: 'Modalidad',
  recordFilter1Key: 'modalidad',
  recordFilter1Options: ['1 a 1', '1 a N', 'N a 1', 'N a N'],
  recordFilter2Label: 'Moneda',
  recordFilter2Key: 'moneda',
  recordFilter2Options: ['Soles', 'Dólares'],
  recordFilterCampoOptions: [
    { label: 'Cuenta bancaria', value: 'cuentaBancaria' },
    { label: 'Modalidad', value: 'modalidad' },
    { label: 'Moneda', value: 'moneda' },
  ],
  recordFilterValorOptions: [
    { label: '1 a 1', value: '1 a 1' },
    { label: '1 a N', value: '1 a N' },
    { label: 'N a 1', value: 'N a 1' },
    { label: 'N a N', value: 'N a N' },
    { label: 'Soles', value: 'Soles' },
    { label: 'Dólares', value: 'Dólares' },
  ],
};
