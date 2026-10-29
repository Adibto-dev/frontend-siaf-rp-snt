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
import { MessageBoxComponent } from '../../../../../shared/ui/message-box/message-box.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { FlowStatus } from '../../../../../shared/ui/flow-status-tag/flow-status-tag.component';
import { RadioComponent } from '../../../../../shared/ui/radio/radio.component';
import { ReadonlyFieldComponent } from '../../../../../shared/ui/readonly-field/readonly-field.component';
import { SummaryCardComponent, SummaryCardField } from '../../../../../shared/ui/summary-card/summary-card.component';
import { TooltipDirective } from '../../../../../shared/ui/tooltip/tooltip.directive';
import { SnackbarVariant } from '../../../../../shared/ui/snackbar/snackbar.component';
import { TextAreaControlComponent } from '../../../../../shared/ui/text-area-control/text-area-control.component';
import { TextFieldComponent } from '../../../../../shared/ui/text-field/text-field.component';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { crearSnapshotFormulario, hayCambiosRespectoAlSnapshot } from '../../../../../shared/utils/form-snapshot.util';
import { MIN_CARACTERES_TEXTO_LIBRE, cumpleMinimoTextoLibre } from '../../../../../shared/utils/texto-libre.util';
import { SaldosInicialesApiService } from '../../../saldos-iniciales/api/saldos-iniciales-api.service';
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
  documentoResponsable,
  errorAmpliacion,
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

/** El procedimiento viene preseleccionado: por ahora hay uno solo. */
const FORMULARIO_VACIO: Formulario = {
  procedimiento: PROCEDIMIENTOS[0].value, responsable: '', cuentaBancaria: '', vigente: 'si', fechaDesde: '', fechaHasta: '', registroId: '', tipoModificacion: '',
};

type Panel = 'responsable' | 'cuenta' | 'registro';
type Fila = Record<string, string>;
type Campo = { caption: string; value: string };

export const AYUDA_RESPONSABLE = 'Los datos del responsable se obtienen del Gestor de identidades.';

const COLUMNAS: Record<Panel, SelectionColumn<Fila>[]> = {
  // Figma 24415:156428: usuario, documento (tipo y número), nombres y correo institucional.
  responsable: [
    { key: 'usuario', label: 'Usuario', widthClass: 'w-[100px]' },
    { key: 'tipoDocumento', label: 'Tipo de documento', widthClass: 'w-[110px]' },
    { key: 'dni', label: 'N° documento', widthClass: 'w-[130px]' },
    { key: 'nombres', label: 'Nombres y apellidos' },
    { key: 'correo', label: 'Correo institucional', widthClass: 'w-[200px]' },
  ],
  cuenta: [
    // Figma 24415:138420: número, denominación, moneda y entidad financiera.
    { key: 'numero', label: 'Número de cuenta', widthClass: 'w-[200px]', cellClass: 'font-mono' },
    { key: 'denominacion', label: 'Denominación' },
    { key: 'moneda', label: 'Moneda', widthClass: 'w-[90px]' },
    { key: 'entidad', label: 'Entidad financiera', widthClass: 'w-[260px]' },
  ],
  // Figma 27100:46397: procedimiento, responsable (usuario y nombres) y cuenta bancaria.
  registro: [
    { key: 'procedimiento', label: 'Procedimiento', widthClass: 'w-[260px]' },
    { key: 'usuario', label: 'Usuario', widthClass: 'w-[100px]' },
    { key: 'nombres', label: 'Nombres y apellidos', widthClass: 'w-[200px]' },
    { key: 'cuenta', label: 'Número de cuenta', widthClass: 'w-[190px]', cellClass: 'font-mono' },
    { key: 'denominacion', label: 'Denominación', widthClass: 'w-[180px]' },
    { key: 'moneda', label: 'Moneda', widthClass: 'w-[80px]' },
    { key: 'entidad', label: 'Entidad', widthClass: 'w-[220px]' },
  ],
};

const TITULOS: Record<Panel, string> = {
  responsable: 'Seleccionar responsable del Gestor de identidades',
  cuenta: 'Seleccionar cuenta bancaria',
  registro: 'Seleccionar autorización',
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
    MessageBoxComponent,
    IconComponent,
    RadioComponent,
    ReadonlyFieldComponent,
    RequestApprovalModalsComponent,
    SelectionSideNavComponent,
    SolicitudeFormCardComponent,
    SolicitudeInfoCardComponent,
    SolicitudePageLayoutComponent,
    SummaryCardComponent,
    TextAreaControlComponent,
    TextFieldComponent,
    TooltipDirective,
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
  private readonly saldosApi = inject(SaldosInicialesApiService);
  /** Cuentas con saldo inicial registrado: solo esas se pueden autorizar para ajuste. */
  private readonly cuentasConSaldo = signal<Set<string>>(new Set());

  readonly heading = NOMBRE_DOCUMENTO;
  readonly breadcrumbs: BreadcrumbItem[] = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE, 'Configuración de autorización');
  readonly minCaracteresTexto = MIN_CARACTERES_TEXTO_LIBRE;
  readonly maxMotivo = MAX_MOTIVO;
  readonly ayudaResponsable = AYUDA_RESPONSABLE;
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
  /** Procedimiento, responsable, cuenta y motivo solo se editan en la creación; la modificación solo cambia la vigencia. */
  readonly editaDatos = computed(() => !this.soloLectura() && !this.esModificacion());
  readonly numeroDocumento = computed(() => this.solicitud()?.numero ?? '');
  /**
   * Botones del header (todo lo hace el creador autorizador, sin aprobador):
   * - Nuevo / edición: Cancelar, Grabar (→ ELABORADO con número) y Autorizar.
   * - ELABORADO: Eliminar, Editar y Autorizar.
   * Autorizar elabora, el sistema verifica y queda APROBADO en un solo paso (crea o modifica el registro).
   */
  readonly modoAcciones = computed<'edicion' | 'elaborado' | 'ninguna'>(() => {
    if (!this.puedeAutorizar() || this.cargando()) return 'ninguna';
    if (this.estado() === 'NUEVO' || this.editando()) return 'edicion';
    return this.estado() === 'ELABORADO' ? 'elaborado' : 'ninguna';
  });

  readonly headerState = computed<SolicitudeHeaderState>(() => {
    if (this.editando()) return 'edit';
    switch (this.estado()) {
      case 'APROBADO': return 'approved';
      case 'VERIFICADO': return 'verified';
      case 'ELIMINADO': return 'deleted';
      case 'ELABORADO': return 'elaborated';
      default: return 'new';
    }
  });

  readonly estadoDocumento = computed<FlowStatus>(() => {
    const etiquetas: Record<string, FlowStatus> = { APROBADO: ESTADO.APROBADO, VERIFICADO: ESTADO.VERIFICADO, ELIMINADO: ESTADO.ELIMINADO };
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

  /** Card del responsable elegido (Figma 24792:62384). */
  readonly camposResponsable = computed<SummaryCardField[]>(() => {
    const r = responsablePorUsuario(this.form().responsable);
    return r ? [
      { label: 'Usuario', value: r.usuario },
      { label: 'N° Documento', value: documentoResponsable(r) },
      { label: 'Nombres y apellidos', value: r.nombres },
    ] : [];
  });

  /** Card de la cuenta bancaria elegida. */
  readonly camposCuenta = computed<SummaryCardField[]>(() => {
    const numero = this.form().cuentaBancaria;
    const c = cuentaDeAutorizacion(numero);
    return c ? [
      { label: 'Número de cuenta', value: c.numero },
      { label: 'Denominación', value: c.denominacion },
      { label: 'Moneda', value: c.moneda },
      { label: 'Entidad financiera', value: nombreEntidadDeCuenta(numero) || '--' },
    ] : [];
  });

  /** Modificación: card de la autorización elegida; solo el procedimiento (responsable y cuenta van debajo). */
  readonly camposRegistro = computed<SummaryCardField[]>(() => {
    const r = this.registroElegido();
    return r ? [{ label: 'Procedimiento', value: nombreProcedimiento(r.procedimiento) }] : [];
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

  /** Modificación con vigencia SÍ: la fecha hasta debe cambiar respecto de la registrada. */
  private readonly fechaHastaSinCambio = computed(() => {
    const f = this.form();
    const r = this.registroElegido();
    return this.esModificacion() && !this.soloLectura() && f.vigente === 'si' && !!r && f.fechaHasta === (r.fechaHasta ?? '');
  });

  /** Creación: hasta 3 días de vigencia. Modificación: hasta 2 días más que la fecha hasta registrada. */
  private readonly problemaVigencia = computed(() => {
    const f = this.form();
    return this.esModificacion() ? errorAmpliacion(this.registroElegido()?.fechaHasta, f.fechaHasta) : errorVigencia(f.fechaDesde, f.fechaHasta);
  });

  readonly errorFechas = computed(() => {
    const f = this.form();
    if (f.vigente === 'no' || !f.fechaDesde || !f.fechaHasta) return '';
    if (this.fechaHastaSinCambio()) return this.editadoFechaHasta() ? 'Ingrese una fecha hasta distinta a la registrada.' : '';
    return this.problemaVigencia() ?? '';
  });
  /** Para no mostrar el error apenas se elige la autorización (la fecha viene igual a la registrada). */
  private readonly editadoFechaHasta = signal(false);

  private readonly formularioCompleto = computed(() => {
    const f = this.form();
    const vigenciaOk = f.vigente === 'no' || !this.problemaVigencia();
    if (this.esModificacion()) return !!f.tipoModificacion && !!this.registroElegido() && vigenciaOk && !this.fechaHastaSinCambio();
    return !!f.procedimiento && !!f.responsable && !!f.cuentaBancaria && vigenciaOk;
  });

  private readonly fotoEdicion = signal<string | null>(null);
  private readonly fotoActual = computed(() => crearSnapshotFormulario({ form: this.form(), motivo: this.motivo().trim() }));
  private readonly hayCambios = computed(() => hayCambiosRespectoAlSnapshot(this.fotoEdicion(), this.fotoActual()));
  private readonly datosValidos = computed(() => this.formularioCompleto() && cumpleMinimoTextoLibre(this.motivo()));

  /** Grabar: solo con cambios. Autorizar: con datos válidos (en un ELABORADO sin editar, siempre). */
  readonly grabarDeshabilitado = computed(() => this.saving() || !this.datosValidos() || !this.hayCambios());
  /** Autorizar: con datos válidos (en un ELABORADO sin editar, siempre). */
  readonly autorizarDeshabilitado = computed(() => this.saving() || (this.modoAcciones() === 'edicion' && !this.datosValidos()));
  /** Nuevo o en edición: se muestra como formulario (sin ← regresar; se sale con Cancelar). */
  readonly formulario = computed(() => this.estado() === 'NUEVO' || this.editando());

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
        ? CUENTAS_BANCARIAS.filter((c) => this.cuentasConSaldo().has(c.numero)).map((c) => ({ numero: c.numero, denominacion: c.denominacion, moneda: c.moneda, entidad: nombreEntidadDeCuenta(c.numero) || '--' }))
        // Solo las autorizaciones activas: una inactiva ya fue dada de baja.
        : this.registros().filter((r) => r.estado === 'Activo').map((r) => ({
          id: r.id,
          procedimiento: nombreProcedimiento(r.procedimiento),
          usuario: r.responsable,
          nombres: responsablePorUsuario(r.responsable)?.nombres ?? '--',
          cuenta: r.cuentaBancaria,
          denominacion: cuentaDeAutorizacion(r.cuentaBancaria)?.denominacion ?? '--',
          moneda: cuentaDeAutorizacion(r.cuentaBancaria)?.moneda ?? '--',
          entidad: nombreEntidadDeCuenta(r.cuentaBancaria) || '--',
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
    return [quien('ELABORADO', 'Elaborado por'), quien('VERIFICADO', 'Verificado por'), quien('APROBADO', 'Aprobado por')];
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
    this.saldosApi.listarRegistros().subscribe((saldos) =>
      this.cuentasConSaldo.set(new Set(saldos.filter((r) => r.estado === 'Activo').map((r) => r.cuentaBancaria))),
    );
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
  /** Vigencia NO (solo en modificación): la fecha hasta vuelve a la registrada y se bloquea; al aprobar queda Inactivo. */
  cambiarVigencia(valor: string): void {
    const r = this.registroElegido();
    this.form.update((f) => (valor === 'no'
      ? { ...f, vigente: 'no', fechaDesde: r?.fechaDesde ?? f.fechaDesde, fechaHasta: r?.fechaHasta ?? f.fechaHasta }
      : { ...f, vigente: 'si' }));
  }

  cambiarFechaHasta(valor: string): void {
    this.editadoFechaHasta.set(true);
    this.actualizar('fechaHasta', valor);
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

  /** Modificación: al elegir la autorización se traen sus datos y la justificación de la creación; solo cambia la vigencia. */
  private elegirRegistro(id: string): void {
    const r = this.registros().find((x) => x.id === id);
    if (!r) return;
    this.editadoFechaHasta.set(false);
    this.motivo.set(r.motivo ?? '');
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

  /** ✕ de la card: quita la selección. */
  quitar(panel: Panel): void {
    if (panel === 'responsable') this.actualizar('responsable', '');
    if (panel === 'cuenta') this.actualizar('cuentaBancaria', '');
    if (panel === 'registro') {
      this.form.update((f) => ({ ...FORMULARIO_VACIO, tipoModificacion: f.tipoModificacion }));
      this.motivo.set('');
    }
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

  /**
   * Autorizar: desde NUEVO (sin grabar) o al editar, guarda y aprueba; desde un ELABORADO sin cambios, aprueba. El
   * backend deja elaborado, verificado (sistema) y aprobado, y crea o modifica el registro.
   */
  onConfirmarAutorizar(): void {
    this.modalAutorizar.set(false);
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
        void this.router.navigate([PROCESS_ROUTE, REQUEST_SEGMENT, id], { state: estadoNuevo === 'APROBADO' ? { fromAuthorize: true } : { fromSave: true } });
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
