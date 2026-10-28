import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';

import { PermissionService } from '../../../../../core/auth/permission.service';
import { ESTADO } from '../../../../../core/models/documento.model';
import { SolicitudesFacadeService } from '../../../../../core/state/solicitudes-facade.service';
import { SolicitudesStateService } from '../../../../../core/state/solicitudes-state.service';
import { DocumentsRecordsPageComponent } from '../../../../../shared/components/documents-records-page/documents-records-page.component';
import { ACCION_HISTORIAL_REGISTRO } from '../../../../../shared/types/documents-records.types';
import type {
  DocumentsQuery,
  DocumentsRecordsConfig,
  DocumentsRecordsRow,
  DocumentsRecordsRowActionEvent,
} from '../../../../../shared/types/documents-records.types';
import { SidePanelComponent } from '../../../../../shared/ui/side-panel/side-panel.component';
import { UploadedFileCardComponent, UploadedFileInfo } from '../../../../../shared/ui/uploaded-file-card/uploaded-file-card.component';
import { SaldoHistorialPanelComponent } from '../../components/saldo-historial-panel/saldo-historial-panel.component';
import { SaldoLibretasPanelComponent } from '../../components/saldo-libretas-panel/saldo-libretas-panel.component';
import { createNewDocumentIdsSignal } from '../../../../../shared/utils/new-document-ids.util';
import { SaldosInicialesApiService } from '../../api/saldos-iniciales-api.service';
import { ACCION_VER_CUENTAS, ACCION_VER_SUSTENTO, SALDOS_INICIALES_DOCUMENTS_CONFIG } from '../../config/saldos-iniciales-documents.config';
import { AUTOMATIC_ROUTE, RECORD_ROUTE, REQUEST_ROUTE } from '../../config/saldos-iniciales.rutas';
import {
  CODIGO_AUTOMATICO,
  CODIGO_DOCUMENTO,
  NOMBRE_AUTOMATICO,
  NOMBRE_DOCUMENTO,
  SaldoInicialRegistro,
  entidadPorCodigo,
  formatoFecha,
  formatoImporte,
  redondear,
  saldoActualizado,
} from '../../models/saldo-inicial.model';
import { FILAS_POR_PAGINA } from '../../../../../shared/components/pagination/pagination.component';

/** Documentos de la bandeja: los que registra el usuario (RSIN) y los automáticos del sistema (RASA). */
const TIPOS = [CODIGO_DOCUMENTO, CODIGO_AUTOMATICO];

/**
 * «Documentos de saldos iniciales». La pantalla entera la arma `siaf-documents-records-page`: esta página solo
 * carga la bandeja (documentos RSIN) y los saldos aprobados (registros) y los pasa como filas.
 */
@Component({
  selector: 'siaf-saldos-iniciales-documents',
  standalone: true,
  imports: [DocumentsRecordsPageComponent, SaldoHistorialPanelComponent, SaldoLibretasPanelComponent, SidePanelComponent, UploadedFileCardComponent],
  template: `
    <siaf-documents-records-page
      [config]="pageConfig()"
      [loading]="cargando()"
      (documentsQueryChange)="onDocumentsQuery($event)"
      (recordActionTriggered)="onRecordAction($event)"
    />

    <!-- Ver cuentas de registro: el mismo panel que en la solicitud -->
    <siaf-saldo-libretas-panel [saldo]="registroCuentas()" (closed)="registroCuentas.set(null)" />

    <!-- Historial del registro: documentos de la misma cuenta bancaria -->
    <siaf-saldo-historial-panel [registro]="registroHistorial()" [registros]="registrosCargados()" (closed)="registroHistorial.set(null)" />

    <!-- Ver documento de sustento: el taller solo guarda el nombre del archivo -->
    <siaf-side-panel title="Documento de sustento" [open]="!!sustentoVisto()" [showFooter]="false" (closed)="sustentoVisto.set(null)">
      @if (sustentoVisto(); as archivo) {
        <siaf-uploaded-file-card [file]="archivo" [readonly]="true" />
      }
    </siaf-side-panel>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaldosInicialesDocumentsComponent implements OnInit {
  private readonly solicitudesState = inject(SolicitudesStateService);
  private readonly solicitudesFacade = inject(SolicitudesFacadeService);
  private readonly permissions = inject(PermissionService);
  private readonly saldosApi = inject(SaldosInicialesApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly nuevos = createNewDocumentIdsSignal();

  private readonly registros = signal<SaldoInicialRegistro[]>([]);
  readonly cargando = signal(true);
  /** Registro cuyas cuentas de registro se ven en el panel lateral. */
  readonly registroCuentas = signal<SaldoInicialRegistro | null>(null);
  /** Registro cuyo historial se ve a pantalla completa. */
  readonly registroHistorial = signal<SaldoInicialRegistro | null>(null);
  readonly registrosCargados = this.registros.asReadonly();
  /** Archivo de sustento que se ve en el panel lateral. */
  readonly sustentoVisto = signal<UploadedFileInfo | null>(null);

  onRecordAction({ actionId, row }: DocumentsRecordsRowActionEvent): void {
    const registro = this.registros().find((r) => r.registroId === row['recordId']);
    if (!registro) return;
    if (actionId === ACCION_HISTORIAL_REGISTRO) this.registroHistorial.set(registro);
    if (actionId === ACCION_VER_CUENTAS) this.registroCuentas.set(registro);
    if (actionId === ACCION_VER_SUSTENTO && registro.sustento) this.sustentoVisto.set({ name: registro.sustento });
  }

  ngOnInit(): void {
    // Bandeja según el rol (el aprobador además refresca cada 30 s).
    // La primera página la resuelve el backend (simulado), igual que las siguientes.
    this.solicitudesFacade.iniciarBandeja(this.permissions.currentRole(), this.destroyRef, TIPOS, { page: 1, limit: FILAS_POR_PAGINA });
    this.saldosApi.listarRegistros().subscribe({
      next: (registros) => { this.registros.set(registros); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  /** Búsqueda y paginación de la pestaña Documentos (Enter, lupa o cambio de página). */
  onDocumentsQuery(q: DocumentsQuery): void {
    const query = { search: q.search, page: q.page, limit: q.limit };
    if (this.permissions.currentRole() === 'approver') this.solicitudesFacade.cargarBandejaAprobador(TIPOS, query);
    else this.solicitudesFacade.cargarBandejaCreador(TIPOS, query);
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
        system: 'Sistema Nacional de Tesorería',
        date: s.fecha,
        entity: s.entidad || '—',
        creator: s.creador,
        subject: s.justificacion,
        requesterArea: s.unidad,
        evaluationDate: verificado?.fecha ?? '—',
        evaluationUser: verificado?.usuario ?? '—',
        approvalDate: aprobado?.fecha ?? '—',
        approvalUser: aprobado?.usuario ?? '—',
        linkRoute: s.tipoDocumento === NOMBRE_AUTOMATICO ? `${AUTOMATIC_ROUTE}/${s.id}` : `${REQUEST_ROUTE}/${s.id}`,
      };
    });

    // Lo último registrado arriba: secuencia de mayor a menor.
    const ordenados = [...this.registros()].sort((a, b) => (b.secuencia ?? '').localeCompare(a.secuencia ?? ''));
    const recordRows: DocumentsRecordsRow[] = ordenados.map((r) => {
      // En un ajuste, libro bancos muestra el saldo después del ajuste.
      const cuenta = r.ajuste ? saldoActualizado(r.ajuste.saldoInicial, r.importeCuenta, r.ajuste.naturaleza) : r.importeCuenta;
      const nacional = r.ajuste ? redondear(cuenta * r.tipoCambio) : r.importeNacional;
      return {
      recordId: r.registroId,
      status: r.estado,
      secuencia: r.secuencia ?? '—',
      entidadFinanciera: entidadPorCodigo(r.entidadFinanciera)?.denominacion ?? r.entidadFinanciera,
      numeroCuenta: r.cuentaBancaria,
      moneda: r.moneda,
      fechaOperacion: formatoFecha(r.fechaOperacion),
      movimiento: r.movimiento,
      descripcion: r.automatico ? NOMBRE_AUTOMATICO : NOMBRE_DOCUMENTO,
      sustento: r.sustento ?? undefined,
      importeCuenta: formatoImporte(cuenta),
      importeNacional: formatoImporte(nacional),
      // Para el historial del registro: el documento que lo creó.
      document: r.automatico ? NOMBRE_AUTOMATICO : NOMBRE_DOCUMENTO,
      documentId: r.documentoId,
      number: r.numeroDocumento,
      actionType: 'Creación',
      linkRoute: r.automatico ? `${AUTOMATIC_ROUTE}/${r.documentoId}` : `${REQUEST_ROUTE}/${r.documentoId}`,
      };
    });

    return {
      ...SALDOS_INICIALES_DOCUMENTS_CONFIG,
      documentRows,
      recordRows,
      serverQuery: { total: this.solicitudesState.bandejaTotal() },
      recordRoute: (row) => `${RECORD_ROUTE}/${row['recordId']}`,
    };
  });
}
