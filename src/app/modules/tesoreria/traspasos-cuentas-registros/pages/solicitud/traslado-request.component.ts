import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ModalComponent } from '../../../../../shared/ui/modal/modal.component';
import { ConSalidaProtegida, SalidaProtegida } from '../../../../../core/state/salida-protegida';

import { CatalogosApiService, TipoDocumentoResponse } from '../../../../../core/api/catalogos-api.service';
import { SolicitudResponse, SolicitudesApiService } from '../../../../../core/api/solicitudes-api.service';
import { CurrentUserService } from '../../../../../core/auth/current-user.service';
import { PermissionService } from '../../../../../core/auth/permission.service';
import { ESTADO, MOTIVOS_RECHAZO } from '../../../../../core/models/documento.model';
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
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { CollapsibleCardComponent } from '../../../../../shared/ui/collapsible-card/collapsible-card.component';
import { DocumentSummaryCardComponent } from '../../../../../shared/ui/document-summary-card/document-summary-card.component';
import { EmptySectionComponent } from '../../../../../shared/ui/empty-section/empty-section.component';
import { FlowStatus } from '../../../../../shared/ui/flow-status-tag/flow-status-tag.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { AlertComponent } from '../../../../../shared/ui/alert/alert.component';
import { MessageBoxComponent } from '../../../../../shared/ui/message-box/message-box.component';
import { RadioComponent, RadioOption } from '../../../../../shared/ui/radio/radio.component';
import { SidePanelComponent } from '../../../../../shared/ui/side-panel/side-panel.component';
import { SnackbarVariant } from '../../../../../shared/ui/snackbar/snackbar.component';
import { SummaryCardComponent, type SummaryCardField } from '../../../../../shared/ui/summary-card/summary-card.component';
import { TextAreaControlComponent } from '../../../../../shared/ui/text-area-control/text-area-control.component';
import { TextFieldComponent } from '../../../../../shared/ui/text-field/text-field.component';
import { TooltipDirective } from '../../../../../shared/ui/tooltip/tooltip.directive';
import { ABREVIATURAS } from '../../../../../shared/utils/abreviaturas.util';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { fechaElaboracion } from '../../../../../shared/utils/fecha.util';
import { crearSnapshotFormulario, hayCambiosRespectoAlSnapshot } from '../../../../../shared/utils/form-snapshot.util';
import { MIN_CARACTERES_TEXTO_LIBRE, cumpleMinimoTextoLibre } from '../../../../../shared/utils/texto-libre.util';
import { CUENTAS_BANCARIAS, cuentaPorNumero, entidadPorCodigo, formatoImporte, redondear } from '../../../saldos-iniciales/models/saldo-inicial.model';
import { TrasladosApiService } from '../../api/traslados-api.service';
import { PROCESS_ID, PROCESS_ROUTE, REQUEST_SEGMENT } from '../../config/traslados.rutas';
import {
  AsignacionTraslado,
  CODIGO_DOCUMENTO,
  ErrorTraslado,
  FormaSeleccion,
  LibretaSaldo,
  NOMBRE_DOCUMENTO,
  TrasladoDatos,
  asignacionesDe,
  movimientosDe,
  sumar,
  validarTraslado,
} from '../../models/traslado.model';

const SIMBOLO: Record<string, string> = { PEN: 'S/', USD: 'US$' };

/** Fila del panel de cuentas bancarias. */
interface FilaCuentaBancaria {
  numero: string;
  denominacion: string;
  moneda: string;
  entidad: string;
}

/** Textos que cambian según se elija primero el origen o el destino. */
interface TextosForma {
  principales: string;
  secundarias: string;
  panelPrincipales: string;
  panelSecundarias: string;
  importePrincipal: string;
  importePrincipalTermino: string;
  importeSecundaria: string;
  importeSecundariaTermino: string;
  plural: string;
  singular: string;
  sinSecundarias: string;
}

const TEXTOS: Record<FormaSeleccion, TextosForma> = {
  origen: {
    principales: 'Cuentas de origen - Débito',
    secundarias: 'Cuentas de destino - Crédito',
    panelPrincipales: 'Seleccionar cuentas de registros de origen',
    panelSecundarias: 'Seleccionar cuentas de registros de destino',
    importePrincipal: ABREVIATURAS.importeDebitar.abreviatura,
    importePrincipalTermino: ABREVIATURAS.importeDebitar.termino,
    importeSecundaria: ABREVIATURAS.importeAcreditar.abreviatura,
    importeSecundariaTermino: ABREVIATURAS.importeAcreditar.termino,
    plural: 'destinos',
    singular: 'destino',
    sinSecundarias: 'No se agregaron cuentas de destino. Haga clic en el botón para agregar cuentas de destino.',
  },
  destino: {
    principales: 'Cuentas de destino - Crédito',
    secundarias: 'Cuentas de origen - Débito',
    panelPrincipales: 'Seleccionar cuentas de registros de destino',
    panelSecundarias: 'Seleccionar cuentas de registros de origen',
    importePrincipal: ABREVIATURAS.importeAcreditar.abreviatura,
    importePrincipalTermino: ABREVIATURAS.importeAcreditar.termino,
    importeSecundaria: ABREVIATURAS.importeDebitar.abreviatura,
    importeSecundariaTermino: ABREVIATURAS.importeDebitar.termino,
    plural: 'orígenes',
    singular: 'origen',
    sinSecundarias: 'No se agregaron cuentas de origen. Haga clic en el botón para agregar cuentas de origen.',
  },
};

/**
 * Solicitud de Reporte de Traslado de Recursos entre Cuentas de Registro (RTCR), según el Figma del flujo:
 *
 * 1. Cuenta bancaria: se elige en un panel (una sola).
 * 2. Modalidad: «Por cuenta de origen» (elige orígenes y a cada uno le asigna destinos) o «Por cuenta de destino» (al
 *    revés). Cada cuenta principal es una tarjeta desplegable con sus cuentas asignadas y el importe de cada par.
 * 3. Los indicadores (orígenes, destinos y total) se arman mientras se escribe. Se admiten 1 a 1, 1 a N, N a 1 y N a N.
 * 4. Motivo del traslado.
 *
 * Se graban los pares origen → destino y su resumen por cuenta (`movimientos`, lo que mueve el saldo). Verificar
 * revisa todas las reglas a la vez y, si algo falla, abre el panel de errores. El aprobador aprueba (el sistema
 * revalida el saldo y el documento queda Procesado), observa o rechaza.
 */
@Component({
  selector: 'siaf-traslado-request',
  standalone: true,
  imports: [
    ModalComponent,
    ActionTrackerComponent,
    ButtonComponent,
    CollapsibleCardComponent,
    DetailHistoryTabsComponent,
    DocumentSummaryCardComponent,
    EmptySectionComponent,
    IconComponent,
    AlertComponent,
    MessageBoxComponent,
    RadioComponent,
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
  templateUrl: './traslado-request.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrasladoRequestComponent implements OnInit, ConSalidaProtegida {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly currentUser = inject(CurrentUserService);
  private readonly permissions = inject(PermissionService);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly solicitudesApi = inject(SolicitudesApiService);
  private readonly solicitudesFacade = inject(SolicitudesFacadeService);
  private readonly trasladosApi = inject(TrasladosApiService);

  readonly heading = NOMBRE_DOCUMENTO;
  readonly breadcrumbs: BreadcrumbItem[] = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE, NOMBRE_DOCUMENTO);
  readonly minCaracteresTexto = MIN_CARACTERES_TEXTO_LIBRE;
  readonly abrev = ABREVIATURAS;
  readonly formatoImporte = formatoImporte;

  /** Movimiento interno del traslado (catálogo fijo por ahora). */
  readonly movimientoInterno: SummaryCardField[] = [
    { label: 'Código', value: 'TRL001' },
    { label: 'Denominación', value: 'TRASLADO ENTRE CUENTAS DE REGISTROS' },
    { label: 'Sigla', value: 'TRL' },
  ];

  readonly opcionesForma: RadioOption[] = [
    { value: 'origen', label: 'Por cuenta de origen', description: 'Selecciona cuentas de origen y asigna sus destinos.' },
    { value: 'destino', label: 'Por cuenta de destino', description: 'Selecciona cuentas de destino y asocia sus orígenes.' },
  ];

  private solicitudId: string | null = null;
  private tiposDocumento: TipoDocumentoResponse[] = [];

  // ── Estado del documento ──────────────────────────────────────────
  /** Última respuesta del backend: de ella salen el estado, el formulario, el historial y la trazabilidad. */
  private readonly solicitud = signal<SolicitudResponse | null>(null);
  readonly estado = computed(() => (this.solicitud()?.estado ?? 'NUEVO').toUpperCase());
  readonly editando = signal(false);
  readonly cargando = signal(false);
  readonly saving = signal(false);

  readonly headerRole = computed<'creator' | 'approver'>(() => (this.permissions.currentRole() === 'approver' ? 'approver' : 'creator'));
  /** Visualizador de documentos: ve el documento sin ninguna acción. */
  readonly visualizador = computed(() => this.permissions.currentRole() === 'viewer');
  readonly elaborado = computed(() => this.estado() !== 'NUEVO');
  readonly soloLectura = computed(() => this.elaborado() && !this.editando());
  readonly puedeVerificar = computed(() => ['ELABORADO', 'OBSERVADO'].includes(this.estado()));
  readonly numeroDocumento = computed(() => this.solicitud()?.numero ?? '');

  readonly headerState = computed<SolicitudeHeaderState>(() => {
    if (this.editando()) return 'edit';
    switch (this.estado()) {
      case 'PROCESADO': return 'processed';
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
      PROCESADO: ESTADO.PROCESADO,
      APROBADO: ESTADO.APROBADO,
      OBSERVADO: ESTADO.OBSERVADO,
      RECHAZADO: ESTADO.RECHAZADO,
      VERIFICADO: ESTADO.VERIFICADO,
      ELIMINADO: ESTADO.ELIMINADO,
    };
    return etiquetas[this.estado()] ?? ESTADO.ELABORADO;
  });

  // ── Cabecera de la solicitud ──────────────────────────────────────
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
    { key: 'denominacion', label: 'Denominación' },
    { key: 'moneda', label: 'Moneda', widthClass: 'w-[100px]' },
    { key: 'entidad', label: 'Entidad financiera', widthClass: 'w-[280px]' },
  ];
  private readonly filasCuenta: FilaCuentaBancaria[] = CUENTAS_BANCARIAS.map((c) => ({
    numero: c.numero,
    denominacion: c.denominacion,
    moneda: c.moneda,
    entidad: entidadPorCodigo(c.entidadCodigo)?.denominacion ?? '--',
  }));
  readonly cuentasFiltradas = computed(() => filtrar(this.filasCuenta, this.busquedaCuenta()));

  // ── Cuentas de registro ───────────────────────────────────────────
  /** Selección al abrir el panel, para saber si al aceptar se agregó o se cambió algo. */
  private libretasTemporalesIniciales: string[] = [];
  /** Texto del snackbar cuando no es uno de los avisos de flujo. */
  readonly avisoMensaje = signal('');

  /** Snackbar al aceptar el panel: solo se agregaron cuentas, o hubo cambios (alguna se quitó). */
  private avisarLista(conCambios: boolean): void {
    this.avisoMensaje.set(conCambios ? 'Se agregaron los cambios a la lista.' : 'Se agregó a la lista correctamente.');
    this.aviso.set('custom');
    this.avisoAbierto.set(true);
  }

  /** Cuentas de registro de la cuenta elegida, con su saldo disponible de hoy. */
  readonly libretas = signal<LibretaSaldo[]>([]);
  readonly cargandoLibretas = signal(false);
  private readonly libretaPorId = computed(() => new Map(this.libretas().map((l) => [l.idCorrelativo, l])));

  readonly forma = signal<FormaSeleccion | ''>('');
  readonly textos = computed(() => TEXTOS[this.forma() || 'origen']);
  /** Cuentas elegidas primero (orígenes o destinos según la forma), en el orden en que se agregaron. */
  readonly principales = signal<string[]>([]);
  /** Pares origen → destino; el importe es lo que se escribe en la fila de la cuenta asignada. */
  readonly asignaciones = signal<AsignacionTraslado[]>([]);
  /** Tarjetas abiertas (por id de la cuenta principal). */
  readonly abiertas = signal<Set<string>>(new Set());

  readonly columnasLibreta: SelectionColumn<LibretaSaldo>[] = [
    { key: 'idCorrelativo', label: ABREVIATURAS.idCorrelativo.abreviatura, widthClass: 'w-[100px]' },
    { key: 'numero', label: 'Número', widthClass: 'w-[300px]' },
    { key: 'descripcion', label: 'Descripción' },
    { key: 'saldoDisponible', label: ABREVIATURAS.importeCuenta.abreviatura, widthClass: 'w-[170px]', cellClass: 'text-right', render: (l) => formatoImporte(l.saldoDisponible) },
  ];

  /** Panel de cuentas de registro: para elegir las principales, o las asignadas a una principal. */
  readonly panelLibretas = signal<{ para: 'principal' } | { para: 'secundaria'; principal: string } | null>(null);
  readonly busquedaLibreta = signal('');
  readonly libretasTemporales = signal<string[]>([]);
  readonly libretasFiltradas = computed(() => filtrar(this.libretas(), this.busquedaLibreta()));
  readonly tituloPanelLibretas = computed(() => (this.panelLibretas()?.para === 'principal' ? this.textos().panelPrincipales : this.textos().panelSecundarias));
  /** Una cuenta es origen o destino, no las dos: en cada panel se bloquean las que ya cumplen el otro papel. */
  readonly libretasBloqueadas = computed(() => {
    const panel = this.panelLibretas();
    if (!panel) return [];
    if (panel.para === 'principal') return [...new Set(this.asignaciones().map((a) => this.secundariaDe(a)))];
    return this.principales();
  });

  /** Lo que se graba: pares con importe y su resumen por cuenta. */
  private readonly asignacionesConImporte = computed(() => this.asignaciones().filter((a) => a.importe > 0));
  readonly movimientos = computed(() => movimientosDe(this.asignacionesConImporte()));
  readonly totalDebitos = computed(() => sumar(this.movimientos(), 'Débito'));

  readonly indicadores = computed(() => {
    const moneda = SIMBOLO[this.cuentaElegida()?.moneda ?? 'PEN'] ?? '';
    const contar = (lado: FormaSeleccion) => {
      const ids = new Set(this.asignaciones().map((a) => a[lado]));
      if (this.forma() === lado) this.principales().forEach((p) => ids.add(p));
      return ids.size;
    };
    return [
      { caption: 'Cuentas de origen', value: String(contar('origen')), excedido: false },
      { caption: 'Cuentas de destino', value: String(contar('destino')), excedido: false },
      // `excedido`: el total se pinta en rojo si algún importe supera el saldo de su origen.
      { caption: 'Total a trasladar', value: `${moneda} ${formatoImporte(this.totalDebitos())}`, excedido: true },
    ];
  });

  /** Una tarjeta por cuenta principal, con sus cuentas asignadas. */
  readonly tarjetas = computed(() => {
    const libretas = this.libretaPorId();
    const asignaciones = this.asignaciones();
    return this.principales().map((id) => {
      const filas = asignaciones
        .filter((a) => this.principalDe(a) === id)
        .map((a) => ({ id: this.secundariaDe(a), libreta: libretas.get(this.secundariaDe(a)), importe: a.importe }));
      return { id, libreta: libretas.get(id), filas, total: redondear(filas.reduce((t, f) => t + f.importe, 0)) };
    });
  });

  readonly motivo = signal('');
  /** Errores de la verificación (los del sistema o los que devolvió el backend al aprobar). */
  readonly errores = signal<ErrorTraslado[]>([]);
  readonly panelErroresAbierto = signal(false);

  private readonly datosTraslado = computed((): TrasladoDatos => ({
    cuentaBancaria: this.cuentaBancaria(),
    movimientos: this.movimientos(),
    asignaciones: this.asignacionesConImporte(),
    forma: this.forma() || undefined,
  }));

  // Grabar solo con cambios: la foto se toma al pulsar Editar; sin foto (documento nuevo) se asume que hay cambios.
  private readonly fotoEdicion = signal<string | null>(null);
  private readonly fotoActual = computed(() => crearSnapshotFormulario({ traslado: this.datosTraslado(), motivo: this.motivo().trim() }));
  private readonly hayCambios = computed(() => hayCambiosRespectoAlSnapshot(this.fotoEdicion(), this.fotoActual()));
  /** Foto del documento nuevo sin datos: si el formulario cambia, hay datos sin grabar. */
  private fotoNueva = '';
  /** Bloquea la navegación mientras se crea o edita y, al salir con datos sin grabar, pregunta «¿Cancelar documento?». */
  readonly salida = new SalidaProtegida(
    () => !this.soloLectura(),
    () => !this.soloLectura() && ((this.estado() === 'NUEVO' ? this.fotoActual() !== this.fotoNueva : this.hayCambios())),
  );

  /** Para grabar basta la cuenta y al menos un par con importe: las reglas se revisan al verificar. El motivo es
   *  opcional; si se escribe, con el mínimo de caracteres. */
  private readonly formularioCompleto = computed(
    () => !!this.cuentaElegida() && this.movimientos().length > 0 && (!this.motivo().trim() || cumpleMinimoTextoLibre(this.motivo())),
  );

  /** Verificar: en ELABORADO u OBSERVADO; al editar, con los datos completos (graba lo pendiente antes). */
  readonly verificarDeshabilitado = computed(() => {
    if (this.cargando() || this.saving()) return true;
    if (this.editando()) return !this.formularioCompleto();
    return !this.puedeVerificar();
  });

  readonly formValido = computed(() => !this.soloLectura() && this.formularioCompleto() && this.hayCambios());

  // ── Historial y trazabilidad (del historial de estados) ───────────
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
    // La última vez que pasó por cada estado (tras observar y subsanar, cuenta la verificación nueva).
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

    if (!id) this.fotoNueva = this.fotoActual();

    const estadoNavegacion = history.state as { fromSave?: boolean } | null;
    if (estadoNavegacion?.fromSave) this.mostrarAviso('creation-elaborated');
  }

  // ── Cuenta bancaria ───────────────────────────────────────────────
  abrirPanelCuenta(): void {
    this.busquedaCuenta.set('');
    this.cuentaTemporal.set(this.cuentaBancaria() || null);
    this.panelCuentaAbierto.set(true);
  }

  aceptarCuenta(ids: string[]): void {
    this.panelCuentaAbierto.set(false);
    this.elegirCuenta(ids[0] ?? '');
  }

  /** Otra cuenta bancaria (o ninguna): se cargan sus cuentas de registro y se descarta lo armado con la anterior. */
  elegirCuenta(numero: string): void {
    if (numero === this.cuentaBancaria()) return;
    this.cuentaBancaria.set(numero);
    this.limpiarTraslado();
    this.cargarLibretas(numero);
  }

  /** Cambiar la modalidad empieza de nuevo: los pares se arman distinto. */
  elegirForma(valor: string): void {
    if (valor === this.forma()) return;
    this.forma.set(valor as FormaSeleccion);
    this.limpiarTraslado();
  }

  // ── Cuentas de registro ───────────────────────────────────────────
  abrirPanelPrincipales(): void {
    this.busquedaLibreta.set('');
    this.libretasTemporales.set([...this.principales()]);
    this.libretasTemporalesIniciales = [...this.principales()];
    this.panelLibretas.set({ para: 'principal' });
  }

  abrirPanelSecundarias(principal: string): void {
    this.busquedaLibreta.set('');
    this.libretasTemporales.set(this.asignaciones().filter((a) => this.principalDe(a) === principal).map((a) => this.secundariaDe(a)));
    this.libretasTemporalesIniciales = [...this.libretasTemporales()];
    this.panelLibretas.set({ para: 'secundaria', principal });
  }

  /** Aceptar el panel: agrega las nuevas, quita las desmarcadas (con sus pares) y conserva los importes escritos. */
  aceptarLibretas(ids: string[]): void {
    const panel = this.panelLibretas();
    this.panelLibretas.set(null);
    if (!panel) return;
    const antes = [...this.libretasTemporalesIniciales];
    const agregadas = ids.filter((id) => !antes.includes(id)).length;
    const quitadas = antes.filter((id) => !ids.includes(id)).length;
    if (agregadas || quitadas) this.avisarLista(quitadas > 0);
    if (panel.para === 'principal') {
      const nuevas = ids.filter((id) => !this.principales().includes(id));
      this.principales.update((p) => [...p.filter((id) => ids.includes(id)), ...nuevas]);
      this.asignaciones.update((a) => a.filter((x) => ids.includes(this.principalDe(x))));
      this.abiertas.update((s) => new Set([...s, ...nuevas]));
      return;
    }
    const { principal } = panel;
    this.asignaciones.update((lista) => {
      const actuales = lista.filter((a) => this.principalDe(a) === principal);
      const conservadas = actuales.filter((a) => ids.includes(this.secundariaDe(a)));
      const nuevas = ids
        .filter((id) => !actuales.some((a) => this.secundariaDe(a) === id))
        .map((id) => this.par(principal, id, 0));
      return [...lista.filter((a) => this.principalDe(a) !== principal), ...conservadas, ...nuevas];
    });
  }

  quitarPrincipal(id: string): void {
    this.principales.update((p) => p.filter((x) => x !== id));
    this.asignaciones.update((a) => a.filter((x) => this.principalDe(x) !== id));
  }

  quitarSecundaria(principal: string, secundaria: string): void {
    this.asignaciones.update((a) => a.filter((x) => !(this.principalDe(x) === principal && this.secundariaDe(x) === secundaria)));
  }

  cambiarImporte(principal: string, secundaria: string, valor: string | number | string[]): void {
    const importe = redondear(Number(String(valor).replace(/,/g, '')) || 0);
    this.asignaciones.update((a) => a.map((x) => (this.principalDe(x) === principal && this.secundariaDe(x) === secundaria ? { ...x, importe } : x)));
  }

  estaAbierta(id: string): boolean {
    return this.abiertas().has(id);
  }

  alternar(id: string, abierta: boolean): void {
    this.abiertas.update((s) => {
      const nuevo = new Set(s);
      if (abierta) nuevo.add(id);
      else nuevo.delete(id);
      return nuevo;
    });
  }

  /** «Supera el saldo»: lo que debita una cuenta de origen (sumando todos sus pares) pasa su saldo disponible. */
  excedeSaldo(idOrigen: string): boolean {
    const debito = this.movimientos().find((m) => m.naturaleza === 'Débito' && m.idCorrelativo === idOrigen)?.importe ?? 0;
    return debito > (this.libretaPorId().get(idOrigen)?.saldoDisponible ?? 0);
  }

  /** Error del campo de importe: en «por origen» marca todas las filas de la tarjeta cuyo origen se excede; en
   *  «por destino», la fila cuya cuenta de origen (la asignada) no alcanza. El detalle va en `alertaSaldo`. */
  errorImporte(principal: string, secundaria: string): string {
    return this.excedeSaldo(this.origenDeFila(principal, secundaria)) ? 'Supera el saldo disponible.' : '';
  }

  /** Si algún importe de la tarjeta excede el saldo de su origen: pinta en rojo el monto de la cabecera. */
  tarjetaExcedida(principal: string, filas: readonly { id: string }[]): boolean {
    return filas.some((f) => this.excedeSaldo(this.origenDeFila(principal, f.id)));
  }

  /** Cuentas de origen cuyo débito supera su saldo disponible, en el orden de las tarjetas. */
  readonly origenesExcedidos = computed(() => {
    const ids = new Set<string>();
    for (const t of this.tarjetas()) {
      for (const f of t.filas) {
        const origen = this.origenDeFila(t.id, f.id);
        if (this.excedeSaldo(origen)) ids.add(origen);
      }
    }
    return [...ids];
  });

  /** Texto de la alerta única de la sección, o vacío si todos los importes caben en el saldo de su origen. */
  readonly alertaSaldo = computed(() => {
    const ids = this.origenesExcedidos();
    if (ids.length === 0) return '';
    const cuentas =
      ids.length === 1
        ? `de la cuenta de origen ${ids[0]}`
        : `de las cuentas de origen ${ids.slice(0, -1).join(', ')} y ${ids[ids.length - 1]}`;
    return `El importe a trasladar supera el saldo disponible ${cuentas}. Corrija los importes marcados.`;
  });

  /** El origen de una fila de la tarjeta: la principal en «por origen», la asignada en «por destino». */
  origenDeFila(principal: string, secundaria: string): string {
    return this.forma() === 'destino' ? secundaria : principal;
  }

  cantidadAsignadas(n: number): string {
    return `${n} ${n === 1 ? this.textos().singular : this.textos().plural}`;
  }

  private principalDe(a: AsignacionTraslado): string {
    return this.forma() === 'destino' ? a.destino : a.origen;
  }

  private secundariaDe(a: AsignacionTraslado): string {
    return this.forma() === 'destino' ? a.origen : a.destino;
  }

  private par(principal: string, secundaria: string, importe: number): AsignacionTraslado {
    return this.forma() === 'destino' ? { origen: secundaria, destino: principal, importe } : { origen: principal, destino: secundaria, importe };
  }

  private limpiarTraslado(): void {
    this.principales.set([]);
    this.asignaciones.set([]);
    this.abiertas.set(new Set());
  }

  /** Cancelar: con datos o cambios sin grabar, primero pregunta «¿Cancelar documento?». */
  regresar(): void {
    if (this.editando()) {
      void Promise.resolve(this.salida.confirmar()).then((descartar) => {
        if (!descartar) return;
        // Cancelar la edición vuelve a los datos grabados.
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
    const datos = this.datosTraslado();
    const guardarYElaborar = (id: string): Observable<unknown> =>
      this.trasladosApi.guardarDetalle(id, datos).pipe(
        switchMap(() => this.solicitudesApi.cambiarEstado(id, { estadoNuevo: 'ELABORADO' })),
      );

    this.saving.set(true);

    if (this.solicitudId) {
      const id = this.solicitudId;
      this.solicitudesApi.actualizar(id, { justificacion: this.motivo(), organoLinea: this.organo() })
        .pipe(switchMap(() => guardarYElaborar(id)))
        .subscribe({
          next: () => {
            this.editando.set(false);
            // Verificar desde edición: graba y luego verifica (con el panel de errores si algo falla).
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
  /** Verificar; en edición con cambios pendientes, primero los graba. */
  onConfirmarVerificar(): void {
    this.modalVerificar.set(false);
    if (this.editando() && this.hayCambios()) {
      this.onConfirmarGrabar(true);
      return;
    }
    this.editando.set(false);
    this.verificar();
  }

  /** El sistema revisa todas las reglas de una vez; con errores, el documento sigue Elaborado y se abre el panel. */
  private verificar(): void {
    const errores = validarTraslado(this.datosTraslado(), this.libretas());
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

  /** Aprobar: el sistema revalida el saldo, lo reserva y el documento queda Procesado. */
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

  /** Verificar, eliminar, aprobar, observar y rechazar: llamar, avisar y recargar. Con errores de reglas, el panel. */
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
    const d = s?.detalleTraslado;
    const cuenta = d?.cuentaBancaria ?? '';
    if (cuenta !== this.cuentaBancaria() || !this.libretas().length) this.cargarLibretas(cuenta);
    this.cuentaBancaria.set(cuenta);
    const pares = asignacionesDe(d);
    // Sin forma grabada: «por destino» si hay un solo destino y varios orígenes; si no, «por origen».
    const destinos = new Set(pares.map((a) => a.destino));
    const forma: FormaSeleccion | '' = d?.forma ?? (!pares.length ? '' : destinos.size === 1 && pares.length > 1 ? 'destino' : 'origen');
    this.forma.set(forma);
    this.asignaciones.set(pares);
    const principales = [...new Set(pares.map((a) => this.principalDe(a)))];
    this.principales.set(principales);
    this.abiertas.set(new Set(principales));
    this.motivo.set((s?.asuntoMotivo ?? '').replace(/^\[[^\]]*\]\s*/, ''));
  }
}

/** Filtra filas por cualquier texto de sus campos (sin distinguir mayúsculas). */
function filtrar<T extends object>(filas: T[], texto: string): T[] {
  const q = texto.trim().toLowerCase();
  if (!q) return filas;
  return filas.filter((f) => Object.values(f).some((v) => String(v).toLowerCase().includes(q)));
}
