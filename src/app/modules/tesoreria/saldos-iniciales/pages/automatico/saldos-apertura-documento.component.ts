import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { SolicitudResponse, SolicitudesApiService } from '../../../../../core/api/solicitudes-api.service';
import { ESTADO } from '../../../../../core/models/documento.model';
import { FormTableSearchComponent } from '../../../../../shared/components/form-table-search/form-table-search.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { SolicitudeInfoCardComponent, SolicitudeInfoField } from '../../../../../shared/components/solicitude-info-card/solicitude-info-card.component';
import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { AlertComponent } from '../../../../../shared/ui/alert/alert.component';
import { DocumentSummaryCardComponent } from '../../../../../shared/ui/document-summary-card/document-summary-card.component';
import type { FlowStatus } from '../../../../../shared/ui/flow-status-tag/flow-status-tag.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { MessageBoxComponent } from '../../../../../shared/ui/message-box/message-box.component';
import { SummaryCardComponent, SummaryCardField } from '../../../../../shared/ui/summary-card/summary-card.component';
import { TooltipDirective } from '../../../../../shared/ui/tooltip/tooltip.directive';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { SaldoLibretasPanelComponent } from '../../components/saldo-libretas-panel/saldo-libretas-panel.component';
import { PROCESS_ID, PROCESS_ROUTE } from '../../config/saldos-iniciales.rutas';
import {
  ENTE_RECTOR,
  MOVIMIENTO_INTERNO_APERTURA,
  NOMBRE_AUTOMATICO,
  PERIODO,
  SaldoInicial,
  TIPO_OPERACION_APERTURA,
  entidadPorCodigo,
  formatoFecha,
  formatoImporte,
} from '../../models/saldo-inicial.model';
import { descargarSaldosApertura } from '../../utils/saldos-apertura-export.util';

const contiene = (texto: string, busqueda: string): boolean => texto.toLowerCase().includes(busqueda.trim().toLowerCase());

/** dd/mm/aaaa hh:mm:ss, como el Figma. */
function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '';
  const f = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()}   ${dos(f.getHours())}:${dos(f.getMinutes())}:${dos(f.getSeconds())}`;
}

/**
 * «Registro automático de saldos de apertura» (Figma 23220:68135): documento que crea el sistema, sin intervención de
 * usuarios. Es de solo lectura y pasa de Registrado a Procesado; al procesarse, sus saldos reciben secuencia y pasan a
 * la pestaña Registros. El aviso permite descargar los saldos en Excel.
 */
@Component({
  selector: 'siaf-saldos-apertura-documento',
  standalone: true,
  imports: [
    AlertComponent,
    DocumentSummaryCardComponent,
    FormTableSearchComponent,
    IconComponent,
    MessageBoxComponent,
    PaginationComponent,
    SaldoLibretasPanelComponent,
    SolicitudeFormCardComponent,
    SolicitudeInfoCardComponent,
    SolicitudePageLayoutComponent,
    SummaryCardComponent,
    TooltipDirective,
  ],
  template: `
    <div class="min-h-[calc(100vh-56px)] bg-[var(--sys-color-bg-surfaces-surface-lowest)] text-text">
      <siaf-solicitude-page-layout
        [breadcrumbs]="breadcrumbs"
        [heading]="heading"
        secondaryText="Creación"
        [showReturn]="true"
        [showTag]="false"
        [customActions]="true"
        [showButtonGroup]="false"
        [loading]="cargando()"
        (returned)="regresar()"
      >
        @if (cargando()) {
          <div class="rounded-siaf-md bg-surface p-siaf-xl">
            <div class="grid grid-cols-3 gap-siaf-md">
              @for (i of [1, 2, 3]; track i) {
                <div class="siaf-skeleton-pulse h-4 w-32 rounded bg-[var(--sys-color-bg-surfaces-surface-low)]"></div>
              }
            </div>
          </div>
        } @else if (solicitud(); as s) {
          <siaf-alert tone="info" title="Este documento se generó automáticamente">
            <span class="siaf-text-caption-1">
              La información corresponde a un procesado automático realizado por el sistema.
              <button
                class="siaf-text-caption-1-bold cursor-pointer border-0 bg-transparent p-0 text-inherit underline-offset-2 hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                type="button"
                (click)="descargar()"
              >
                Descargar archivo aquí
              </button>
            </span>
          </siaf-alert>

          <section class="grid gap-siaf-md lg:grid-cols-[1fr_360px]">
            <siaf-solicitude-info-card [fields]="cabecera()" />
            <siaf-document-summary-card [documentNumber]="s.numero ?? ''" [status]="estado()" />
          </section>

          <siaf-solicitude-form-card title="Tipo de operación del saldo">
            <dl class="m-0 grid gap-siaf-md px-siaf-sm sm:grid-cols-3">
              <div>
                <dt class="siaf-text-caption-1 text-[var(--sys-color-text-neutral-low)]">Tipo de operación del saldo</dt>
                <dd class="m-0 text-sm">{{ tipoOperacion }}</dd>
              </div>
              <div>
                <dt class="siaf-text-caption-1 text-[var(--sys-color-text-neutral-low)]">Periodo</dt>
                <dd class="m-0 text-sm">{{ periodo }}</dd>
              </div>
            </dl>
          </siaf-solicitude-form-card>

          <siaf-solicitude-form-card title="Movimiento interno">
            <siaf-summary-card [fields]="camposMovimiento" [bordered]="true" [showClose]="false" />
          </siaf-solicitude-form-card>

          <siaf-solicitude-form-card title="Entidad financiera">
            <siaf-summary-card [fields]="camposEntidad()" [bordered]="true" [showClose]="false" />
          </siaf-solicitude-form-card>

          <siaf-solicitude-form-card title="Saldos iniciales libro bancos">
            <div class="grid gap-siaf-md">
              <siaf-form-table-search placeholder="Buscar" [value]="busqueda()" (valueChange)="busqueda.set($event); pagina.set(1)" />
              <div class="siaf-table-shell">
                <table class="siaf-table min-w-[900px]">
                  <caption class="sr-only">Saldos iniciales libro bancos del documento {{ s.numero }}</caption>
                  <thead>
                    <tr class="siaf-table-head-row">
                      <th class="siaf-table-th w-[100px]" rowspan="2">Sec.</th>
                      <th class="siaf-table-th w-[130px]" rowspan="2">F. operación</th>
                      <th class="siaf-table-th text-center" colspan="2">Cuenta bancaria</th>
                      <th class="siaf-table-th text-center" colspan="2">Libro bancos</th>
                      <th class="siaf-table-th w-[64px]" rowspan="2"><span class="sr-only">Acciones</span></th>
                    </tr>
                    <tr class="siaf-table-head-row">
                      <th class="siaf-table-th">Número</th>
                      <th class="siaf-table-th w-[100px]">Moneda</th>
                      <th class="siaf-table-th w-[170px] text-right">Imp. M. cuenta</th>
                      <th class="siaf-table-th w-[170px] text-right">Imp. M. nacional</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (saldo of tabla().filas; track saldo.id) {
                      <tr class="siaf-table-row">
                        <td class="siaf-table-td">{{ saldo.secuencia || '-' }}</td>
                        <td class="siaf-table-td">{{ formatoFecha(saldo.fechaOperacion) }}</td>
                        <td class="siaf-table-td font-mono">{{ saldo.cuentaBancaria }}</td>
                        <td class="siaf-table-td">{{ saldo.moneda }}</td>
                        <td class="siaf-table-td text-right">{{ formatoImporte(saldo.importeCuenta) }}</td>
                        <td class="siaf-table-td text-right">{{ formatoImporte(saldo.importeNacional) }}</td>
                        <td class="siaf-table-td">
                          <button
                            class="inline-flex size-8 items-center justify-center rounded-siaf-md transition hover:bg-surface-muted focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                            type="button"
                            [attr.aria-label]="'Ver cuentas de registro de ' + saldo.cuentaBancaria"
                            siafTooltip="Ver cuentas de registro"
                            (click)="saldoVisto.set(saldo)"
                          >
                            <siaf-icon name="table_view" [size]="20" />
                          </button>
                        </td>
                      </tr>
                    } @empty {
                      <tr class="siaf-table-row">
                        <td class="siaf-table-td text-center" colspan="7">No se encontraron saldos.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <siaf-pagination
                navigation="Activate"
                position="Bottom"
                [rowPage]="true"
                [page]="pagina()"
                [pageSize]="tamano()"
                [totalItems]="filtrados().length"
                [totalPages]="tabla().totalPaginas"
                [rowsPerPage]="tamano()"
                (previous)="pagina.set(pagina() - 1)"
                (next)="pagina.set(pagina() + 1)"
                (rowsPerPageChange)="tamano.set($event); pagina.set(1)"
              />
            </div>
          </siaf-solicitude-form-card>

          <siaf-solicitude-form-card>
            <dl class="m-0 grid gap-siaf-md sm:grid-cols-2">
              <div class="grid gap-siaf-xs">
                <div>
                  <dt class="siaf-text-overline-medium text-[var(--sys-color-text-neutral-low)]">Registrado por</dt>
                  <dd class="m-0 text-sm font-bold">{{ sistema }}</dd>
                </div>
                <div>
                  <dt class="siaf-text-overline-medium text-[var(--sys-color-text-neutral-low)]">Fecha</dt>
                  <dd class="m-0 whitespace-pre text-sm font-bold">{{ fechaRegistrado() }}</dd>
                </div>
              </div>
              <div class="grid gap-siaf-xs">
                <div>
                  <dt class="siaf-text-overline-medium text-[var(--sys-color-text-neutral-low)]">Procesado por</dt>
                  <dd class="m-0 text-sm font-bold">{{ fechaProcesado() ? sistema : '-' }}</dd>
                </div>
                <div>
                  <dt class="siaf-text-overline-medium text-[var(--sys-color-text-neutral-low)]">Fecha</dt>
                  <dd class="m-0 whitespace-pre text-sm font-bold">{{ fechaProcesado() || '-' }}</dd>
                </div>
              </div>
            </dl>
          </siaf-solicitude-form-card>
        } @else {
          <siaf-solicitude-form-card>
            <message-box text="No se encontró el documento. Vuelva a la lista de documentos." />
          </siaf-solicitude-form-card>
        }
      </siaf-solicitude-page-layout>
    </div>

    <siaf-saldo-libretas-panel [saldo]="saldoVisto()" (closed)="saldoVisto.set(null)" />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaldosAperturaDocumentoComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly solicitudesApi = inject(SolicitudesApiService);

  readonly heading = NOMBRE_AUTOMATICO;
  readonly breadcrumbs = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE);
  readonly tipoOperacion = TIPO_OPERACION_APERTURA;
  readonly periodo = PERIODO;
  readonly sistema = 'SIAF RP';
  readonly formatoFecha = formatoFecha;
  readonly formatoImporte = formatoImporte;

  readonly cargando = signal(true);
  readonly solicitud = signal<SolicitudResponse | null>(null);
  readonly saldoVisto = signal<SaldoInicial | null>(null);

  readonly estado = computed((): FlowStatus => (this.solicitud()?.estado === 'PROCESADO' ? ESTADO.PROCESADO : ESTADO.REGISTRADO));

  readonly cabecera = computed((): SolicitudeInfoField[] => [
    { label: 'Fecha', value: fechaHora(this.solicitud()?.createdAt) },
    { label: 'Ente rector', value: ENTE_RECTOR.toUpperCase() },
    { label: 'Entidad', value: (this.solicitud()?.entidadCreadora?.nombre ?? '').toUpperCase() },
  ]);

  readonly camposMovimiento: SummaryCardField[] = [
    { label: 'Código', value: MOVIMIENTO_INTERNO_APERTURA.codigo },
    { label: 'Denominación', value: MOVIMIENTO_INTERNO_APERTURA.denominacion },
    { label: 'Naturaleza del movimiento', value: MOVIMIENTO_INTERNO_APERTURA.naturaleza },
    { label: 'Sigla', value: MOVIMIENTO_INTERNO_APERTURA.sigla },
  ];

  readonly camposEntidad = computed((): SummaryCardField[] => {
    const e = entidadPorCodigo(this.solicitud()?.detalleSaldosIniciales?.entidadFinanciera);
    return e
      ? [
          { label: 'Tipo', value: e.tipo },
          { label: 'Código', value: e.codigo },
          { label: 'Denominación', value: e.denominacion },
          { label: 'Sigla', value: e.sigla },
        ]
      : [];
  });

  /** Fecha de cada paso del historial (lo hace el sistema). */
  private fechaDe(estado: string): string {
    return fechaHora(this.solicitud()?.historialEstados?.find((h) => h.estadoNuevo === estado)?.createdAt);
  }
  readonly fechaRegistrado = computed(() => this.fechaDe('REGISTRADO'));
  readonly fechaProcesado = computed(() => this.fechaDe('PROCESADO'));

  // ── Tabla de saldos ───────────────────────────────────────────────
  readonly busqueda = signal('');
  readonly pagina = signal(1);
  readonly tamano = signal(25);
  readonly filtrados = computed(() => {
    const q = this.busqueda();
    return (this.solicitud()?.detalleSaldosIniciales?.saldos ?? []).filter(
      (s) => !q || [s.secuencia ?? '', s.cuentaBancaria, s.moneda, formatoFecha(s.fechaOperacion)].some((v) => contiene(v, q)),
    );
  });
  readonly tabla = computed(() => {
    const filas = this.filtrados();
    const totalPaginas = Math.max(1, Math.ceil(filas.length / this.tamano()));
    const actual = Math.min(this.pagina(), totalPaginas);
    return { filas: filas.slice((actual - 1) * this.tamano(), actual * this.tamano()), totalPaginas };
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.solicitudesApi.obtenerDetalle(id).subscribe({
      next: (s) => { this.solicitud.set(s); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  descargar(): void {
    const s = this.solicitud();
    const d = s?.detalleSaldosIniciales;
    if (s && d) void descargarSaldosApertura(s.numero ?? '', d.entidadFinanciera, d.saldos);
  }

  regresar(): void {
    void this.router.navigate([PROCESS_ROUTE]);
  }
}
