import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { CatalogosApiService, TipoDocumentoResponse } from '../../../../../core/api/catalogos-api.service';
import { SolicitudResponse, SolicitudesApiService } from '../../../../../core/api/solicitudes-api.service';
import { CurrentUserService } from '../../../../../core/auth/current-user.service';
import { PermissionService } from '../../../../../core/auth/permission.service';
import { ESTADO, MOTIVOS_RECHAZO } from '../../../../../core/models/documento.model';
import { ConSalidaProtegida, SalidaProtegida } from '../../../../../core/state/salida-protegida';
import { SolicitudesFacadeService } from '../../../../../core/state/solicitudes-facade.service';
import { BreadcrumbItem } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { DetailHistoryTabsComponent } from '../../../../../shared/components/detail-history-tabs/detail-history-tabs.component';
import { HistorialSource, buildCurrentComment, buildHistoryEntries } from '../../../../../shared/components/detail-history-tabs/detail-history-tabs.utils';
import { RequestApprovalModalsComponent } from '../../../../../shared/components/request-approval-modals/request-approval-modals.component';
import { SelectionColumn, SelectionSideNavComponent } from '../../../../../shared/components/selection-side-nav/selection-side-nav.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { SolicitudeHeaderState } from '../../../../../shared/components/solicitude-header/solicitude-header.component';
import { SolicitudeInfoCardComponent, SolicitudeInfoField } from '../../../../../shared/components/solicitude-info-card/solicitude-info-card.component';
import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { ActionTrackerComponent, ActionTrackerSummary } from '../../../../../shared/ui/action-tracker/action-tracker.component';
import { AlertComponent } from '../../../../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { CollapsibleCardComponent } from '../../../../../shared/ui/collapsible-card/collapsible-card.component';
import { DocumentSummaryCardComponent } from '../../../../../shared/ui/document-summary-card/document-summary-card.component';
import { EmptySectionComponent } from '../../../../../shared/ui/empty-section/empty-section.component';
import { FlowStatus } from '../../../../../shared/ui/flow-status-tag/flow-status-tag.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { MessageBoxComponent } from '../../../../../shared/ui/message-box/message-box.component';
import { ModalComponent } from '../../../../../shared/ui/modal/modal.component';
import { SidePanelComponent } from '../../../../../shared/ui/side-panel/side-panel.component';
import { SnackbarVariant } from '../../../../../shared/ui/snackbar/snackbar.component';
import { SummaryCardComponent, type SummaryCardField } from '../../../../../shared/ui/summary-card/summary-card.component';
import { TextAreaControlComponent } from '../../../../../shared/ui/text-area-control/text-area-control.component';
import { TextFieldComponent, TextFieldOption } from '../../../../../shared/ui/text-field/text-field.component';
import { TooltipDirective } from '../../../../../shared/ui/tooltip/tooltip.directive';
import { ABREVIATURAS } from '../../../../../shared/utils/abreviaturas.util';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { fechaElaboracion } from '../../../../../shared/utils/fecha.util';
import { crearSnapshotFormulario, hayCambiosRespectoAlSnapshot } from '../../../../../shared/utils/form-snapshot.util';
import { MIN_CARACTERES_TEXTO_LIBRE, cumpleMinimoTextoLibre } from '../../../../../shared/utils/texto-libre.util';
import { CUENTAS_BANCARIAS, CUENTA_DEMOSTRACION, cuentaPorNumero, entidadPorCodigo, formatoImporte, redondear } from '../../../saldos-iniciales/models/saldo-inicial.model';
import { TrasladosApiService } from '../../../traspasos-cuentas-registros/api/traslados-api.service';
import { AsignacionTraslado, ErrorTraslado, LibretaSaldo } from '../../../traspasos-cuentas-registros/models/traslado.model';
import { AsignacionesApiService } from '../../api/asignaciones-api.service';
import { AsignacionCargaMasivaComponent } from '../../components/asignacion-carga-masiva.component';
import { PROCESS_ID, PROCESS_ROUTE, REQUEST_SEGMENT } from '../../config/asignacion.rutas';
import {
  AsignacionDatos,
  CODIGO_DOCUMENTO,
  MESES,
  NOMBRE_DOCUMENTO,
  Periodicidad,
  TipoPeriodicidad,
  movimientosAsignacion,
  validarAsignacion,
} from '../../models/asignacion.model';
import type { DestinoCargado } from '../../utils/asignacion-carga-masiva.util';
import { DEPENDIENTES, FILTROS_VACIOS, FiltrosCuenta, clasificacionDe, codigo, cumpleFiltros, opcionesFiltro } from '../../utils/clasificacion-cuentas.util';
import { FILAS_POR_PAGINA } from '../../../../../shared/components/pagination/pagination.component';

const SIMBOLO: Record<string, string> = { PEN: 'S/', USD: 'US$' };
/** Año de trabajo del taller. */
const ANIO_ACTUAL = 2026;

interface FilaCuentaBancaria {
  numero: string;
  denominacion: string;
  moneda: string;
  entidad: string;
}

/**
 * Solicitud de Asignación Financiera (RAFI), Figma 814:27120, 818:30461 y 819:33222.
 *
 * 1. Cuenta bancaria (panel de selección).
 * 2. Asignación financiera: periodicidad (Mensual por defecto; Año fijo en Mensual) y mes de asignación, que se
 *    habilitan al elegir la cuenta; indicadores (beneficiarios, saldo disponible del origen y total a asignar).
 * 3. Una sola cuenta de origen (débito) y sus cuentas de destino (crédito) con el importe a asignar, a mano o por
 *    carga masiva desde Excel. Mismas reglas de saldo que el traslado.
 * 4. Motivo de la asignación (opcional).
 *
 * Flujo manual: Elaborado → Verificado → Aprobado (u Observado / Rechazado). Al aprobar, el saldo se mueve.
 */
/** Mes en curso (1-12), marcado al crear el documento. */
const MES_ACTUAL = new Date().getMonth() + 1;

@Component({
  selector: 'siaf-asignacion-request',
  standalone: true,
  imports: [
    ActionTrackerComponent,
    AlertComponent,
    AsignacionCargaMasivaComponent,
    ButtonComponent,
    CollapsibleCardComponent,
    DetailHistoryTabsComponent,
    DocumentSummaryCardComponent,
    EmptySectionComponent,
    IconComponent,
    MessageBoxComponent,
    ModalComponent,
    RequestApprovalModalsComponent,
    SelectionSideNavComponent,
    SidePanelComponent,
    SolicitudeFormCardComponent,
    SolicitudeInfoCardComponent,
    SolicitudePageLayoutComponent,
    SummaryCardComponent,
    TextAreaControlComponent,
    TextFieldComponent,
    TooltipDirective,
  ],
  templateUrl: './asignacion-request.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AsignacionRequestComponent implements OnInit, ConSalidaProtegida {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly currentUser = inject(CurrentUserService);
  private readonly permissions = inject(PermissionService);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly solicitudesApi = inject(SolicitudesApiService);
  private readonly solicitudesFacade = inject(SolicitudesFacadeService);
  private readonly trasladosApi = inject(TrasladosApiService);
  private readonly asignacionesApi = inject(AsignacionesApiService);

  readonly heading = NOMBRE_DOCUMENTO;
  readonly breadcrumbs: BreadcrumbItem[] = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE, NOMBRE_DOCUMENTO);
  readonly minCaracteresTexto = MIN_CARACTERES_TEXTO_LIBRE;
  readonly abrev = ABREVIATURAS;
  readonly formatoImporte = formatoImporte;

  /** Movimiento interno de la asignación (catálogo fijo por ahora). */
  readonly movimientoInterno: SummaryCardField[] = [
    { label: 'Código', value: 'AF0001' },
    { label: 'Denominación', value: 'ASIGNACIÓN FINANCIERA' },
    { label: 'Naturaleza del movimiento', value: 'CRÉDITO / DÉBITO' },
    { label: 'Sigla', value: 'AF' },
  ];

  readonly opcionesPeriodicidad: TextFieldOption[] = [
    { value: 'mensual', label: 'Mensual' },
    { value: 'semestral', label: 'Semestral' },
    { value: 'anual', label: 'Anual' },
  ];
  /** Tooltip del ícono de información junto a «Periodicidad». */
  readonly ayudaPeriodicidad = 'Mensual: una asignación por mes de recaudación. Semestral: agrupa 6 meses. Anual: agrupa todo el ejercicio fiscal.';
  readonly opcionesMes: TextFieldOption[] = MESES.map((m, i) => ({ label: m, value: String(i + 1) }));
  readonly opcionesAnio: TextFieldOption[] = [ANIO_ACTUAL - 1, ANIO_ACTUAL].map((a) => ({ label: String(a), value: String(a) }));

  private solicitudId: string | null = null;
  private tiposDocumento: TipoDocumentoResponse[] = [];

  // ── Estado del documento ──────────────────────────────────────────
  private readonly solicitud = signal<SolicitudResponse | null>(null);
  readonly estado = computed(() => (this.solicitud()?.estado ?? 'NUEVO').toUpperCase());
  readonly editando = signal(false);
  readonly cargando = signal(false);
  readonly saving = signal(false);

  readonly headerRole = computed<'creator' | 'approver'>(() => (this.permissions.currentRole() === 'approver' ? 'approver' : 'creator'));
  readonly visualizador = computed(() => this.permissions.currentRole() === 'viewer');
  readonly elaborado = computed(() => this.estado() !== 'NUEVO');
  readonly soloLectura = computed(() => this.elaborado() && !this.editando());
  readonly puedeVerificar = computed(() => ['ELABORADO', 'OBSERVADO'].includes(this.estado()));
  readonly numeroDocumento = computed(() => this.solicitud()?.numero ?? '');

  readonly headerState = computed<SolicitudeHeaderState>(() => {
    if (this.editando()) return 'edit';
    switch (this.estado()) {
      case 'APROBADO': return 'approved';
      case 'OBSERVADO': return 'observed';
      case 'RECHAZADO': return 'rejected';
      case 'VERIFICADO': return 'verified';
      case 'ELIMINADO': return 'deleted';
      case 'ELABORADO': return 'elaborated';
      default: return 'new';
    }
  });

  readonly estadoDocumento = computed<FlowStatus>(() => {
    const etiquetas: Record<string, FlowStatus> = {
      APROBADO: ESTADO.APROBADO,
      OBSERVADO: ESTADO.OBSERVADO,
      RECHAZADO: ESTADO.RECHAZADO,
      VERIFICADO: ESTADO.VERIFICADO,
      ELIMINADO: ESTADO.ELIMINADO,
    };
    return etiquetas[this.estado()] ?? ESTADO.ELABORADO;
  });

  readonly camposEntidad = computed<SolicitudeInfoField[]>(() => [
    { label: 'Fecha', value: fechaElaboracion(this.solicitud()?.historialEstados) },
    { label: 'Ente rector', value: 'DIRECCIÓN GENERAL DEL TESORO PÚBLICO' },
  ]);

  // ── Cuenta bancaria ───────────────────────────────────────────────
  readonly cuentaBancaria = signal('');
  readonly cuentaElegida = computed(() => cuentaPorNumero(this.cuentaBancaria()));
  readonly datosCuenta = computed((): SummaryCardField[] => {
    const c = this.cuentaElegida();
    if (!c) return [];
    return [
      { label: 'Número de cuenta', value: c.numero },
      { label: 'Denominación', value: c.denominacion },
      { label: 'Moneda', value: c.moneda },
      { label: 'Entidad', value: entidadPorCodigo(c.entidadCodigo)?.denominacion ?? '--' },
    ];
  });

  readonly panelCuentaAbierto = signal(false);
  readonly busquedaCuenta = signal('');
  readonly cuentaTemporal = signal<string | null>(null);
  readonly columnasCuenta: SelectionColumn<FilaCuentaBancaria>[] = [
    { key: 'numero', label: 'Número de cuenta', widthClass: 'w-[220px]' },
    // Denominación y entidad financiera, los datos largos, con el mismo ancho (como en Autorizaciones).
    { key: 'denominacion', label: 'Denominación', widthClass: 'w-[35%]' },
    { key: 'moneda', label: 'Moneda', widthClass: 'w-[100px]' },
    { key: 'entidad', label: 'Entidad financiera', widthClass: 'w-[35%]' },
  ];
  /**
   * Primero la «MEF - Cuenta Única del Tesoro», la que tiene todas las cuentas de registros de demostración; el resto
   * sigue el orden del catálogo. Se ordena aquí y no en `CUENTAS_BANCARIAS`, porque su posición arma los IDs.
   */
  private readonly filasCuenta: FilaCuentaBancaria[] = [...CUENTAS_BANCARIAS].sort((a, b) => Number(b.numero === CUENTA_DEMOSTRACION) - Number(a.numero === CUENTA_DEMOSTRACION)).map((c) => ({
    numero: c.numero,
    denominacion: c.denominacion,
    moneda: c.moneda,
    entidad: entidadPorCodigo(c.entidadCodigo)?.denominacion ?? '--',
  }));
  readonly cuentasFiltradas = computed(() => filtrar(this.filasCuenta, this.busquedaCuenta()));

  // ── Periodicidad ──────────────────────────────────────────────────
  /** Mensual por defecto (Figma 782:63433). */
  readonly tipoPeriodicidad = signal<TipoPeriodicidad | ''>('mensual');
  /** La periodicidad se elige después de la cuenta bancaria (Figma 814:27120). */
  readonly periodicidadDeshabilitada = computed(() => this.soloLectura() || !this.cuentaElegida());
  readonly anio = signal<number>(ANIO_ACTUAL);
  /** Viene marcado con el mes actual; se puede cambiar. */
  readonly mesAsignacion = signal<number | null>(MES_ACTUAL);
  /** Mensual asigna un mes; Semestral y Anual agrupan varios y se entregan en un mes. */
  readonly etiquetaMes = computed(() => (this.tipoPeriodicidad() === 'mensual' ? 'Mes de asignación' : 'Mes de entrega'));
  readonly periodicidad = computed((): Periodicidad | null => {
    const tipo = this.tipoPeriodicidad();
    if (!tipo) return null;
    return {
      tipo,
      anio: this.anio(),
      ...(this.mesAsignacion() ? { mesAsignacion: this.mesAsignacion()! } : {}),
    };
  });

  // ── Cuentas de registro ───────────────────────────────────────────
  readonly avisoMensaje = signal('');
  /** Nombre del archivo del aviso «se ha descargado» (en negrita). */
  readonly avisoArchivo = signal('');

  /** Carga masiva: la plantilla se descargó y el panel se cerró; el archivo se sube al volver a abrirlo. */
  avisarPlantilla(nombre: string): void {
    this.avisoMensaje.set('');
    this.avisoArchivo.set(nombre);
    this.aviso.set('file-downloaded');
    this.avisoAbierto.set(true);
  }
  readonly libretas = signal<LibretaSaldo[]>([]);
  readonly cargandoLibretas = signal(false);
  private readonly libretaPorId = computed(() => new Map(this.libretas().map((l) => [l.idCorrelativo, l])));

  /** La única cuenta de origen. */
  readonly origen = signal('');
  /** Destinos con su importe (el origen de cada par es siempre `origen`). */
  readonly asignaciones = signal<AsignacionTraslado[]>([]);
  readonly tarjetaAbierta = signal(true);

  readonly columnasLibreta: SelectionColumn<LibretaSaldo>[] = [
    { key: 'idCorrelativo', label: ABREVIATURAS.idCorrelativo.abreviatura, widthClass: 'w-[100px]', group: 'Cuenta de registro' },
    { key: 'numero', label: 'Número', widthClass: 'w-[300px]', group: 'Cuenta de registro' },
    { key: 'descripcion', label: 'Descripción', group: 'Cuenta de registro' },
    { key: 'saldoDisponible', label: ABREVIATURAS.importeCuenta.abreviatura, widthClass: 'w-[170px]', cellClass: 'text-right', group: 'Saldo', render: (l) => formatoImporte(l.saldoDisponible) },
  ];

  /** Destino: primero el Clasificador Institucional del titular (grupo y subgrupo por código, y la entidad). */
  readonly columnasLibretaDestino: SelectionColumn<LibretaSaldo>[] = [
    { key: 'grupo', label: 'Grupo', widthClass: 'w-[80px]', group: 'Clasificador institucional', render: (l) => codigo(clasificacionDe(l.idCorrelativo).grupo) },
    { key: 'subgrupo', label: 'Sub grupo', widthClass: 'w-[100px]', group: 'Clasificador institucional', render: (l) => codigo(clasificacionDe(l.idCorrelativo).subgrupo) },
    { key: 'entidad', label: 'Descripción', widthClass: 'w-[280px]', group: 'Clasificador institucional', render: (l) => clasificacionDe(l.idCorrelativo).entidad },
    ...this.columnasLibreta,
  ];
  /** Clasificador Institucional de una cuenta, para la tabla de destinos. */
  readonly clasificacion = clasificacionDe;
  readonly codigo = codigo;

  readonly panelLibretas = signal<'origen' | 'destino' | null>(null);
  readonly busquedaLibreta = signal('');
  readonly libretasTemporales = signal<string[]>([]);
  private libretasTemporalesIniciales: string[] = [];
  /** Filtros aplicados (Figma 789:67652) y los que se editan en el panel antes de Aplicar. */
  readonly filtrosLibreta = signal<FiltrosCuenta>(FILTROS_VACIOS);
  readonly filtrosEnEdicion = signal<FiltrosCuenta>(FILTROS_VACIOS);
  /** Opciones de cada filtro según las cuentas del panel y lo ya elegido. */
  readonly opcionesFiltros = computed(() => {
    const ids = this.libretas().map((l) => l.idCorrelativo);
    const f = this.filtrosEnEdicion();
    return {
      fuente: opcionesFiltro(ids, f, 'fuente'),
      subfuente: opcionesFiltro(ids, f, 'subfuente'),
      concepto: opcionesFiltro(ids, f, 'concepto'),
      grupo: opcionesFiltro(ids, f, 'grupo'),
      subgrupo: opcionesFiltro(ids, f, 'subgrupo'),
      departamento: opcionesFiltro(ids, f, 'departamento'),
      provincia: opcionesFiltro(ids, f, 'provincia'),
      distrito: opcionesFiltro(ids, f, 'distrito'),
    };
  });
  readonly libretasFiltradas = computed(() => {
    const f = this.filtrosLibreta();
    return filtrar(this.libretas(), this.busquedaLibreta()).filter((l) => cumpleFiltros(l.idCorrelativo, f));
  });
  readonly paginaLibretas = signal(1);
  readonly filasLibretas = signal(FILAS_POR_PAGINA);
  readonly totalPaginasLibretas = computed(() => Math.max(1, Math.ceil(this.libretasFiltradas().length / this.filasLibretas())));
  readonly libretasPagina = computed(() => {
    const desde = (Math.min(this.paginaLibretas(), this.totalPaginasLibretas()) - 1) * this.filasLibretas();
    return this.libretasFiltradas().slice(desde, desde + this.filasLibretas());
  });
  readonly tituloPanelLibretas = computed(() =>
    this.panelLibretas() === 'origen' ? 'Seleccionar cuenta de registro de origen' : 'Seleccionar cuentas de registros de destino',
  );
  /** Una cuenta es origen o destino, no las dos. */
  readonly libretasBloqueadas = computed(() =>
    this.panelLibretas() === 'origen' ? this.asignaciones().map((a) => a.destino) : this.origen() ? [this.origen()] : [],
  );
  readonly cargaMasivaAbierta = signal(false);

  private readonly asignacionesConImporte = computed(() => this.asignaciones().filter((a) => a.importe > 0));
  readonly movimientos = computed(() => movimientosAsignacion(this.origen(), this.asignacionesConImporte()));
  readonly totalAsignar = computed(() => redondear(this.asignaciones().reduce((t, a) => t + a.importe, 0)));

  readonly libretaOrigen = computed(() => this.libretaPorId().get(this.origen()));
  readonly filasDestino = computed(() => {
    const libretas = this.libretaPorId();
    return this.asignaciones().map((a) => ({ id: a.destino, libreta: libretas.get(a.destino), importe: a.importe }));
  });

  /** El total supera el saldo disponible del origen. */
  readonly excedido = computed(() => !!this.origen() && this.totalAsignar() > (this.libretaOrigen()?.saldoDisponible ?? 0));
  readonly alertaSaldo = computed(() =>
    this.excedido() ? `El importe a asignar supera el saldo disponible de la cuenta de origen ${this.origen()}. Corrija los importes marcados.` : '',
  );

  readonly indicadores = computed(() => {
    const moneda = SIMBOLO[this.cuentaElegida()?.moneda ?? 'PEN'] ?? '';
    return [
      { caption: 'Beneficiarios', value: String(this.asignaciones().length), excedido: false },
      { caption: 'Saldo disponible', value: `${moneda} ${formatoImporte(this.libretaOrigen()?.saldoDisponible ?? 0)}`, excedido: false },
      { caption: 'Total a asignar', value: `${moneda} ${formatoImporte(this.totalAsignar())}`, excedido: true },
    ];
  });

  readonly motivo = signal('');
  readonly errores = signal<ErrorTraslado[]>([]);
  readonly panelErroresAbierto = signal(false);

  private readonly datosAsignacion = computed((): AsignacionDatos => ({
    cuentaBancaria: this.cuentaBancaria(),
    periodicidad: this.periodicidad(),
    movimientos: this.movimientos(),
    asignaciones: this.asignacionesConImporte(),
  }));

  private readonly fotoEdicion = signal<string | null>(null);
  private readonly fotoActual = computed(() => crearSnapshotFormulario({ asignacion: this.datosAsignacion(), motivo: this.motivo().trim() }));
  private readonly hayCambios = computed(() => hayCambiosRespectoAlSnapshot(this.fotoEdicion(), this.fotoActual()));
  private fotoNueva = '';
  readonly salida = new SalidaProtegida(
    () => !this.soloLectura(),
    () => !this.soloLectura() && (this.estado() === 'NUEVO' ? this.fotoActual() !== this.fotoNueva : this.hayCambios()),
  );

  /** Para grabar: cuenta, tipo de periodicidad y al menos un destino con importe. El resto, al verificar. */
  private readonly formularioCompleto = computed(
    () =>
      !!this.cuentaElegida() && !!this.tipoPeriodicidad() && this.movimientos().length > 0
      && (!this.motivo().trim() || cumpleMinimoTextoLibre(this.motivo())),
  );

  readonly verificarDeshabilitado = computed(() => {
    if (this.cargando() || this.saving()) return true;
    if (this.editando()) return !this.formularioCompleto();
    return !this.puedeVerificar();
  });

  readonly formValido = computed(() => !this.soloLectura() && this.formularioCompleto() && this.hayCambios());

  // ── Historial y trazabilidad ──────────────────────────────────────
  private readonly fuentesHistorial = computed<HistorialSource[]>(() =>
    (this.solicitud()?.historialEstados ?? []).map((h) => ({
      estadoBackend: h.estadoNuevo,
      fechaISO: h.createdAt,
      comentario: h.comentario,
      usuario: h.creador ? `${h.creador.nombres} ${h.creador.apellidoPaterno} ${h.creador.apellidoMaterno}`.trim() : '',
      rol: h.perfil?.cfgPerfil?.rol?.nombre ?? '',
    })),
  );
  readonly historial = computed(() => buildHistoryEntries(this.fuentesHistorial()));
  readonly comentarioActual = computed(() => buildCurrentComment(this.estado(), this.fuentesHistorial()));

  readonly trazabilidad = computed<ActionTrackerSummary[]>(() => {
    const historial = this.solicitud()?.historialEstados ?? [];
    const ultimo = (estado: string) => [...historial].reverse().find((h) => h.estadoNuevo === estado);
    const quien = (estado: string, label: string): ActionTrackerSummary => {
      const h = ultimo(estado);
      const nombre = h?.creador ? `${h.creador.nombres} ${h.creador.apellidoPaterno} ${h.creador.apellidoMaterno}`.trim() : '';
      return { label, actionBy: nombre.toUpperCase(), date: h ? new Date(h.createdAt).toLocaleString('es-PE') : '' };
    };
    const tercero = this.estado() === 'OBSERVADO'
      ? quien('OBSERVADO', 'Observado por')
      : this.estado() === 'RECHAZADO' ? quien('RECHAZADO', 'Rechazado por') : quien('APROBADO', 'Aprobado por');
    return [quien('ELABORADO', 'Elaborado por'), quien('VERIFICADO', 'Verificado por'), tercero];
  });

  // ── Modales y avisos ──────────────────────────────────────────────
  readonly modalGrabar = signal(false);
  readonly modalVerificar = signal(false);
  readonly modalEliminar = signal(false);
  readonly modalAprobar = signal(false);
  readonly modalObservar = signal(false);
  readonly modalRechazar = signal(false);
  readonly comentario = signal('');
  readonly motivoRechazo = signal('');
  readonly motivosRechazo = [...MOTIVOS_RECHAZO];
  readonly avisoAbierto = signal(false);
  readonly aviso = signal<SnackbarVariant>('creation-elaborated');

  ngOnInit(): void {
    this.catalogosApi.listarTiposDocumento().subscribe((tipos) => (this.tiposDocumento = tipos));
    const id = this.route.snapshot.paramMap.get('id');
    if (id) this.cargar(id);
    else this.fotoNueva = this.fotoActual();

    const estadoNavegacion = history.state as { fromSave?: boolean } | null;
    if (estadoNavegacion?.fromSave) this.mostrarAviso('creation-elaborated');
  }

  // ── Cuenta bancaria ──────────────────────────────────────
  abrirPanelCuenta(): void {
    this.busquedaCuenta.set('');
    this.cuentaTemporal.set(this.cuentaBancaria() || null);
    this.panelCuentaAbierto.set(true);
  }

  aceptarCuenta(ids: string[]): void {
    this.panelCuentaAbierto.set(false);
    this.elegirCuenta(ids[0] ?? '');
  }

  /** Otra cuenta bancaria: se cargan sus cuentas de registro y se descartan origen y destinos. */
  elegirCuenta(numero: string): void {
    if (numero === this.cuentaBancaria()) return;
    this.cuentaBancaria.set(numero);
    this.origen.set('');
    this.asignaciones.set([]);
    this.cargarLibretas(numero);
  }

  // ── Periodicidad ──────────────────────────────────────────────────
  elegirPeriodicidad(evento: string | number | string[]): void {
    const valor = String(Array.isArray(evento) ? evento[0] ?? '' : evento);
    if (valor === this.tipoPeriodicidad()) return;
    // El mes elegido se conserva: solo cambia la etiqueta del campo.
    this.tipoPeriodicidad.set(valor as TipoPeriodicidad);
    // Mensual: el año es el de trabajo (fijo).
    if (valor === 'mensual') this.anio.set(ANIO_ACTUAL);
  }

  numero(valor: string | number | string[]): number | null {
    const n = Number(Array.isArray(valor) ? valor[0] : valor);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  texto(n: number | null): string {
    return n ? String(n) : '';
  }

  // ── Origen y destinos ─────────────────────────────────────────────
  /** Cada panel de cuentas empieza sin búsqueda, sin filtros y en la página 1. */
  private reiniciarPanelLibretas(): void {
    this.busquedaLibreta.set('');
    this.filtrosLibreta.set(FILTROS_VACIOS);
    this.filtrosEnEdicion.set(FILTROS_VACIOS);
    this.paginaLibretas.set(1);
  }

  buscarLibreta(texto: string): void {
    this.busquedaLibreta.set(texto);
    this.paginaLibretas.set(1);
  }

  cambiarFilasLibretas(filas: number): void {
    this.filasLibretas.set(filas);
    this.paginaLibretas.set(1);
  }

  /** Un campo del panel «Filtros»: Fuente, Grupo, Departamento y Provincia limpian lo que depende de ellos. */
  editarFiltro(campo: keyof FiltrosCuenta, evento: string | number | string[]): void {
    const valor = String(Array.isArray(evento) ? evento[0] ?? '' : evento ?? '');
    this.filtrosEnEdicion.update((f) => ({
      ...f,
      [campo]: valor,
      ...Object.fromEntries((DEPENDIENTES[campo] ?? []).map((d) => [d, ''])),
    }));
  }

  aplicarFiltrosLibreta(): void {
    this.filtrosLibreta.set(this.filtrosEnEdicion());
    this.paginaLibretas.set(1);
  }

  /** Limpiar del panel de filtros: vacía todos los campos; se aplican con «Aplicar». */
  limpiarFiltrosLibreta(): void {
    this.filtrosEnEdicion.set(FILTROS_VACIOS);
  }

  abrirPanelOrigen(): void {
    this.reiniciarPanelLibretas();
    this.libretasTemporales.set(this.origen() ? [this.origen()] : []);
    this.panelLibretas.set('origen');
  }

  abrirPanelDestinos(): void {
    this.reiniciarPanelLibretas();
    this.libretasTemporales.set(this.asignaciones().map((a) => a.destino));
    this.libretasTemporalesIniciales = [...this.libretasTemporales()];
    this.panelLibretas.set('destino');
  }

  aceptarLibretas(ids: string[]): void {
    const panel = this.panelLibretas();
    this.panelLibretas.set(null);
    if (panel === 'origen') {
      const nuevo = ids[0] ?? '';
      if (nuevo === this.origen()) return;
      this.origen.set(nuevo);
      this.asignaciones.update((a) => a.map((x) => ({ ...x, origen: nuevo })));
      this.tarjetaAbierta.set(true);
      return;
    }
    const antes = this.libretasTemporalesIniciales;
    const agregadas = ids.filter((id) => !antes.includes(id)).length;
    const quitadas = antes.filter((id) => !ids.includes(id)).length;
    if (agregadas || quitadas) this.avisarLista(quitadas > 0);
    this.asignaciones.update((lista) => [
      ...lista.filter((a) => ids.includes(a.destino)),
      ...ids.filter((id) => !lista.some((a) => a.destino === id)).map((id) => ({ origen: this.origen(), destino: id, importe: 0 })),
    ]);
  }

  /** Carga masiva: los destinos del Excel reemplazan a los actuales. */
  cargarDestinos(destinos: DestinoCargado[]): void {
    this.cargaMasivaAbierta.set(false);
    this.asignaciones.set(destinos.map((d) => ({ origen: this.origen(), destino: d.destino, importe: d.importe })));
    this.tarjetaAbierta.set(true);
    this.avisoMensaje.set(`Se cargaron ${destinos.length} ${destinos.length === 1 ? 'cuenta de destino' : 'cuentas de destino'}.`);
    this.aviso.set('custom');
    this.avisoAbierto.set(true);
  }

  /**
   * Quitar con confirmación (Figma 23997:111454, «¿Borrar item(s)?»): el origen cuando ya hay destinos, que se van con
   * él, y un destino cuando ya tiene importe. Sin nada que perder, se quita directo.
   */
  readonly quitarPendiente = signal<{ tipo: 'origen' } | { tipo: 'destino'; id: string } | null>(null);
  readonly descripcionQuitar = computed(() => {
    const q = this.quitarPendiente();
    if (q?.tipo === 'origen') {
      return `Se quitará la cuenta de origen y con ella ${this.cantidadDestinos(this.asignaciones().length)} con sus importes.`;
    }
    return 'Perderá todos los datos ingresados en los ítem(s) seleccionados.';
  });

  quitarOrigen(): void {
    if (this.asignaciones().length) this.quitarPendiente.set({ tipo: 'origen' });
    else this.origen.set('');
  }

  quitarDestino(destino: string): void {
    const conImporte = this.asignaciones().some((x) => x.destino === destino && x.importe > 0);
    if (conImporte) this.quitarPendiente.set({ tipo: 'destino', id: destino });
    else this.asignaciones.update((a) => a.filter((x) => x.destino !== destino));
  }

  confirmarQuitar(): void {
    const q = this.quitarPendiente();
    this.quitarPendiente.set(null);
    if (q?.tipo === 'origen') {
      this.origen.set('');
      this.asignaciones.set([]);
    } else if (q?.tipo === 'destino') {
      this.asignaciones.update((a) => a.filter((x) => x.destino !== q.id));
    }
  }

  cambiarImporte(destino: string, valor: string | number | string[]): void {
    const importe = redondear(Number(String(valor).replace(/,/g, '')) || 0);
    this.asignaciones.update((a) => a.map((x) => (x.destino === destino ? { ...x, importe } : x)));
  }

  cantidadDestinos(n: number): string {
    return `${n} ${n === 1 ? 'destino' : 'destinos'}`;
  }

  private avisarLista(conCambios: boolean): void {
    this.avisoMensaje.set(conCambios ? 'Se agregaron los cambios a la lista.' : 'Se agregó a la lista correctamente.');
    this.aviso.set('custom');
    this.avisoAbierto.set(true);
  }

  // ── Navegación ────────────────────────────────────────────────────
  regresar(): void {
    if (this.editando()) {
      void Promise.resolve(this.salida.confirmar()).then((descartar) => {
        if (!descartar) return;
        this.editando.set(false);
        this.restaurarFormulario(this.solicitud());
      });
      return;
    }
    void this.router.navigate([PROCESS_ROUTE]);
  }

  editar(): void {
    this.editando.set(true);
    this.avisoAbierto.set(false);
    this.fotoEdicion.set(this.fotoActual());
  }

  // ── Grabar ────────────────────────────────────────────────────────
  onConfirmarGrabar(luegoVerificar = false): void {
    this.modalGrabar.set(false);
    const datos = this.datosAsignacion();
    const guardarYElaborar = (id: string): Observable<unknown> =>
      this.asignacionesApi.guardarDetalle(id, datos).pipe(switchMap(() => this.solicitudesApi.cambiarEstado(id, { estadoNuevo: 'ELABORADO' })));

    this.saving.set(true);

    if (this.solicitudId) {
      const id = this.solicitudId;
      this.solicitudesApi.actualizar(id, { justificacion: this.motivo(), organoLinea: this.organo() })
        .pipe(switchMap(() => guardarYElaborar(id)))
        .subscribe({
          next: () => {
            this.editando.set(false);
            if (luegoVerificar) this.verificar();
            else { this.mostrarAviso('creation-elaborated'); this.cargar(id); }
          },
          error: () => this.cargar(id),
        });
      return;
    }

    const tipo = this.tiposDocumento.find((t) => t.codigo === CODIGO_DOCUMENTO);
    if (!tipo) { this.saving.set(false); return; }
    this.solicitudesFacade.crearSolicitud({
      tipoDocumentoId: tipo.id,
      tipoAccion: 'creacion',
      fechaRequerimiento: new Date().toISOString(),
      organoLinea: this.organo(),
      justificacion: this.motivo(),
      cuentas: [],
    }).pipe(
      switchMap((creada) => { this.solicitudId = creada.id; return guardarYElaborar(creada.id).pipe(map(() => creada.id)); }),
    ).subscribe({
      next: (id) => { this.saving.set(false); this.salida.permitirSalida(); void this.router.navigate([PROCESS_ROUTE, REQUEST_SEGMENT, id], { state: { fromSave: true } }); },
      error: () => {
        this.saving.set(false);
        if (this.solicitudId) { this.salida.permitirSalida(); void this.router.navigate([PROCESS_ROUTE, REQUEST_SEGMENT, this.solicitudId]); }
      },
    });
  }

  // ── Acciones de estado ────────────────────────────────────────────
  onConfirmarVerificar(): void {
    this.modalVerificar.set(false);
    if (this.editando() && this.hayCambios()) { this.onConfirmarGrabar(true); return; }
    this.editando.set(false);
    this.verificar();
  }

  private verificar(): void {
    const errores = validarAsignacion(this.datosAsignacion(), this.libretas());
    if (errores.length) {
      this.saving.set(false);
      if (this.solicitudId) this.cargar(this.solicitudId);
      this.mostrarErrores(errores);
      return;
    }
    this.accion((id) => this.solicitudesApi.cambiarEstado(id, { estadoNuevo: 'VERIFICADO' }), 'creation-verified');
  }

  onConfirmarEliminar(): void {
    this.modalEliminar.set(false);
    this.accion((id) => this.solicitudesApi.cambiarEstado(id, { estadoNuevo: 'ELIMINADO' }), 'creation-deleted');
  }

  abrirAprobar(): void { this.comentario.set(''); this.modalAprobar.set(true); }
  abrirObservar(): void { this.comentario.set(''); this.modalObservar.set(true); }
  abrirRechazar(): void { this.comentario.set(''); this.motivoRechazo.set(''); this.modalRechazar.set(true); }

  cerrarModalesAprobador(): void {
    this.modalAprobar.set(false);
    this.modalObservar.set(false);
    this.modalRechazar.set(false);
  }

  /** Aprobar: el sistema revalida el saldo y mueve el importe; el documento queda Aprobado. */
  onConfirmarAprobar(): void {
    this.modalAprobar.set(false);
    this.accion((id) => this.solicitudesFacade.aprobar(id), 'creation-approved');
  }

  onConfirmarObservar(): void {
    if (!this.comentario().trim()) return;
    this.modalObservar.set(false);
    this.accion((id) => this.solicitudesFacade.observar(id, this.comentario()), 'creation-observed');
  }

  onConfirmarRechazar(): void {
    if (!this.comentario().trim()) return;
    this.modalRechazar.set(false);
    this.accion((id) => this.solicitudesFacade.rechazar(id, this.comentario(), this.motivoRechazo() || undefined), 'creation-rejected');
  }

  private accion(llamada: (id: string) => Observable<unknown>, aviso: SnackbarVariant): void {
    const id = this.solicitudId;
    if (!id) return;
    this.saving.set(true);
    llamada(id).subscribe({
      next: () => { this.mostrarAviso(aviso); this.cargar(id); },
      error: (e: HttpErrorResponse) => {
        const errores = (e?.error as { errores?: ErrorTraslado[] } | null)?.errores;
        if (errores?.length) this.mostrarErrores(errores);
        this.cargar(id);
      },
    });
  }

  private mostrarErrores(errores: ErrorTraslado[]): void {
    this.errores.set(errores);
    this.panelErroresAbierto.set(true);
  }

  private mostrarAviso(variante: SnackbarVariant): void {
    // El texto libre de un aviso anterior taparía el de esta acción.
    this.avisoMensaje.set('');
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
        this.editando.set(false);
        this.fotoEdicion.set(null);
        this.restaurarFormulario(s);
        this.cargando.set(false);
        this.saving.set(false);
      },
      error: () => { this.cargando.set(false); this.saving.set(false); },
    });
  }

  private cargarLibretas(numero: string): void {
    if (!numero) { this.libretas.set([]); return; }
    this.cargandoLibretas.set(true);
    this.trasladosApi.listarLibretas(numero).subscribe({
      next: (libretas) => { this.libretas.set(libretas); this.cargandoLibretas.set(false); },
      error: () => this.cargandoLibretas.set(false),
    });
  }

  private restaurarFormulario(s: SolicitudResponse | null): void {
    const d = s?.detalleAsignacion;
    const cuenta = d?.cuentaBancaria ?? '';
    if (cuenta !== this.cuentaBancaria() || !this.libretas().length) this.cargarLibretas(cuenta);
    this.cuentaBancaria.set(cuenta);
    const p = d?.periodicidad;
    this.tipoPeriodicidad.set(p?.tipo ?? 'mensual');
    this.anio.set(p?.anio ?? ANIO_ACTUAL);
    // Documento nuevo: el mes actual; uno grabado conserva el suyo.
    this.mesAsignacion.set(p ? (p.mesAsignacion ?? null) : MES_ACTUAL);
    const pares = d?.asignaciones ?? [];
    this.origen.set(pares[0]?.origen ?? d?.movimientos.find((m) => m.naturaleza === 'Débito')?.idCorrelativo ?? '');
    this.asignaciones.set(pares.map((a) => ({ ...a })));
    this.tarjetaAbierta.set(true);
    this.motivo.set((s?.asuntoMotivo ?? '').replace(/^\[[^\]]*\]\s*/, ''));
  }
}

function filtrar<T extends object>(filas: T[], texto: string): T[] {
  const q = texto.trim().toLowerCase();
  if (!q) return filas;
  return filas.filter((f) => Object.values(f).some((v) => String(v).toLowerCase().includes(q)));
}
