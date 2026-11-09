import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';

import { PermissionService } from '../../../../../core/auth/permission.service';
import { ESTADO } from '../../../../../core/models/documento.model';
import { SolicitudesFacadeService } from '../../../../../core/state/solicitudes-facade.service';
import { SolicitudesStateService } from '../../../../../core/state/solicitudes-state.service';
import { DocumentsRecordsPageComponent } from '../../../../../shared/components/documents-records-page/documents-records-page.component';
import { FILAS_POR_PAGINA } from '../../../../../shared/components/pagination/pagination.component';
import type { DocumentsQuery, DocumentsRecordsConfig, DocumentsRecordsRow } from '../../../../../shared/types/documents-records.types';
import { createNewDocumentIdsSignal } from '../../../../../shared/utils/new-document-ids.util';
import { cuentaPorNumero, formatoImporte } from '../../../saldos-iniciales/models/saldo-inicial.model';
import { TrasladosApiService } from '../../api/traslados-api.service';
import { TRASLADOS_DOCUMENTS_CONFIG } from '../../config/traslados-documents.config';
import { REQUEST_ROUTE } from '../../config/traslados.rutas';
import { CODIGO_DOCUMENTO, NOMBRE_DOCUMENTO, TrasladoRegistro } from '../../models/traslado.model';

const MONEDA: Record<string, string> = { PEN: 'Soles', USD: 'Dólares' };

/** «000032, 000033» para las columnas Origen y Destino. */
const cuentas = (r: TrasladoRegistro, naturaleza: 'Débito' | 'Crédito'): string =>
  r.movimientos.filter((m) => m.naturaleza === naturaleza).map((m) => m.idCorrelativo).join(', ');

/**
 * «Documentos y registros» del traslado entre cuentas de registros. La pantalla entera la arma
 * `siaf-documents-records-page`: esta página solo carga la bandeja (documentos) y los traslados procesados
 * (registros) y los pasa como filas.
 */
@Component({
  selector: 'siaf-traslados-documents',
  standalone: true,
  imports: [DocumentsRecordsPageComponent],
  template: `
    <siaf-documents-records-page
      [config]="pageConfig()"
      [loading]="cargando()"
      (documentsQueryChange)="onDocumentsQuery($event)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrasladosDocumentsComponent implements OnInit {
  private readonly solicitudesState = inject(SolicitudesStateService);
  private readonly solicitudesFacade = inject(SolicitudesFacadeService);
  private readonly permissions = inject(PermissionService);
  private readonly trasladosApi = inject(TrasladosApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly nuevos = createNewDocumentIdsSignal();

  private readonly registros = signal<TrasladoRegistro[]>([]);
  readonly cargando = signal(true);

  ngOnInit(): void {
    // Bandeja según el rol (el aprobador además refresca cada 30 s). La primera página la resuelve el backend.
    this.solicitudesFacade.iniciarBandeja(this.permissions.currentRole(), this.destroyRef, [CODIGO_DOCUMENTO], { page: 1, limit: FILAS_POR_PAGINA });
    this.trasladosApi.listarRegistros().subscribe({
      next: (registros) => { this.registros.set(registros); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  /** Búsqueda y paginación de la pestaña Documentos (Enter, lupa o cambio de página). */
  onDocumentsQuery(q: DocumentsQuery): void {
    const query = { search: q.search, page: q.page, limit: q.limit };
    if (this.permissions.currentRole() === 'approver') this.solicitudesFacade.cargarBandejaAprobador([CODIGO_DOCUMENTO], query);
    else this.solicitudesFacade.cargarBandejaCreador([CODIGO_DOCUMENTO], query);
  }

  readonly pageConfig = computed((): DocumentsRecordsConfig => {
    const solicitudes = this.permissions.currentRole() === 'approver'
      ? this.solicitudesState.bandejaAprobador()
      : this.solicitudesState.bandejaCreador();
    const nuevos = this.nuevos();

    const documentRows: DocumentsRecordsRow[] = solicitudes.map((s) => {
      const verificado = [...s.historial].reverse().find((h) => h.estado === ESTADO.VERIFICADO);
      const aprobado = [...s.historial].reverse().find((h) => h.estado === ESTADO.APROBADO);
      return {
        document: s.tipoDocumento,
        documentId: s.id,
        isNew: nuevos.has(s.id),
        number: s.numero || '—',
        actionType: s.tipoAccion === 'creacion' ? 'Creación' : s.tipoAccion,
        status: s.estado,
        system: 'Tesorería',
        date: s.fecha,
        entity: s.entidad || '—',
        creator: s.creador,
        subject: s.justificacion,
        requesterArea: s.unidad,
        evaluationDate: verificado?.fecha ?? '—',
        evaluationUser: verificado?.usuario ?? '—',
        approvalDate: aprobado?.fecha ?? '—',
        approvalUser: aprobado?.usuario ?? '—',
        linkRoute: `${REQUEST_ROUTE}/${s.id}`,
      };
    });

    const recordRows: DocumentsRecordsRow[] = this.registros().map((r) => ({
      recordId: r.id,
      status: r.estado,
      secuencia: r.secuencia,
      cuentaBancaria: r.cuentaBancaria,
      denominacion: cuentaPorNumero(r.cuentaBancaria)?.denominacion ?? '—',
      modalidad: r.modalidad,
      origenes: cuentas(r, 'Débito'),
      destinos: cuentas(r, 'Crédito'),
      moneda: MONEDA[r.moneda] ?? r.moneda,
      total: formatoImporte(r.total),
      fechaRegistro: new Date(r.fechaRegistro).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      // Para el historial del registro: el documento que lo creó.
      document: NOMBRE_DOCUMENTO,
      documentId: r.documentoId,
      number: r.numeroDocumento,
      actionType: 'Creación',
      linkRoute: `${REQUEST_ROUTE}/${r.documentoId}`,
    }));

    return {
      ...TRASLADOS_DOCUMENTS_CONFIG,
      documentRows,
      recordRows,
      serverQuery: { total: this.solicitudesState.bandejaTotal() },
    };
  });
}
