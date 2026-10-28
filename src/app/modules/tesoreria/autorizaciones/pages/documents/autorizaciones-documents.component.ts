import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';

import { PermissionService } from '../../../../../core/auth/permission.service';
import { ESTADO } from '../../../../../core/models/documento.model';
import { SolicitudesFacadeService } from '../../../../../core/state/solicitudes-facade.service';
import { SolicitudesStateService } from '../../../../../core/state/solicitudes-state.service';
import { DocumentsRecordsPageComponent } from '../../../../../shared/components/documents-records-page/documents-records-page.component';
import { FILAS_POR_PAGINA } from '../../../../../shared/components/pagination/pagination.component';
import type { DocumentsQuery, DocumentsRecordsConfig, DocumentsRecordsRow } from '../../../../../shared/types/documents-records.types';
import { createNewDocumentIdsSignal } from '../../../../../shared/utils/new-document-ids.util';
import { AutorizacionesApiService } from '../../api/autorizaciones-api.service';
import { AUTORIZACIONES_DOCUMENTS_CONFIG } from '../../config/autorizaciones-documents.config';
import { REQUEST_ROUTE } from '../../config/autorizaciones.rutas';
import {
  AutorizacionRegistro,
  CODIGO_DOCUMENTO,
  NOMBRE_DOCUMENTO,
  cuentaDeAutorizacion,
  PERMISO_AUTORIZAR,
  etiquetaTipoAccion,
  fechaCorta,
  nombreEntidadDeCuenta,
  nombreProcedimiento,
  responsablePorUsuario,
} from '../../models/autorizacion.model';

/**
 * «Documentos de autorización». La pantalla la arma `siaf-documents-records-page`: esta página carga la bandeja
 * (documentos RAUT de creación y modificación) y las autorizaciones aprobadas (registros) y las pasa como filas.
 * Solo el creador autorizador ve «Crear documento»; los demás perfiles consultan.
 */
@Component({
  selector: 'siaf-autorizaciones-documents',
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
export class AutorizacionesDocumentsComponent implements OnInit {
  private readonly solicitudesState = inject(SolicitudesStateService);
  private readonly solicitudesFacade = inject(SolicitudesFacadeService);
  private readonly permissions = inject(PermissionService);
  private readonly api = inject(AutorizacionesApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly nuevos = createNewDocumentIdsSignal();

  private readonly registros = signal<AutorizacionRegistro[]>([]);
  readonly cargando = signal(true);

  ngOnInit(): void {
    // RAUT no pasa por el aprobador: todos los perfiles consultan la misma bandeja.
    this.solicitudesFacade.iniciarBandeja('creator', this.destroyRef, [CODIGO_DOCUMENTO], { page: 1, limit: FILAS_POR_PAGINA });
    this.api.listarRegistros().subscribe({
      next: (registros) => { this.registros.set(registros); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  onDocumentsQuery(q: DocumentsQuery): void {
    const query = { search: q.search, page: q.page, limit: q.limit };
    this.solicitudesFacade.cargarBandejaCreador([CODIGO_DOCUMENTO], query);
  }

  readonly pageConfig = computed((): DocumentsRecordsConfig => {
    const solicitudes = this.solicitudesState.bandejaCreador();
    const nuevos = this.nuevos();

    const documentRows: DocumentsRecordsRow[] = solicitudes.map((s) => {
      const aprobado = [...s.historial].reverse().find((h) => h.estado === ESTADO.APROBADO);
      return {
        document: s.tipoDocumento,
        documentId: s.id,
        isNew: nuevos.has(s.id),
        number: s.numero || '—',
        actionType: etiquetaTipoAccion(s.tipoAccion),
        status: s.estado,
        system: 'Sistema Nacional de Tesorería',
        date: s.fecha,
        entity: s.entidad || '—',
        creator: s.creador,
        subject: s.justificacion,
        requesterArea: s.unidad,
        approvalDate: aprobado?.fecha ?? '—',
        approvalUser: aprobado?.usuario ?? '—',
        linkRoute: `${REQUEST_ROUTE}/${s.id}`,
      };
    });

    const recordRows: DocumentsRecordsRow[] = this.registros().map((r) => {
      const responsable = responsablePorUsuario(r.responsable);
      const cuenta = cuentaDeAutorizacion(r.cuentaBancaria);
      const ultimo = r.documentos.at(-1);
      return {
        recordId: r.id,
        procedimiento: nombreProcedimiento(r.procedimiento),
        usuario: r.responsable,
        dni: responsable?.dni ?? '—',
        nombres: responsable?.nombres ?? '—',
        numeroCuenta: r.cuentaBancaria,
        denominacion: cuenta?.denominacion ?? '—',
        moneda: cuenta?.moneda ?? '—',
        entidad: nombreEntidadDeCuenta(r.cuentaBancaria) || '—',
        fechaDesde: fechaCorta(r.fechaDesde),
        fechaHasta: fechaCorta(r.fechaHasta),
        status: r.estado,
        // Para el historial del registro: el último documento que lo creó o modificó.
        document: NOMBRE_DOCUMENTO,
        documentId: r.documentoId,
        number: r.numeroDocumento,
        actionType: etiquetaTipoAccion(ultimo?.tipoAccion),
        linkRoute: `${REQUEST_ROUTE}/${r.documentoId}`,
      };
    });

    return {
      ...AUTORIZACIONES_DOCUMENTS_CONFIG,
      // «Crear documento» solo para el creador autorizador; el resto consulta.
      createDocumentOptions: this.permissions.can(PERMISO_AUTORIZAR) ? AUTORIZACIONES_DOCUMENTS_CONFIG.createDocumentOptions : [],
      documentRows,
      recordRows,
      serverQuery: { total: this.solicitudesState.bandejaTotal() },
    };
  });
}
