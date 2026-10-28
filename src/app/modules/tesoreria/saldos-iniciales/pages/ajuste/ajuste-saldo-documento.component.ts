import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { SolicitudResponse, SolicitudesApiService } from '../../../../../core/api/solicitudes-api.service';
import { ESTADO } from '../../../../../core/models/documento.model';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { SolicitudeInfoCardComponent, SolicitudeInfoField } from '../../../../../shared/components/solicitude-info-card/solicitude-info-card.component';
import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { DocumentSummaryCardComponent } from '../../../../../shared/ui/document-summary-card/document-summary-card.component';
import type { FlowStatus } from '../../../../../shared/ui/flow-status-tag/flow-status-tag.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { MessageBoxComponent } from '../../../../../shared/ui/message-box/message-box.component';
import { SidePanelComponent } from '../../../../../shared/ui/side-panel/side-panel.component';
import { SummaryCardComponent, SummaryCardField } from '../../../../../shared/ui/summary-card/summary-card.component';
import { TooltipDirective } from '../../../../../shared/ui/tooltip/tooltip.directive';
import { UploadedFileCardComponent, UploadedFileInfo } from '../../../../../shared/ui/uploaded-file-card/uploaded-file-card.component';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { SaldoLibretasPanelComponent } from '../../components/saldo-libretas-panel/saldo-libretas-panel.component';
import { PROCESS_ID, PROCESS_ROUTE } from '../../config/saldos-iniciales.rutas';
import {
  ENTE_RECTOR,
  MOVIMIENTO_INTERNO_AJUSTE,
  NOMBRE_DOCUMENTO,
  PERIODO,
  SaldoInicial,
  TIPO_OPERACION_AJUSTE,
  entidadPorCodigo,
  formatoFecha,
  formatoImporte,
  saldoActualizado,
} from '../../models/saldo-inicial.model';

/** dd/mm/aaaa hh:mm:ss. */
function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '';
  const f = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()}   ${dos(f.getHours())}:${dos(f.getMinutes())}:${dos(f.getSeconds())}`;
}

const ESTADOS: Record<string, FlowStatus> = {
  APROBADO: ESTADO.APROBADO,
  OBSERVADO: ESTADO.OBSERVADO,
  RECHAZADO: ESTADO.RECHAZADO,
  VERIFICADO: ESTADO.VERIFICADO,
};

/**
 * «Registro de saldos iniciales» con tipo de operación «2 - Ajuste de saldo inicial» (Figma 28143:169763). El ajuste
 * se autoriza en otro módulo y se hace sobre UNA cuenta bancaria ya registrada: suma (crédito) o resta (débito) a su
 * saldo. Vista de solo lectura: el flujo de creación llega después.
 */
@Component({
  selector: 'siaf-ajuste-saldo-documento',
  standalone: true,
  imports: [
    DocumentSummaryCardComponent,
    IconComponent,
    MessageBoxComponent,
    SaldoLibretasPanelComponent,
    SidePanelComponent,
    SolicitudeFormCardComponent,
    SolicitudeInfoCardComponent,
    SolicitudePageLayoutComponent,
    SummaryCardComponent,
    TooltipDirective,
    UploadedFileCardComponent,
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

          <siaf-solicitude-form-card title="Ajuste de saldo inicial libro bancos">
            <div class="siaf-table-shell">
              <table class="siaf-table min-w-[1100px]">
                <caption class="sr-only">Ajuste de saldo inicial del documento {{ s.numero }}</caption>
                <thead>
                  <tr class="siaf-table-head-row">
                    <th class="siaf-table-th w-[120px]" rowspan="2">F. operación</th>
                    <th class="siaf-table-th w-[100px]" rowspan="2">Sec. ref.</th>
                    <th class="siaf-table-th text-center" colspan="2">Cuenta bancaria</th>
                    <th class="siaf-table-th text-center" colspan="2">{{ naturaleza() }}</th>
                    <th class="siaf-table-th w-[150px] text-right" rowspan="2">Saldo inicial</th>
                    <th class="siaf-table-th w-[150px] text-right" rowspan="2">Saldo act.</th>
                    <th class="siaf-table-th w-[96px]" rowspan="2"><span class="sr-only">Acciones</span></th>
                  </tr>
                  <tr class="siaf-table-head-row">
                    <th class="siaf-table-th">Número</th>
                    <th class="siaf-table-th w-[90px]">Moneda</th>
                    <th class="siaf-table-th w-[150px] text-right">Imp. M. cuenta</th>
                    <th class="siaf-table-th w-[150px] text-right">Imp. M. nacional</th>
                  </tr>
                </thead>
                <tbody>
                  @for (saldo of saldos(); track saldo.id) {
                    <tr class="siaf-table-row">
                      <td class="siaf-table-td">{{ formatoFecha(saldo.fechaOperacion) }}</td>
                      <td class="siaf-table-td">{{ saldo.ajuste?.secuenciaReferencia || '-' }}</td>
                      <td class="siaf-table-td">{{ saldo.cuentaBancaria }}</td>
                      <td class="siaf-table-td">{{ saldo.moneda }}</td>
                      <td class="siaf-table-td text-right">{{ formatoImporte(saldo.importeCuenta) }}</td>
                      <td class="siaf-table-td text-right">{{ formatoImporte(saldo.importeNacional) }}</td>
                      <td class="siaf-table-td text-right">{{ formatoImporte(saldo.ajuste?.saldoInicial) }}</td>
                      <td class="siaf-table-td text-right">{{ formatoImporte(actualizado(saldo)) }}</td>
                      <td class="siaf-table-td">
                        <div class="flex gap-siaf-xxs">
                          <button
                            class="inline-flex size-8 items-center justify-center rounded-siaf-md transition hover:bg-surface-muted disabled:opacity-40 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                            type="button"
                            [disabled]="!saldo.sustento"
                            [attr.aria-label]="'Ver documento de sustento de ' + saldo.cuentaBancaria"
                            siafTooltip="Ver documento de sustento"
                            (click)="sustentoVisto.set({ name: saldo.sustento! })"
                          >
                            <siaf-icon name="description" [size]="20" />
                          </button>
                          <button
                            class="inline-flex size-8 items-center justify-center rounded-siaf-md transition hover:bg-surface-muted focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                            type="button"
                            [attr.aria-label]="'Ver cuentas de registro de ' + saldo.cuentaBancaria"
                            siafTooltip="Ver cuentas de registro"
                            (click)="saldoVisto.set(saldo)"
                          >
                            <siaf-icon name="table_view" [size]="20" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </siaf-solicitude-form-card>

          <siaf-solicitude-form-card>
            <dl class="m-0 grid gap-siaf-md sm:grid-cols-3">
              @for (paso of pasos(); track paso.etiqueta) {
                <div class="grid gap-siaf-xs">
                  <div>
                    <dt class="siaf-text-overline-medium text-[var(--sys-color-text-neutral-low)]">{{ paso.etiqueta }}</dt>
                    <dd class="m-0 text-sm font-bold">{{ paso.usuario || '-' }}</dd>
                  </div>
                  <div>
                    <dt class="siaf-text-overline-medium text-[var(--sys-color-text-neutral-low)]">Fecha</dt>
                    <dd class="m-0 whitespace-pre text-sm font-bold">{{ paso.fecha || '-' }}</dd>
                  </div>
                </div>
              }
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

    <siaf-side-panel title="Documento de sustento" [open]="!!sustentoVisto()" [showFooter]="false" (closed)="sustentoVisto.set(null)">
      @if (sustentoVisto(); as archivo) {
        <siaf-uploaded-file-card [file]="archivo" [readonly]="true" />
      }
    </siaf-side-panel>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AjusteSaldoDocumentoComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly solicitudesApi = inject(SolicitudesApiService);

  readonly heading = NOMBRE_DOCUMENTO;
  readonly breadcrumbs = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE);
  readonly tipoOperacion = TIPO_OPERACION_AJUSTE;
  readonly periodo = PERIODO;
  readonly formatoFecha = formatoFecha;
  readonly formatoImporte = formatoImporte;

  readonly cargando = signal(true);
  readonly solicitud = signal<SolicitudResponse | null>(null);
  readonly saldoVisto = signal<SaldoInicial | null>(null);
  readonly sustentoVisto = signal<UploadedFileInfo | null>(null);

  readonly saldos = computed(() => this.solicitud()?.detalleSaldosIniciales?.saldos ?? []);
  /** Encabezado de los importes: «Crédito» o «Débito» según el ajuste. */
  readonly naturaleza = computed(() => this.saldos()[0]?.ajuste?.naturaleza ?? 'Crédito');
  readonly estado = computed((): FlowStatus => ESTADOS[this.solicitud()?.estado ?? ''] ?? ESTADO.ELABORADO);

  readonly cabecera = computed((): SolicitudeInfoField[] => [
    { label: 'Fecha', value: fechaHora(this.solicitud()?.createdAt) },
    { label: 'Ente rector', value: ENTE_RECTOR.toUpperCase() },
    { label: 'Entidad', value: (this.solicitud()?.entidadCreadora?.nombre ?? '').toUpperCase() },
  ]);

  readonly camposMovimiento: SummaryCardField[] = [
    { label: 'Código', value: MOVIMIENTO_INTERNO_AJUSTE.codigo },
    { label: 'Denominación', value: MOVIMIENTO_INTERNO_AJUSTE.denominacion },
    { label: 'Naturaleza del movimiento', value: MOVIMIENTO_INTERNO_AJUSTE.naturaleza },
    { label: 'Sigla', value: MOVIMIENTO_INTERNO_AJUSTE.sigla },
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

  /** Elaborado, verificado y aprobado por: usuario y fecha de cada paso del historial. */
  readonly pasos = computed(() => {
    const historial = this.solicitud()?.historialEstados ?? [];
    const paso = (etiqueta: string, estado: string) => {
      const h = [...historial].reverse().find((x) => x.estadoNuevo === estado);
      const c = h?.creador;
      return {
        etiqueta,
        usuario: c ? [c.nombres, c.apellidoPaterno, c.apellidoMaterno].filter(Boolean).join(' ').toUpperCase() : '',
        fecha: fechaHora(h?.createdAt),
      };
    };
    return [paso('Elaborado por', 'ELABORADO'), paso('Verificado por', 'VERIFICADO'), paso('Aprobado por', 'APROBADO')];
  });

  actualizado(saldo: SaldoInicial): number {
    return saldo.ajuste ? saldoActualizado(saldo.ajuste.saldoInicial, saldo.importeCuenta, saldo.ajuste.naturaleza) : saldo.importeCuenta;
  }

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.solicitudesApi.obtenerDetalle(id).subscribe({
      next: (s) => { this.solicitud.set(s); this.cargando.set(false); },
      error: () => this.cargando.set(false),
    });
  }

  regresar(): void {
    void this.router.navigate([PROCESS_ROUTE]);
  }
}
