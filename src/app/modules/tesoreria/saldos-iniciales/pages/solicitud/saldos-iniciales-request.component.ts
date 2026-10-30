import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { CatalogosApiService, TipoDocumentoResponse } from '../../../../../core/api/catalogos-api.service';
import { SolicitudResponse, SolicitudesApiService } from '../../../../../core/api/solicitudes-api.service';
import { CurrentUserService } from '../../../../../core/auth/current-user.service';
import { PermissionService } from '../../../../../core/auth/permission.service';
import { ESTADO, MOTIVOS_RECHAZO } from '../../../../../core/models/documento.model';
import { SolicitudesFacadeService } from '../../../../../core/state/solicitudes-facade.service';
import { BreadcrumbItem } from '../../../../../shared/components/breadcrumb/breadcrumb.component';
import { DetailHistoryTabsComponent } from '../../../../../shared/components/detail-history-tabs/detail-history-tabs.component';
import { HistorialSource, buildCurrentComment, buildHistoryEntries } from '../../../../../shared/components/detail-history-tabs/detail-history-tabs.utils';
import { FormTableSearchComponent } from '../../../../../shared/components/form-table-search/form-table-search.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import { RequestApprovalModalsComponent } from '../../../../../shared/components/request-approval-modals/request-approval-modals.component';
import { SelectionColumn, SelectionSideNavComponent } from '../../../../../shared/components/selection-side-nav/selection-side-nav.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { SolicitudeHeaderState } from '../../../../../shared/components/solicitude-header/solicitude-header.component';
import { SolicitudeInfoCardComponent, SolicitudeInfoField } from '../../../../../shared/components/solicitude-info-card/solicitude-info-card.component';
import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { TableControlsComponent } from '../../../../../shared/components/table-controls/table-controls.component';
import { ActionTrackerComponent, ActionTrackerSummary } from '../../../../../shared/ui/action-tracker/action-tracker.component';
import { AlertComponent } from '../../../../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { CheckboxComponent } from '../../../../../shared/ui/checkbox/checkbox.component';
import { DateTimePickerComponent } from '../../../../../shared/ui/date-time-picker/date-time-picker.component';
import { DocumentSummaryCardComponent } from '../../../../../shared/ui/document-summary-card/document-summary-card.component';
import { EmptySectionComponent } from '../../../../../shared/ui/empty-section/empty-section.component';
import { FlowStatus } from '../../../../../shared/ui/flow-status-tag/flow-status-tag.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { MessageBoxComponent } from '../../../../../shared/ui/message-box/message-box.component';
import { ModalComponent } from '../../../../../shared/ui/modal/modal.component';
import { SnackbarVariant } from '../../../../../shared/ui/snackbar/snackbar.component';
import { SummaryCardComponent, SummaryCardField } from '../../../../../shared/ui/summary-card/summary-card.component';
import { TextFieldComponent } from '../../../../../shared/ui/text-field/text-field.component';
import { TooltipDirective } from '../../../../../shared/ui/tooltip/tooltip.directive';
import { UploadSideNavComponent } from '../../../../../shared/ui/upload-side-nav/upload-side-nav.component';
import { UploadedFileCardComponent, UploadedFileInfo } from '../../../../../shared/ui/uploaded-file-card/uploaded-file-card.component';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { crearSnapshotFormulario, hayCambiosRespectoAlSnapshot } from '../../../../../shared/utils/form-snapshot.util';
import { AutorizacionesApiService } from '../../../autorizaciones/api/autorizaciones-api.service';
import { AutorizacionVigente, fechaCorta } from '../../../autorizaciones/models/autorizacion.model';
import { SaldosInicialesApiService } from '../../api/saldos-iniciales-api.service';
import { SaldosCargaMasivaComponent } from '../../components/saldos-carga-masiva/saldos-carga-masiva.component';
import { SaldoLibretasPanelComponent } from '../../components/saldo-libretas-panel/saldo-libretas-panel.component';
import { ADJUSTMENT_ROUTE, PROCESS_ID, PROCESS_ROUTE, REQUEST_SEGMENT } from '../../config/saldos-iniciales.rutas';
import {
  CODIGO_DOCUMENTO,
  CUENTAS_BANCARIAS,
  CuentaBancaria,
  ENTE_RECTOR,
  ENTIDADES_FINANCIERAS,
  EntidadFinanciera,
  MOVIMIENTO_INTERNO,
  NOMBRE_DOCUMENTO,
  PERIODO,
  SaldoInicial,
  TIPO_COTIZACION,
  TIPO_OPERACION,
  TIPO_OPERACION_AJUSTE,
  NaturalezaAjuste,
  SaldoReferencia,
  calcularAjuste,
  importeFirmado,
  saldoActualizado,
  MOVIMIENTO_INTERNO_AJUSTE,
  SaldoInicialRegistro,
  calcularSaldo,
  cuentaPorNumero,
  cuentasRegistroDe,
  entidadPorCodigo,
  formatoFecha,
  formatoImporte,
  redondear,
  tipoCambio,
} from '../../models/saldo-inicial.model';

import { fechaElaboracion } from '../../../../../shared/utils/fecha.util';
/** Lo que se está llenando en «Agregar saldo inicial libro bancos». */
interface Borrador {
  fechaOperacion: string;
  cuentaBancaria: string;
  /** Importe escrito en cada libreta, por id correlativo (texto, como lo deja el campo decimal). */
  importes: Record<string, string>;
  /** Documento de sustento del saldo (opcional). */
  sustento: UploadedFileInfo | null;
  /** Solo en un ajuste: naturaleza de cada libreta (por id correlativo). */
  naturalezas: Record<string, NaturalezaAjuste>;
}

const BORRADOR_VACIO: Borrador = { fechaOperacion: '', cuentaBancaria: '', importes: {}, sustento: null, naturalezas: {} };

/** Una fila de «Ajuste saldo inicial libro bancos»: el saldo registrado o, ya ajustado, el ajuste. */
interface FilaAjuste {
  id: string;
  fechaOperacion: string;
  secuenciaReferencia: string;
  cuentaBancaria: string;
  moneda: string;
  importeCuenta: number;
  importeNacional: number;
  saldoInicial: number;
  saldoActual: number;
  sustento: string | null;
  libretas: SaldoInicial['libretas'];
}

/** Paginado en memoria de una tabla del formulario. */
function paginar<T>(filas: T[], pagina: number, tamano: number): { filas: T[]; totalPaginas: number } {
  const totalPaginas = Math.max(1, Math.ceil(filas.length / tamano));
  const actual = Math.min(pagina, totalPaginas);
  return { filas: filas.slice((actual - 1) * tamano, actual * tamano), totalPaginas };
}

const contiene = (texto: string, busqueda: string): boolean => texto.toLowerCase().includes(busqueda.trim().toLowerCase());

/**
 * Registro de saldos iniciales (RSIN), según Figma «2.10.6.1.3 Saldos Iniciales en Libro Bancos y Libretas de Cuentas
 * de Registro».
 *
 * El creador elige la entidad financiera y agrega uno o varios saldos: por cada cuenta bancaria de la entidad, los
 * importes de sus cuentas de registro (libretas). Los importes de la cuenta y en moneda nacional se calculan solos.
 * Grabar: crear el documento → guardar los saldos (cada uno con su sustento opcional) → pasar a ELABORADO (genera el número).
 * El aprobador aprueba, observa o rechaza un documento VERIFICADO; al aprobar, cada saldo recibe su secuencia.
 */
@Component({
  selector: 'siaf-saldos-iniciales-request',
  standalone: true,
  imports: [
    SaldosCargaMasivaComponent,
    AlertComponent,
    SaldoLibretasPanelComponent,
    ActionTrackerComponent,
    ButtonComponent,
    CheckboxComponent,
    DateTimePickerComponent,
    DetailHistoryTabsComponent,
    DocumentSummaryCardComponent,
    EmptySectionComponent,
    FormTableSearchComponent,
    IconComponent,
    MessageBoxComponent,
    ModalComponent,
    PaginationComponent,
    RequestApprovalModalsComponent,
    SelectionSideNavComponent,
    SolicitudeFormCardComponent,
    SolicitudeInfoCardComponent,
    SolicitudePageLayoutComponent,
    SummaryCardComponent,
    TableControlsComponent,
    TextFieldComponent,
    TooltipDirective,
    UploadedFileCardComponent,
    UploadSideNavComponent,
  ],
  templateUrl: './saldos-iniciales-request.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaldosInicialesRequestComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly currentUser = inject(CurrentUserService);
  private readonly permissions = inject(PermissionService);
  private readonly catalogosApi = inject(CatalogosApiService);
  private readonly solicitudesApi = inject(SolicitudesApiService);
  private readonly solicitudesFacade = inject(SolicitudesFacadeService);
  private readonly saldosApi = inject(SaldosInicialesApiService);
  private readonly autorizacionesApi = inject(AutorizacionesApiService);

  // ── Ajuste de saldo inicial (con autorización excepcional vigente) ──
  /** Autorizaciones vigentes del usuario (una por cuenta); con alguna, el tipo de operación se habilita. */
  readonly vigentes = signal<AutorizacionVigente[]>([]);
  private readonly registrosSaldo = signal<SaldoInicialRegistro[]>([]);
  readonly opcionesTipoOperacion = [
    { label: TIPO_OPERACION, value: TIPO_OPERACION },
    { label: TIPO_OPERACION_AJUSTE, value: TIPO_OPERACION_AJUSTE },
  ];
  readonly tipoOperacionSel = signal(TIPO_OPERACION);
  readonly esAjuste = computed(() => this.tipoOperacionSel() === TIPO_OPERACION_AJUSTE);
  /** Cuentas que se pueden ajustar ahora: vigentes y sin otro documento de ajuste en curso. */
  private readonly vigentesLibres = computed(() => this.vigentes().filter((v) => !v.documentoEnCurso || v.documentoEnCurso === this.solicitudId));
  readonly tipoOperacionEditable = computed(() => !this.elaborado() && this.vigentesLibres().length > 0);
  readonly cuentaAjuste = signal<string | null>(null);
  readonly opcionesCuentaAjuste = computed(() => this.vigentesLibres().map((v) => ({ label: v.cuentaBancaria, value: v.cuentaBancaria })));
  readonly vigenteAjuste = computed(() => this.vigentes().find((v) => v.cuentaBancaria === this.cuentaAjuste()) ?? null);
  readonly mensajeVigencia = computed(() => {
    const v = this.vigenteAjuste();
    return v
      ? `Cuenta con una autorización vigente para registrar ajustes al saldo inicial de la cuenta bancaria ${v.cuentaBancaria} hasta el ${fechaCorta(v.fechaHasta)}. Durante este período podrá realizar los ajustes.`
      : '';
  });
  /** El ajuste ya hecho en este documento (uno solo). */
  readonly ajusteHecho = computed(() => this.saldos().find((x) => x.ajuste) ?? null);
  /** Saldo registrado de la cuenta autorizada (sin ajustes): lo que se ajusta. */
  private readonly saldoOriginal = computed(() =>
    this.registrosSaldo().find((r) => r.estado === 'Activo' && !r.ajuste && r.cuentaBancaria === this.cuentaAjuste()) ?? null);
  readonly referenciaAjuste = computed<SaldoReferencia | null>(() => {
    const a = this.ajusteHecho()?.ajuste;
    if (a) return { secuencia: a.secuenciaReferencia, importeCuenta: a.saldoInicial, libretas: a.libretasIniciales };
    return this.saldoOriginal();
  });
  readonly filasAjuste = computed<FilaAjuste[]>(() => {
    const hecho = this.ajusteHecho();
    if (hecho?.ajuste) {
      return [{
        id: hecho.id, fechaOperacion: hecho.fechaOperacion, secuenciaReferencia: hecho.ajuste.secuenciaReferencia,
        cuentaBancaria: hecho.cuentaBancaria, moneda: hecho.moneda, importeCuenta: hecho.importeCuenta, importeNacional: hecho.importeNacional,
        saldoInicial: hecho.ajuste.saldoInicial, saldoActual: saldoActualizado(hecho.ajuste.saldoInicial, hecho.importeCuenta, hecho.ajuste.naturaleza),
        sustento: hecho.sustento ?? null, libretas: hecho.libretas,
      }];
    }
    const o = this.saldoOriginal();
    return o ? [{
      id: o.registroId, fechaOperacion: o.fechaOperacion, secuenciaReferencia: o.secuencia ?? '', cuentaBancaria: o.cuentaBancaria,
      moneda: o.moneda, importeCuenta: o.importeCuenta, importeNacional: o.importeNacional, saldoInicial: o.importeCuenta,
      saldoActual: o.importeCuenta, sustento: o.sustento ?? null, libretas: o.libretas,
    }] : [];
  });
  readonly ajusteSeleccionado = signal(false);
  readonly opcionesNaturaleza = [{ label: 'Crédito', value: 'Crédito' }, { label: 'Débito', value: 'Débito' }];

  /** Abre «Ajuste saldo inicial libro bancos» sobre la cuenta autorizada (o el ajuste ya hecho). */
  ajustarSaldo(): void {
    const cuenta = this.cuentaAjuste();
    if (!cuenta || !this.referenciaAjuste()) return;
    const hecho = this.ajusteHecho();
    this.saldoEditado.set(hecho?.id ?? null);
    this.borrador.set({
      fechaOperacion: hecho?.fechaOperacion ?? '',
      cuentaBancaria: cuenta,
      importes: Object.fromEntries((hecho?.libretas ?? []).map((l) => [l.idCorrelativo, l.importe.toFixed(2)])),
      naturalezas: Object.fromEntries((hecho?.libretas ?? []).map((l) => [l.idCorrelativo, l.naturaleza ?? 'Crédito'])),
      sustento: hecho?.sustento ? { name: hecho.sustento } : null,
    });
    this.ajusteSeleccionado.set(false);
    this.abrirEditor();
  }

  naturalezaDe(idCorrelativo: string): NaturalezaAjuste {
    return this.borrador().naturalezas[idCorrelativo] ?? 'Crédito';
  }

  cambiarNaturaleza(idCorrelativo: string, valor: string | number | string[]): void {
    const naturaleza: NaturalezaAjuste = valor === 'Débito' ? 'Débito' : 'Crédito';
    this.borrador.update((b) => ({ ...b, naturalezas: { ...b.naturalezas, [idCorrelativo]: naturaleza } }));
  }

  /** Suma firmada de las libretas del ajuste (el débito resta). */
  readonly netoAjuste = computed(() => {
    const b = this.borrador();
    return redondear(Object.entries(b.importes).reduce((total, [id, v]) =>
      total + importeFirmado({ importe: parseFloat(v) || 0, naturaleza: b.naturalezas[id] ?? 'Crédito' }), 0));
  });
  readonly naturalezaAjuste = computed<NaturalezaAjuste>(() => (this.netoAjuste() < 0 ? 'Débito' : 'Crédito'));
  readonly saldoActualizadoBorrador = computed(() => redondear((this.referenciaAjuste()?.importeCuenta ?? 0) + this.netoAjuste()));

  saldoInicialLibreta(idCorrelativo: string): number {
    return this.referenciaAjuste()?.libretas.find((l) => l.idCorrelativo === idCorrelativo)?.importe ?? 0;
  }

  saldoActualLibreta(idCorrelativo: string): number {
    const importe = parseFloat(this.borrador().importes[idCorrelativo]) || 0;
    return redondear(this.saldoInicialLibreta(idCorrelativo) + importeFirmado({ importe, naturaleza: this.naturalezaDe(idCorrelativo) }));
  }
  readonly camposMovimientoAjuste: SummaryCardField[] = [
    { label: 'Código', value: MOVIMIENTO_INTERNO_AJUSTE.codigo },
    { label: 'Denominación', value: MOVIMIENTO_INTERNO_AJUSTE.denominacion },
    { label: 'Naturaleza del movimiento', value: MOVIMIENTO_INTERNO_AJUSTE.naturaleza },
    { label: 'Sigla', value: MOVIMIENTO_INTERNO_AJUSTE.sigla },
  ];

  cambiarTipoOperacion(valor: string | number | string[]): void {
    const tipo = String(valor);
    if (tipo === this.tipoOperacionSel()) return;
    this.tipoOperacionSel.set(tipo);
    this.cerrarEditor();
    this.saldos.set([]);
    if (tipo === TIPO_OPERACION_AJUSTE) {
      this.elegirCuentaAjuste(this.vigentesLibres()[0]?.cuentaBancaria ?? null);
    } else {
      this.cuentaAjuste.set(null);
      this.entidadCodigo.set(null);
    }
  }

  /** Precarga la entidad financiera de la cuenta autorizada (fija en el ajuste). */
  elegirCuentaAjuste(valor: string | number | string[] | null): void {
    const cuenta = valor ? String(valor) : null;
    this.cuentaAjuste.set(cuenta);
    this.entidadCodigo.set(cuenta ? cuentaPorNumero(cuenta)?.entidadCodigo ?? null : null);
  }

  readonly heading = NOMBRE_DOCUMENTO;
  readonly breadcrumbs: BreadcrumbItem[] = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE);
  readonly tipoOperacion = TIPO_OPERACION;
  readonly periodo = PERIODO;
  readonly tipoCotizacion = TIPO_COTIZACION;
  readonly formatoImporte = formatoImporte;
  readonly formatoFecha = formatoFecha;
  readonly ayudaSecuencia = 'La secuencia será asignado automáticamente por el sistema tras la aprobación del registro.';
  readonly ayudaImportes = 'Suma automática de las cuentas de registro.';

  readonly camposMovimiento: SummaryCardField[] = [
    { label: 'Código', value: MOVIMIENTO_INTERNO.codigo },
    { label: 'Denominación', value: MOVIMIENTO_INTERNO.denominacion },
    { label: 'Naturaleza del movimiento', value: MOVIMIENTO_INTERNO.naturaleza },
    { label: 'Sigla', value: MOVIMIENTO_INTERNO.sigla },
  ];

  private solicitudId: string | null = null;
  private tiposDocumento: TipoDocumentoResponse[] = [];
  private siguienteSaldo = 1;

  // ── Estado del documento ──────────────────────────────────────────
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
    { label: 'Ente rector', value: ENTE_RECTOR.toUpperCase() },
    { label: 'Entidad', value: (this.solicitud()?.entidadCreadora?.nombre ?? this.currentUser.user().entidad ?? this.currentUser.user().office).toUpperCase() },
  ]);

  // ── Entidad financiera ────────────────────────────────────────────
  readonly entidadCodigo = signal<string | null>(null);
  readonly entidad = computed(() => entidadPorCodigo(this.entidadCodigo()));
  readonly camposEntidadFinanciera = computed<SummaryCardField[]>(() => {
    const e = this.entidad();
    return e ? [
      { label: 'Tipo', value: e.tipo },
      { label: 'Código', value: e.codigo },
      { label: 'Denominación', value: e.denominacion },
      { label: 'Sigla', value: e.sigla },
    ] : [];
  });

  readonly panelEntidad = signal(false);
  readonly busquedaEntidad = signal('');
  readonly entidadTemporal = signal<string | null>(null);
  readonly columnasEntidad: SelectionColumn<EntidadFinanciera>[] = [
    { key: 'tipo', label: 'Tipo', widthClass: 'w-[140px]' },
    { key: 'codigo', label: 'Código', widthClass: 'w-[90px]' },
    { key: 'denominacion', label: 'Denominación' },
    { key: 'sigla', label: 'Sigla', widthClass: 'w-[110px]' },
  ];
  readonly entidadesFiltradas = computed(() => {
    const q = this.busquedaEntidad();
    return ENTIDADES_FINANCIERAS.filter((e) => !q || [e.tipo, e.codigo, e.denominacion, e.sigla].some((v) => contiene(v, q)));
  });
  /** Cambiar o quitar la entidad con saldos cargados los borra: se pide confirmación. */
  readonly modalCambioEntidad = signal(false);
  private entidadPendiente: string | null = null;

  // ── Saldos agregados ──────────────────────────────────────────────
  readonly saldos = signal<SaldoInicial[]>([]);
  readonly busquedaSaldos = signal('');
  readonly paginaSaldos = signal(1);
  readonly tamanoSaldos = signal(25);
  readonly seleccionSaldos = signal<string[]>([]);
  /** Saldo cuyas cuentas de registro se ven desplegadas en la tabla. */
  readonly saldoDesplegado = signal<string | null>(null);

  // ── Saldos iniciales libretas (panel de detalle de un saldo) ──────
  readonly saldoVisto = signal<SaldoInicial | null>(null);

  private readonly saldosFiltrados = computed(() => {
    const q = this.busquedaSaldos();
    return this.saldos().filter((s) => !q || [s.cuentaBancaria, s.moneda, formatoFecha(s.fechaOperacion)].some((v) => contiene(v, q)));
  });
  readonly tablaSaldos = computed(() => paginar(this.saldosFiltrados(), this.paginaSaldos(), this.tamanoSaldos()));
  readonly totalSaldos = computed(() => this.saldosFiltrados().length);
  readonly todosSeleccionados = computed(() => this.saldos().length > 0 && this.seleccionSaldos().length === this.saldos().length);

  // ── Agregar saldo inicial libro bancos ────────────────────────────
  readonly editorAbierto = signal(false);
  /** Id del saldo que se está editando (null: uno nuevo). */
  readonly saldoEditado = signal<string | null>(null);
  readonly borrador = signal<Borrador>({ ...BORRADOR_VACIO });
  readonly cuentaBorrador = computed(() => cuentaPorNumero(this.borrador().cuentaBancaria));
  readonly camposCuenta = computed<SummaryCardField[]>(() => {
    const c = this.cuentaBorrador();
    return c ? [
      { label: 'Número de cuenta', value: c.numero },
      { label: 'Denominación', value: c.denominacion },
      { label: 'Moneda', value: c.moneda },
    ] : [];
  });
  readonly esDolares = computed(() => this.cuentaBorrador()?.moneda === 'USD');
  readonly tipoCambioBorrador = computed(() => {
    const c = this.cuentaBorrador();
    return c && this.borrador().fechaOperacion ? tipoCambio(c.moneda, this.borrador().fechaOperacion) : null;
  });
  readonly importeCuentaBorrador = computed(() =>
    this.esAjuste() ? Math.abs(this.netoAjuste()) : redondear(Object.values(this.borrador().importes).reduce((total, v) => total + (parseFloat(v) || 0), 0)),
  );
  readonly importeNacionalBorrador = computed(() => redondear(this.importeCuentaBorrador() * (this.tipoCambioBorrador() ?? 1)));
  readonly puedeAceptarSaldo = computed(() => !!this.borrador().fechaOperacion && !!this.cuentaBorrador() && this.importeCuentaBorrador() > 0);

  readonly panelCuenta = signal(false);
  readonly busquedaCuenta = signal('');
  readonly cuentaTemporal = signal<string | null>(null);
  readonly columnasCuenta: SelectionColumn<CuentaBancaria>[] = [
    { key: 'numero', label: 'Número de cuenta', widthClass: 'w-[220px]' },
    { key: 'denominacion', label: 'Denominación' },
    { key: 'moneda', label: 'Moneda', widthClass: 'w-[90px]' },
  ];
  readonly cuentasDeEntidad = computed(() => {
    const q = this.busquedaCuenta();
    return CUENTAS_BANCARIAS.filter((c) => c.entidadCodigo === this.entidadCodigo())
      .filter((c) => !q || [c.numero, c.denominacion, c.moneda].some((v) => contiene(v, q)));
  });
  /** Una cuenta ya agregada en otro saldo no se puede volver a elegir. */
  readonly cuentasUsadas = computed(() =>
    this.saldos().filter((s) => s.id !== this.saldoEditado()).map((s) => s.cuentaBancaria),
  );

  // ── Carga masiva ──────────────────────────────────────────────────
  readonly cargaMasivaAbierta = signal(false);
  /** Cuentas de la entidad que aún no están en el documento: las que ofrece la plantilla precargada. */
  readonly cuentasParaCarga = computed(() =>
    CUENTAS_BANCARIAS.filter((c) => c.entidadCodigo === this.entidadCodigo() && !this.saldos().some((s) => s.cuentaBancaria === c.numero)));
  readonly cuentasEnDocumento = computed(() => this.saldos().map((s) => s.cuentaBancaria));
  readonly nuevoIdSaldo = (): string => `nuevo-${this.siguienteSaldo++}`;
  /** Texto del snackbar cuando no es uno de los avisos de flujo. */
  readonly avisoMensaje = signal('');

  /** Los saldos del Excel se suman a la tabla del documento. */
  onCargaMasiva(saldos: SaldoInicial[]): void {
    this.saldos.update((lista) => [...lista, ...saldos]);
    this.cargaMasivaAbierta.set(false);
    this.avisoMensaje.set(`Se cargaron ${saldos.length} items correctamente.`);
    this.aviso.set('custom');
    this.avisoAbierto.set(true);
  }

  readonly busquedaLibretas = signal('');
  readonly paginaLibretas = signal(1);
  readonly tamanoLibretas = signal(25);
  private readonly libretasFiltradas = computed(() => {
    const q = this.busquedaLibretas();
    return cuentasRegistroDe(this.borrador().cuentaBancaria)
      .filter((l) => !q || [l.idCorrelativo, l.numero, l.descripcion].some((v) => contiene(v, q)));
  });
  readonly tablaLibretas = computed(() => paginar(this.libretasFiltradas(), this.paginaLibretas(), this.tamanoLibretas()));
  readonly totalLibretas = computed(() => this.libretasFiltradas().length);

  // ── Sustento del saldo ────────────────────────────────────────────
  readonly panelSustentoAbierto = signal(false);

  // Grabar solo con cambios: la foto se toma al pulsar Editar; sin foto (documento nuevo) se asume que hay cambios.
  private readonly fotoEdicion = signal<string | null>(null);
  private readonly fotoActual = computed(() => crearSnapshotFormulario({
    entidad: this.entidadCodigo(),
    saldos: this.saldos().map((s) => ({ f: s.fechaOperacion, c: s.cuentaBancaria, l: s.libretas, s: s.sustento ?? null })),
  }));
  private readonly hayCambios = computed(() => hayCambiosRespectoAlSnapshot(this.fotoEdicion(), this.fotoActual()));

  /** Verificar: en ELABORADO u OBSERVADO; al editar, con los datos completos (graba lo pendiente antes). */
  readonly verificarDeshabilitado = computed(() => {
    if (this.cargando() || this.saving()) return true;
    if (this.editando()) return !this.entidad() || this.saldos().length === 0 || this.editorAbierto();
    return !this.puedeVerificar();
  });

  readonly formValido = computed(() =>
    !this.soloLectura() && !!this.entidad() && this.saldos().length > 0 && !this.editorAbierto() && this.hayCambios(),
  );

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
  readonly comentarioActual = computed(() => buildCurrentComment(this.estado(), this.fuentesHistorial()));

  readonly trazabilidad = computed<ActionTrackerSummary[]>(() => {
    const historial = this.solicitud()?.historialEstados ?? [];
    const ultimo = (estado: string) => [...historial].reverse().find((h) => h.estadoNuevo === estado);
    const quien = (estado: string, label: string): ActionTrackerSummary => {
      const h = ultimo(estado);
      const nombre = h?.creador ? `${h.creador.nombres} ${h.creador.apellidoPaterno} ${h.creador.apellidoMaterno}` : '';
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
    // La alerta de vigencia acompaña al ajuste hasta que se aprueba (también en un documento ya grabado).
    this.autorizacionesApi.listarVigentes().subscribe((v) => this.vigentes.set(v));
    if (id) this.cargar(id);
    else this.saldosApi.listarRegistros().subscribe((r) => this.registrosSaldo.set(r));

    const estadoNavegacion = history.state as { fromSave?: boolean } | null;
    if (estadoNavegacion?.fromSave) this.mostrarAviso('creation-elaborated');
  }

  // ── Entidad financiera ────────────────────────────────────────────
  abrirPanelEntidad(): void {
    this.busquedaEntidad.set('');
    this.entidadTemporal.set(this.entidadCodigo());
    this.panelEntidad.set(true);
  }

  aceptarEntidad(ids: string[]): void {
    this.panelEntidad.set(false);
    const codigo = ids[0] ?? null;
    if (!codigo || codigo === this.entidadCodigo()) return;
    this.cambiarEntidad(codigo);
  }

  quitarEntidad(): void {
    this.cambiarEntidad(null);
  }

  private cambiarEntidad(codigo: string | null): void {
    if (this.saldos().length > 0 || this.editorAbierto()) {
      this.entidadPendiente = codigo;
      this.modalCambioEntidad.set(true);
      return;
    }
    this.entidadCodigo.set(codigo);
  }

  confirmarCambioEntidad(): void {
    this.modalCambioEntidad.set(false);
    this.saldos.set([]);
    this.seleccionSaldos.set([]);
    this.cerrarEditor();
    this.entidadCodigo.set(this.entidadPendiente);
    this.entidadPendiente = null;
  }

  // ── Saldos agregados ──────────────────────────────────────────────
  buscarSaldos(texto: string): void {
    this.busquedaSaldos.set(texto);
    this.paginaSaldos.set(1);
  }

  alternarSeleccionTodos(marcar: boolean): void {
    this.seleccionSaldos.set(marcar ? this.saldos().map((s) => s.id) : []);
  }

  alternarSeleccion(id: string, marcar: boolean): void {
    this.seleccionSaldos.update((ids) => (marcar ? [...ids, id] : ids.filter((x) => x !== id)));
  }

  quitarSeleccionados(): void {
    const quitar = new Set(this.seleccionSaldos());
    this.saldos.update((lista) => lista.filter((s) => !quitar.has(s.id)));
    this.seleccionSaldos.set([]);
    if (this.saldoEditado() && quitar.has(this.saldoEditado()!)) this.cerrarEditor();
  }

  verLibretas(saldo: SaldoInicial): void {
    this.saldoVisto.set(saldo);
  }

  alternarDespliegue(id: string): void {
    this.saldoDesplegado.update((actual) => (actual === id ? null : id));
  }

  // ── Agregar / editar un saldo ─────────────────────────────────────
  nuevoSaldo(): void {
    this.saldoEditado.set(null);
    this.borrador.set({ ...BORRADOR_VACIO, importes: {} });
    this.abrirEditor();
  }

  editarSaldo(saldo: SaldoInicial): void {
    this.saldoEditado.set(saldo.id);
    this.borrador.set({
      fechaOperacion: saldo.fechaOperacion,
      cuentaBancaria: saldo.cuentaBancaria,
      importes: Object.fromEntries(saldo.libretas.map((l) => [l.idCorrelativo, l.importe.toFixed(2)])),
      sustento: saldo.sustento ? { name: saldo.sustento } : null,
      naturalezas: {},
    });
    this.abrirEditor();
  }

  /** Edita el único saldo marcado en la tabla. */
  editarSeleccionado(): void {
    const [id] = this.seleccionSaldos();
    const saldo = this.seleccionSaldos().length === 1 ? this.saldos().find((x) => x.id === id) : undefined;
    if (saldo) this.editarSaldo(saldo);
  }

  private abrirEditor(): void {
    this.busquedaLibretas.set('');
    this.paginaLibretas.set(1);
    this.editorAbierto.set(true);
  }

  cerrarEditor(): void {
    this.editorAbierto.set(false);
    this.cuentaTemporal.set(null);
    this.busquedaCuenta.set('');
    this.seleccionSaldos.set([]);
    this.saldoEditado.set(null);
    this.ajusteSeleccionado.set(false);
    this.borrador.set({ ...BORRADOR_VACIO, importes: {}, naturalezas: {} });
  }

  actualizarFecha(fecha: string): void {
    this.borrador.update((b) => ({ ...b, fechaOperacion: fecha }));
  }

  actualizarImporte(idCorrelativo: string, valor: string | number | string[]): void {
    this.borrador.update((b) => ({ ...b, importes: { ...b.importes, [idCorrelativo]: String(valor ?? '') } }));
  }

  importeDe(idCorrelativo: string): string {
    return this.borrador().importes[idCorrelativo] || '';
  }

  importeNacionalLibreta(idCorrelativo: string): number {
    return redondear((parseFloat(this.borrador().importes[idCorrelativo]) || 0) * (this.tipoCambioBorrador() ?? 1));
  }

  abrirPanelCuenta(): void {
    this.busquedaCuenta.set('');
    this.cuentaTemporal.set(this.borrador().cuentaBancaria || null);
    this.panelCuenta.set(true);
  }

  aceptarCuenta(ids: string[]): void {
    this.panelCuenta.set(false);
    const numero = ids[0];
    // Otra cuenta: sus libretas son otras, así que los importes empiezan de cero.
    if (numero && numero !== this.borrador().cuentaBancaria) {
      this.borrador.update((b) => ({ ...b, cuentaBancaria: numero, importes: {} }));
      this.busquedaLibretas.set('');
      this.paginaLibretas.set(1);
    }
  }

  quitarCuenta(): void {
    this.borrador.update((b) => ({ ...b, cuentaBancaria: '', importes: {} }));
  }

  buscarLibretas(texto: string): void {
    this.busquedaLibretas.set(texto);
    this.paginaLibretas.set(1);
  }

  aceptarSaldo(): void {
    if (!this.puedeAceptarSaldo()) return;
    const b = this.borrador();
    const id = this.saldoEditado() ?? `nuevo-${this.siguienteSaldo++}`;
    const importes = Object.fromEntries(Object.entries(b.importes).map(([k, v]) => [k, parseFloat(v) || 0]));
    const referencia = this.referenciaAjuste();
    if (this.esAjuste() && referencia) {
      const movimientos = Object.fromEntries(Object.entries(importes).map(([k, v]) => [k, { importe: v, naturaleza: this.naturalezaDe(k) }]));
      this.saldos.set([{ ...calcularAjuste(id, b.fechaOperacion, b.cuentaBancaria, movimientos, referencia), sustento: b.sustento?.name ?? null }]);
      this.cerrarEditor();
      return;
    }
    const saldo = { ...calcularSaldo(id, b.fechaOperacion, b.cuentaBancaria, importes), sustento: b.sustento?.name ?? null };
    this.saldos.update((lista) => (this.saldoEditado() ? lista.map((s) => (s.id === id ? saldo : s)) : [...lista, saldo]));
    this.cerrarEditor();
  }

  // ── Página ────────────────────────────────────────────────────────
  onSustentoConfirmado(archivo: File): void {
    this.borrador.update((b) => ({ ...b, sustento: archivo }));
    this.panelSustentoAbierto.set(false);
  }

  quitarSustento(): void {
    this.borrador.update((b) => ({ ...b, sustento: null }));
  }

  regresar(): void {
    if (this.editando()) {
      this.editando.set(false);
      this.cerrarEditor();
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

  // ── Grabar ────────────────────────────────────────────────────────
  onConfirmarGrabar(luegoVerificar = false): void {
    this.modalGrabar.set(false);
    const datos = { entidadFinanciera: this.entidadCodigo() ?? '', saldos: this.saldos() };
    const justificacion = `Registro de saldos iniciales en libro bancos: ${this.entidad()?.denominacion ?? ''}.`;
    const guardarYElaborar = (id: string): Observable<unknown> =>
      this.saldosApi.guardarDetalle(id, datos).pipe(
        switchMap(() => this.solicitudesApi.cambiarEstado(id, { estadoNuevo: 'ELABORADO' })),
      );

    this.saving.set(true);

    if (this.solicitudId) {
      const id = this.solicitudId;
      this.solicitudesApi.actualizar(id, { justificacion, organoLinea: this.organo() })
        .pipe(
          switchMap(() => guardarYElaborar(id)),
          // Verificar desde edición: graba y luego verifica.
          switchMap(() => (luegoVerificar ? this.solicitudesApi.cambiarEstado(id, { estadoNuevo: 'VERIFICADO' }) : of(null))),
        )
        .subscribe({
          next: () => { this.editando.set(false); this.mostrarAviso(luegoVerificar ? 'creation-verified' : 'creation-elaborated'); this.cargar(id); },
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
      justificacion,
      cuentas: [],
    }).pipe(
      switchMap((creada) => { this.solicitudId = creada.id; return guardarYElaborar(creada.id).pipe(map(() => creada.id)); }),
    ).subscribe({
      next: (id) => { this.saving.set(false); void this.router.navigate([PROCESS_ROUTE, REQUEST_SEGMENT, id], { state: { fromSave: true } }); },
      error: () => {
        this.saving.set(false);
        if (this.solicitudId) void this.router.navigate([PROCESS_ROUTE, REQUEST_SEGMENT, this.solicitudId]);
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
        // Un ajuste de saldo inicial (tipo de operación 2) tiene su propia vista de solo lectura.
        const ajuste = s.detalleSaldosIniciales?.saldos.find((x) => x.ajuste);
        if (ajuste && ['APROBADO', 'RECHAZADO', 'ELIMINADO'].includes(s.estado)) {
          void this.router.navigate([ADJUSTMENT_ROUTE, s.id], { replaceUrl: true });
          return;
        }
        this.solicitudId = s.id;
        this.solicitud.set(s);
        this.tipoOperacionSel.set(ajuste ? TIPO_OPERACION_AJUSTE : TIPO_OPERACION);
        this.cuentaAjuste.set(ajuste?.cuentaBancaria ?? null);
        this.editando.set(false);
        this.fotoEdicion.set(null);
        this.cerrarEditor();
        this.restaurarFormulario(s);
        this.cargando.set(false);
        this.saving.set(false);
      },
      error: () => { this.cargando.set(false); this.saving.set(false); },
    });
  }

  private restaurarFormulario(s: SolicitudResponse | null): void {
    const d = s?.detalleSaldosIniciales;
    this.entidadCodigo.set(d?.entidadFinanciera ?? null);
    this.saldos.set(d?.saldos.map((x) => ({ ...x, libretas: x.libretas.map((l) => ({ ...l })) })) ?? []);
    this.seleccionSaldos.set([]);
    this.saldoDesplegado.set(null);
  }
}
