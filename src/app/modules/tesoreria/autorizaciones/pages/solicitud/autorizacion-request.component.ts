import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { CatalogosApiService, TipoDocumentoResponse } from '../../../../../core/api/catalogos-api.service';
import { SolicitudResponse, SolicitudesApiService } from '../../../../../core/api/solicitudes-api.service';
import { CurrentUserService } from '../../../../../core/auth/current-user.service';
import { PermissionService } from '../../../../../core/auth/permission.service';
import { ESTADO, EstadoDocumento } from '../../../../../core/models/documento.model';
import { SolicitudesFacadeService } from '../../../../../core/state/solicitudes-facade.service';
import { BreadcrumbItem } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { DetailHistoryTabsComponent } from '../../../../../shared/components/detail-history-tabs/detail-history-tabs.component';
import { HistorialSource, buildHistoryEntries } from '../../../../../shared/components/detail-history-tabs/detail-history-tabs.utils';
import { RequestApprovalModalsComponent } from '../../../../../shared/components/request-approval-modals/request-approval-modals.component';
import { SelectionColumn, SelectionSideNavComponent } from '../../../../../shared/components/selection-side-nav/selection-side-nav.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { SolicitudeHeaderState } from '../../../../../shared/components/solicitude-header/solicitude-header.component';
import { SolicitudeInfoCardComponent, SolicitudeInfoField } from '../../../../../shared/components/solicitude-info-card/solicitude-info-card.component';
import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { ActionTrackerComponent, ActionTrackerSummary } from '../../../../../shared/ui/action-tracker/action-tracker.component';
import { AlertComponent } from '../../../../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { DateTimePickerComponent } from '../../../../../shared/ui/date-time-picker/date-time-picker.component';
import { DocumentSummaryCardComponent } from '../../../../../shared/ui/document-summary-card/document-summary-card.component';
import { EmptySectionComponent } from '../../../../../shared/ui/empty-section/empty-section.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { FlowStatus } from '../../../../../shared/ui/flow-status-tag/flow-status-tag.component';
import { RadioComponent } from '../../../../../shared/ui/radio/radio.component';
import { ReadonlyFieldComponent } from '../../../../../shared/ui/readonly-field/readonly-field.component';
import { SnackbarVariant } from '../../../../../shared/ui/snackbar/snackbar.component';
import { TextAreaControlComponent } from '../../../../../shared/ui/text-area-control/text-area-control.component';
import { TextFieldComponent } from '../../../../../shared/ui/text-field/text-field.component';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { crearSnapshotFormulario, hayCambiosRespectoAlSnapshot } from '../../../../../shared/utils/form-snapshot.util';
import { MIN_CARACTERES_TEXTO_LIBRE, cumpleMinimoTextoLibre } from '../../../../../shared/utils/texto-libre.util';
import { AutorizacionesApiService } from '../../api/autorizaciones-api.service';
import { PROCESS_ID, PROCESS_ROUTE, REQUEST_SEGMENT } from '../../config/autorizaciones.rutas';
import {
  AutorizacionDatos,
  AutorizacionRegistro,
  CODIGO_DOCUMENTO,
  MAX_MOTIVO,
  NOMBRE_DOCUMENTO,
  PERMISO_AUTORIZAR,
  PROCEDIMIENTOS,
  RESPONSABLES,
  TIPOS_MODIFICACION,
  TipoAccionAutorizacion,
  cuentaDeAutorizacion,
  errorVigencia,
  etiquetaTipoAccion,
  fechaCorta,
  nombreEntidadDeCuenta,
  nombreProcedimiento,
  responsablePorUsuario,
} from '../../models/autorizacion.model';
import { CUENTAS_BANCARIAS } from '../../../saldos-iniciales/models/saldo-inicial.model';

interface Formulario {
  procedimiento: string;
  responsable: string;
  cuentaBancaria: string;
  /** Vigencia: en la creación siempre «si»; en la modificación «no» deja el registro Inactivo. */
  vigente: 'si' | 'no';
  fechaDesde: string;
  fechaHasta: string;
  registroId: string;
  tipoModificacion: string;
}

const FORMULARIO_VACIO: Formulario = {
  procedimiento: '', responsable: '', cuentaBancaria: '', vigente: 'si', fechaDesde: '', fechaHasta: '', registroId: '', tipoModificacion: '',
};

type Panel = 'responsable' | 'cuenta' | 'registro';
type Fila = Record<string, string>;
type Campo = { caption: string; value: string };

const COLUMNAS: Record<Panel, SelectionColumn<Fila>[]> = {
  responsable: [
    { key: 'usuario', label: 'Usuario', widthClass: 'w-[110px]' },
    { key: 'dni', label: 'N° documento', widthClass: 'w-[120px]' },
    { key: 'nombres', label: 'Nombres y apellidos' },
  ],
  cuenta: [
    { key: 'numero', label: 'N° cuenta', widthClass: 'w-[200px]', cellClass: 'font-mono' },
    { key: 'denominacion', label: 'Denominación' },
    { key: 'moneda', label: 'Moneda', widthClass: 'w-[90px]' },
  ],
  registro: [
    { key: 'procedimiento', label: 'Procedimiento' },
    { key: 'responsable', label: 'Responsable', widthClass: 'w-[200px]' },
    { key: 'cuenta', label: 'N° cuenta', widthClass: 'w-[190px]', cellClass: 'font-mono' },
    { key: 'estado', label: 'Estado', widthClass: 'w-[90px]' },
  ],
};

const TITULOS: Record<Panel, string> = {
  responsable: 'Buscar responsable',
  cuenta: 'Buscar cuenta bancaria',
  registro: 'Buscar autorización',
};

/**
 * «Registro de autorización excepcional» (RAUT, Figma 24415:135078 creación y 24415:158502 modificación).
 *
 * Solo el perfil con `authorization.create` (creador autorizador) crea el documento: Grabar lo deja ELABORADO
 * (editable y eliminable) y Autorizar lo pasa directo a APROBADO, que crea o modifica el registro. Sin sustento,
 * sin verificación ni aprobador. Los demás perfiles solo consultan.
 * - Creación: procedimiento, responsable y cuenta (paneles de búsqueda), motivo y vigencia (SÍ fija, desde / hasta).
 * - Modificación: tipo «Vigencia»; se elige la autorización registrada y se fija la vigencia: SÍ → Activo con fechas
 *   nuevas; NO → Inactivo.
 */
@Component({
  selector: 'siaf-autorizacion-request',
  standalone: true,
  imports: [
    ActionTrackerComponent,
    AlertComponent,
    ButtonComponent,
    DateTimePickerComponent,
    DetailHistoryTabsComponent,
    DocumentSummaryCardComponent,
    EmptySectionComponent,
    IconComponent,
    RadioComponent,
    ReadonlyFieldComponent,
    RequestApprovalModalsComponent,
    SelectionSideNavComponent,
    SolicitudeFormCardComponent,
    SolicitudeInfoCardComponent,
    SolicitudePageLayoutComponent,
    TextAreaControlComponent,
    TextFieldComponent,
  ],
  templateUrl: './autorizacion-request.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutorizacionRequestComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly currentUser = inject(CurrentUserService);
  private readonly permissions = inject(PermissionService);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly solicitudesApi = inject(SolicitudesApiService);
  private readonly solicitudesFacade = inject(SolicitudesFacadeService);
  private readonly api = inject(AutorizacionesApiService);

  readonly heading = NOMBRE_DOCUMENTO;
  readonly breadcrumbs: BreadcrumbItem[] = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE, 'Configuración de autorización');
  readonly minCaracteresTexto = MIN_CARACTERES_TEXTO_LIBRE;
  readonly maxMotivo = MAX_MOTIVO;
  readonly procedimientos = PROCEDIMIENTOS;
  readonly tiposModificacion = TIPOS_MODIFICACION;
  readonly opcionesVigencia = [
    { label: 'Sí', value: 'si' },
    { label: 'No', value: 'no' },
  ];

  private solicitudId: string | null = null;
  private tiposDocumento: TipoDocumentoResponse[] = [];

  // ── Estado del documento ──────────────────────────────────────────
  private readonly solicitud = signal<SolicitudResponse | null>(null);
  readonly tipoAccion = signal<TipoAccionAutorizacion>('creacion');
  readonly esModificacion = computed(() => this.tipoAccion() === 'modificacion');
  readonly etiquetaAccion = computed(() => etiquetaTipoAccion(this.tipoAccion()));
  readonly estado = computed(() => (this.solicitud()?.estado ?? 'NUEVO').toUpperCase());
  readonly editando = signal(false);
  readonly cargando = signal(false);
  readonly saving = signal(false);

  /** Solo el creador autorizador graba, autoriza, edita o elimina. */
  readonly puedeAutorizar = computed(() => this.permissions.can(PERMISO_AUTORIZAR));
  readonly elaborado = computed(() => this.estado() !== 'NUEVO');
  readonly soloLectura = computed(() => !this.puedeAutorizar() || (this.elaborado() && !this.editando()));
  readonly numeroDocumento = computed(() => this.solicitud()?.numero ?? '');
  /** Botones del header: Cancelar / Grabar / Autorizar al editar; Eliminar / Editar / Autorizar en un ELABORADO. */
  readonly modoAcciones = computed<'edicion' | 'elaborado' | 'ninguna'>(() => {
    if (!this.puedeAutorizar() || this.cargando()) return 'ninguna';
    if (this.estado() === 'NUEVO' || this.editando()) return 'edicion';
    return this.estado() === 'ELABORADO' ? 'elaborado' : 'ninguna';
  });

  readonly headerState = computed<SolicitudeHeaderState>(() => {
    if (this.editando()) return 'edit';
    switch (this.estado()) {
      case 'APROBADO': return 'approved';
      case 'ELIMINADO': return 'deleted';
      case 'ELABORADO': return 'elaborated';
      default: return 'new';
    }
  });

  readonly estadoDocumento = computed<FlowStatus>(() => {
    const etiquetas: Record<string, FlowStatus> = { APROBADO: ESTADO.APROBADO, ELIMINADO: ESTADO.ELIMINADO };
    return etiquetas[this.estado()] ?? ESTADO.ELABORADO;
  });

  readonly camposEntidad = computed<SolicitudeInfoField[]>(() => {
    const usuario = this.currentUser.user();
    return [
      { label: 'Fecha', value: '' },
      { label: 'Ente rector', value: 'DIRECCIÓN GENERAL DEL TESORO PÚBLICO' },
      { label: 'Entidad', value: (usuario.entidadSiglas ?? usuario.office).toUpperCase() },
    ];
  });

  // ── Formulario ────────────────────────────────────────────────────
  readonly form = signal<Formulario>({ ...FORMULARIO_VACIO });
  readonly motivo = signal('');
  readonly registros = signal<AutorizacionRegistro[]>([]);
  readonly procedimientoNombre = computed(() => nombreProcedimiento(this.form().procedimiento));
  readonly registroElegido = computed(() => this.registros().find((r) => r.id === this.form().registroId) ?? null);

  readonly camposResponsable = computed<Campo[]>(() => {
    const r = responsablePorUsuario(this.form().responsable);
    return r ? [
      { caption: 'Usuario', value: r.usuario },
      { caption: 'N° documento', value: r.dni },
      { caption: 'Nombres y apellidos', value: r.nombres },
    ] : [];
  });

  readonly camposCuenta = computed<Campo[]>(() => {
    const numero = this.form().cuentaBancaria;
    const c = cuentaDeAutorizacion(numero);
    return c ? [
      { caption: 'N° cuenta', value: c.numero },
      { caption: 'Denominación', value: c.denominacion },
      { caption: 'Moneda', value: c.moneda },
      { caption: 'Entidad financiera', value: nombreEntidadDeCuenta(numero) || '--' },
    ] : [];
  });

  /** Modificación: la autorización elegida, tal como está registrada. */
  readonly camposRegistro = computed<Campo[]>(() => {
    const r = this.registroElegido();
    if (!r) return [];
    const responsable = responsablePorUsuario(r.responsable);
    return [
      { caption: 'Procedimiento', value: nombreProcedimiento(r.procedimiento) },
      { caption: 'Responsable', value: `${r.responsable} · ${responsable?.nombres ?? ''}` },
      { caption: 'N° cuenta', value: r.cuentaBancaria },
      { caption: 'Estado actual', value: r.estado },
      { caption: 'Vigencia actual', value: r.estado === 'Activo' ? `${fechaCorta(r.fechaDesde)} – ${fechaCorta(r.fechaHasta)}` : '--' },
    ];
  });

  /** Vigencia registrada en el documento, en solo lectura. */
  readonly camposVigencia = computed<Campo[]>(() => {
    const f = this.form();
    const si = f.vigente === 'si';
    return [
      { caption: 'Vigente', value: si ? 'Sí' : 'No' },
      { caption: 'Fecha desde', value: si ? fechaCorta(f.fechaDesde) : '--' },
      { caption: 'Fecha hasta', value: si ? fechaCorta(f.fechaHasta) : '--' },
    ];
  });

  readonly errorFechas = computed(() => {
    const f = this.form();
    if (f.vigente === 'no' || !f.fechaDesde || !f.fechaHasta) return '';
    return errorVigencia(f.fechaDesde, f.fechaHasta) ?? '';
  });

  private readonly formularioCompleto = computed(() => {
    const f = this.form();
    const vigenciaOk = f.vigente === 'no' || !errorVigencia(f.fechaDesde, f.fechaHasta);
    if (this.esModificacion()) return !!f.tipoModificacion && !!this.registroElegido() && vigenciaOk;
    return !!f.procedimiento && !!f.responsable && !!f.cuentaBancaria && vigenciaOk;
  });

  private readonly fotoEdicion = signal<string | null>(null);
  private readonly fotoActual = computed(() => crearSnapshotFormulario({ form: this.form(), motivo: this.motivo().trim() }));
  private readonly hayCambios = computed(() => hayCambiosRespectoAlSnapshot(this.fotoEdicion(), this.fotoActual()));
  private readonly datosValidos = computed(() => this.formularioCompleto() && cumpleMinimoTextoLibre(this.motivo()));

  /** Grabar: solo con cambios. Autorizar: con datos válidos (en un ELABORADO sin editar, siempre). */
  readonly grabarDeshabilitado = computed(() => this.saving() || !this.datosValidos() || !this.hayCambios());
  readonly autorizarDeshabilitado = computed(() => this.saving() || (this.modoAcciones() === 'edicion' && !this.datosValidos()));

  // ── Paneles de búsqueda ───────────────────────────────────────────
  readonly panel = signal<Panel | null>(null);
  readonly busqueda = signal('');
  readonly seleccionTemporal = signal<string | null>(null);
  readonly tituloPanel = computed(() => (this.panel() ? TITULOS[this.panel()!] : ''));
  readonly columnasPanel = computed(() => (this.panel() ? COLUMNAS[this.panel()!] : []));
  readonly idKeyPanel = computed(() => ({ responsable: 'usuario', cuenta: 'numero', registro: 'id' })[this.panel() ?? 'registro']);

  readonly filasPanel = computed<Fila[]>(() => {
    const filas: Fila[] = this.panel() === 'responsable'
      ? RESPONSABLES.map((r) => ({ ...r }))
      : this.panel() === 'cuenta'
        ? CUENTAS_BANCARIAS.map((c) => ({ numero: c.numero, denominacion: c.denominacion, moneda: c.moneda }))
        : this.registros().map((r) => ({
          id: r.id,
          procedimiento: nombreProcedimiento(r.procedimiento),
          responsable: responsablePorUsuario(r.responsable)?.nombres ?? r.responsable,
          cuenta: r.cuentaBancaria,
          estado: r.estado,
        }));
    const texto = this.busqueda().trim().toLowerCase();
    return texto ? filas.filter((f) => Object.values(f).some((v) => v.toLowerCase().includes(texto))) : filas;
  });

  // ── Historial y trazabilidad ──────────────────────────────────────
  private readonly fuentesHistorial = computed<HistorialSource[]>(() =>
    (this.solicitud()?.historialEstados ?? []).map((h) => ({
      estadoBackend: h.estadoNuevo,
      fechaISO: h.createdAt,
      comentario: h.comentario,
      usuario: h.creador ? `${h.creador.nombres} ${h.creador.apellidoPaterno} ${h.creador.apellidoMaterno}` : '',
      rol: h.perfil?.cfgPerfil?.rol?.nombre ?? '',
    })),
  );
  readonly historial = computed(() => buildHistoryEntries(this.fuentesHistorial()));

  readonly trazabilidad = computed<ActionTrackerSummary[]>(() => {
    const historial = this.solicitud()?.historialEstados ?? [];
    const quien = (estado: string, label: string): ActionTrackerSummary => {
      const h = [...historial].reverse().find((x) => x.estadoNuevo === estado);
      const nombre = h?.creador ? `${h.creador.nombres} ${h.creador.apellidoPaterno} ${h.creador.apellidoMaterno}` : '';
      return { label, actionBy: nombre.toUpperCase(), date: h ? new Date(h.createdAt).toLocaleString('es-PE') : '' };
    };
    return [quien('ELABORADO', 'Elaborado por'), quien('APROBADO', 'Autorizado por')];
  });

  // ── Modales y avisos ──────────────────────────────────────────────
  readonly modalGrabar = signal(false);
  readonly modalEliminar = signal(false);
  readonly modalAutorizar = signal(false);
  readonly comentario = signal('');
  readonly avisoAbierto = signal(false);
  readonly aviso = signal<SnackbarVariant>('creation-elaborated');

  ngOnInit(): void {
    this.catalogosApi.listarTiposDocumento().subscribe((tipos) => (this.tiposDocumento = tipos));
    this.api.listarRegistros().subscribe((registros) => this.registros.set(registros));
    if (this.route.snapshot.queryParamMap.get('actionType') === 'modificacion') {
      this.tipoAccion.set('modificacion');
      this.actualizar('tipoModificacion', 'vigencia');
    }
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.cargar(id);

    const estadoNavegacion = history.state as { fromSave?: boolean; fromAuthorize?: boolean } | null;
    if (estadoNavegacion?.fromAuthorize) this.mostrarAviso('creation-approved');
    else if (estadoNavegacion?.fromSave) this.mostrarAviso('creation-elaborated');
  }

  actualizar<K extends keyof Formulario>(campo: K, valor: Formulario[K]): void {
    this.form.update((f) => ({ ...f, [campo]: valor }));
  }

  /** Vigencia NO (solo en modificación): el registro queda Inactivo y no lleva fechas. */
  cambiarVigencia(valor: string): void {
    this.form.update((f) => (valor === 'no' ? { ...f, vigente: 'no', fechaDesde: '', fechaHasta: '' } : { ...f, vigente: 'si' }));
  }

  // ── Paneles ───────────────────────────────────────────────────────
  abrirPanel(panel: Panel): void {
    const f = this.form();
    this.busqueda.set('');
    this.seleccionTemporal.set((panel === 'responsable' ? f.responsable : panel === 'cuenta' ? f.cuentaBancaria : f.registroId) || null);
    this.panel.set(panel);
  }

  cerrarPanel(): void {
    this.panel.set(null);
  }

  aceptarPanel(ids: string[]): void {
    const id = ids[0] ?? this.seleccionTemporal() ?? '';
    const panel = this.panel();
    if (panel === 'responsable') this.actualizar('responsable', id);
    if (panel === 'cuenta') this.actualizar('cuentaBancaria', id);
    if (panel === 'registro') this.elegirRegistro(id);
    this.panel.set(null);
  }

  /** Modificación: al elegir la autorización, la vigencia parte de la registrada. */
  private elegirRegistro(id: string): void {
    const r = this.registros().find((x) => x.id === id);
    if (!r) return;
    this.form.update((f) => ({
      ...f,
      registroId: r.id,
      procedimiento: r.procedimiento,
      responsable: r.responsable,
      cuentaBancaria: r.cuentaBancaria,
      vigente: 'si',
      fechaDesde: r.fechaDesde ?? '',
      fechaHasta: r.fechaHasta ?? '',
    }));
  }

  // ── Navegación ────────────────────────────────────────────────────
  regresar(): void {
    if (this.editando()) {
      this.editando.set(false);
      this.restaurarFormulario(this.solicitud());
      return;
    }
    void this.router.navigate([PROCESS_ROUTE]);
  }

  editar(): void {
    this.editando.set(true);
    this.avisoAbierto.set(false);
    this.fotoEdicion.set(this.fotoActual());
  }

  // ── Grabar y autorizar ────────────────────────────────────────────
  onConfirmarGrabar(): void {
    this.modalGrabar.set(false);
    this.guardar('ELABORADO');
  }

  abrirAutorizar(): void {
    this.comentario.set('');
    this.modalAutorizar.set(true);
  }

  onConfirmarAutorizar(): void {
    this.modalAutorizar.set(false);
    // Un ELABORADO sin editar se autoriza tal cual; si se está editando, primero se guarda lo cambiado.
    if (this.solicitudId && !this.editando()) {
      this.accion((id) => this.solicitudesApi.cambiarEstado(id, { estadoNuevo: 'APROBADO' }), 'creation-approved');
      return;
    }
    this.guardar('APROBADO');
  }

  onConfirmarEliminar(): void {
    this.modalEliminar.set(false);
    this.accion((id) => this.solicitudesApi.cambiarEstado(id, { estadoNuevo: 'ELIMINADO' }), 'creation-deleted');
  }

  /** Crea la solicitud si hace falta, guarda la autorización y la pasa a `estadoNuevo`. */
  private guardar(estadoNuevo: EstadoDocumento): void {
    const f = this.form();
    const activo = f.vigente === 'si';
    const datos: AutorizacionDatos = {
      procedimiento: f.procedimiento,
      responsable: f.responsable,
      cuentaBancaria: f.cuentaBancaria,
      estado: activo ? 'Activo' : 'Inactivo',
      fechaDesde: activo ? f.fechaDesde : null,
      fechaHasta: activo ? f.fechaHasta : null,
      registroId: this.esModificacion() ? f.registroId : null,
      tipoModificacion: this.esModificacion() ? 'vigencia' : null,
    };
    const aviso: SnackbarVariant = estadoNuevo === 'APROBADO' ? 'creation-approved' : 'creation-elaborated';
    const guardarYCambiar = (id: string): Observable<unknown> =>
      this.api.guardarDetalle(id, datos).pipe(switchMap(() => this.solicitudesApi.cambiarEstado(id, { estadoNuevo })));

    this.saving.set(true);

    if (this.solicitudId) {
      const id = this.solicitudId;
      this.solicitudesApi.actualizar(id, { justificacion: this.motivo(), organoLinea: this.organo() })
        .pipe(switchMap(() => guardarYCambiar(id)))
        .subscribe({
          next: () => { this.editando.set(false); this.mostrarAviso(aviso); this.cargar(id); },
          error: () => this.cargar(id),
        });
      return;
    }

    const tipo = this.tiposDocumento.find((t) => t.codigo === CODIGO_DOCUMENTO);
    if (!tipo) { this.saving.set(false); return; }
    this.solicitudesFacade.crearSolicitud({
      tipoDocumentoId: tipo.id,
      tipoAccion: this.tipoAccion(),
      fechaRequerimiento: new Date().toISOString(),
      organoLinea: this.organo(),
      justificacion: this.motivo(),
      cuentas: [],
    }).pipe(
      switchMap((creada) => { this.solicitudId = creada.id; return guardarYCambiar(creada.id).pipe(map(() => creada.id)); }),
    ).subscribe({
      next: (id) => {
        this.saving.set(false);
        const estado = estadoNuevo === 'APROBADO' ? { fromAuthorize: true } : { fromSave: true };
        void this.router.navigate([PROCESS_ROUTE, REQUEST_SEGMENT, id], { state: estado });
      },
      error: () => {
        this.saving.set(false);
        if (this.solicitudId) void this.router.navigate([PROCESS_ROUTE, REQUEST_SEGMENT, this.solicitudId]);
      },
    });
  }

  private accion(llamada: (id: string) => Observable<unknown>, aviso: SnackbarVariant): void {
    const id = this.solicitudId;
    if (!id) return;
    this.saving.set(true);
    llamada(id).subscribe({
      next: () => { this.mostrarAviso(aviso); this.cargar(id); },
      error: () => this.saving.set(false),
    });
  }

  private mostrarAviso(variante: SnackbarVariant): void {
    this.aviso.set(variante);
    this.avisoAbierto.set(true);
  }

  private organo(): string {
    return (this.currentUser.user().unidad ?? this.currentUser.office ?? '').toUpperCase();
  }

  // ── Carga ─────────────────────────────────────────────────────────
  private cargar(id: string): void {
    this.cargando.set(true);
    this.solicitudesApi.obtenerDetalle(id).subscribe({
      next: (s) => {
        this.solicitudId = s.id;
        this.solicitud.set(s);
        this.tipoAccion.set(s.tipoAccion === 'modificacion' ? 'modificacion' : 'creacion');
        this.editando.set(false);
        this.fotoEdicion.set(null);
        this.restaurarFormulario(s);
        this.api.listarRegistros().subscribe((registros) => this.registros.set(registros));
        this.cargando.set(false);
        this.saving.set(false);
      },
      error: () => { this.cargando.set(false); this.saving.set(false); },
    });
  }

  private restaurarFormulario(s: SolicitudResponse | null): void {
    const d = s?.detalleAutorizacion;
    this.form.set(d ? {
      procedimiento: d.procedimiento,
      responsable: d.responsable,
      cuentaBancaria: d.cuentaBancaria,
      vigente: d.estado === 'Inactivo' ? 'no' : 'si',
      fechaDesde: d.fechaDesde ?? '',
      fechaHasta: d.fechaHasta ?? '',
      registroId: d.registroId ?? '',
      tipoModificacion: d.tipoModificacion ?? (s?.tipoAccion === 'modificacion' ? 'vigencia' : ''),
    } : { ...FORMULARIO_VACIO, tipoModificacion: this.esModificacion() ? 'vigencia' : '' });
    this.motivo.set((s?.asuntoMotivo ?? '').replace(/^\[[^\]]*\]\s*/, ''));
  }
}
