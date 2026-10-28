import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

import { FormTableSearchComponent } from '../../../../../shared/components/form-table-search/form-table-search.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import { ExpansionPanelComponent } from '../../../../../shared/ui/expansion-panel/expansion-panel.component';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { SidePanelComponent } from '../../../../../shared/ui/side-panel/side-panel.component';
import { SummaryCardComponent, SummaryCardField } from '../../../../../shared/ui/summary-card/summary-card.component';
import { TextFieldComponent } from '../../../../../shared/ui/text-field/text-field.component';
import { TooltipDirective } from '../../../../../shared/ui/tooltip/tooltip.directive';
import {
  CuentaRegistro,
  SaldoInicial,
  TIPO_COTIZACION,
  cuentaPorNumero,
  cuentasRegistroDe,
  formatoFecha,
  formatoImporte,
  redondear,
} from '../../models/saldo-inicial.model';

type LibretaVista = CuentaRegistro & { importe: number; importeNacional: number };

const contiene = (texto: string, busqueda: string): boolean => texto.toLowerCase().includes(busqueda.trim().toLowerCase());

/**
 * Panel lateral «Saldos iniciales libretas»: datos de la cuenta bancaria de un saldo y la tabla de sus cuentas de
 * registro (libretas) con importes, buscador y paginación (Figma 23870:87733 y 23870:87777).
 *
 * Lo abren «Ver cuentas de registro» en la solicitud RSIN y en la pestaña Registros de Documentos de saldos
 * iniciales: con `saldo` en `null` queda cerrado.
 */
@Component({
  selector: 'siaf-saldo-libretas-panel',
  standalone: true,
  imports: [
    ExpansionPanelComponent,
    FormTableSearchComponent,
    IconComponent,
    PaginationComponent,
    SidePanelComponent,
    SummaryCardComponent,
    TextFieldComponent,
    TooltipDirective,
  ],
  template: `
    <siaf-side-panel title="Saldos iniciales libretas" [open]="!!saldoSig()" [showFooter]="false" (closed)="closed.emit()">
      @if (saldoSig(); as s) {
        <div class="grid gap-siaf-md">
          <siaf-expansion-panel title="Cuenta bancaria" [expanded]="false">
            <div class="grid gap-siaf-lg">
              <dl class="m-0 grid gap-siaf-md px-siaf-sm sm:grid-cols-2">
                <div><dt class="siaf-text-caption-1 text-[var(--sys-color-text-neutral-low)]">Secuencia</dt><dd class="m-0 text-sm">{{ s.secuencia || '-' }}</dd></div>
                <div><dt class="siaf-text-caption-1 text-[var(--sys-color-text-neutral-low)]">Fecha de operación</dt><dd class="m-0 text-sm">{{ formatoFecha(s.fechaOperacion) }}</dd></div>
              </dl>
              <section class="grid gap-siaf-sm">
                <h4 class="m-0 text-sm font-bold uppercase text-text">Cuenta bancaria</h4>
                <siaf-summary-card [fields]="camposCuenta()" [bordered]="true" [showClose]="false" />
              </section>
              @if (s.moneda === 'USD') {
                <section class="grid gap-siaf-sm">
                  <h4 class="m-0 text-sm font-bold uppercase text-text">Tipo de cambio</h4>
                  <dl class="m-0 grid gap-siaf-md px-siaf-sm sm:grid-cols-2">
                    <div><dt class="siaf-text-caption-1 text-[var(--sys-color-text-neutral-low)]">Tipo de cotización</dt><dd class="m-0 text-sm">{{ tipoCotizacion }}</dd></div>
                    <div><dt class="siaf-text-caption-1 text-[var(--sys-color-text-neutral-low)]">Compra</dt><dd class="m-0 text-sm">{{ s.tipoCambio.toFixed(2) }}</dd></div>
                  </dl>
                </section>
              }
              <section class="grid gap-siaf-sm">
                <h4 class="m-0 text-sm font-bold uppercase text-text">Importes</h4>
                <div class="grid gap-x-siaf-lg gap-y-siaf-md md:grid-cols-2 xl:grid-cols-3">
                  <div class="relative">
                    <siaf-input label="En moneda de la cuenta" [value]="formatoImporte(s.importeCuenta)" [disabled]="true" />
                    <span
                      class="absolute right-siaf-sm top-1/2 inline-flex -translate-y-1/2 rounded-full text-[var(--sys-color-text-neutral-medium)] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                      tabindex="0"
                      role="img"
                      [attr.aria-label]="ayudaImportes"
                      [siafTooltip]="ayudaImportes"
                    >
                      <siaf-icon name="info" [size]="24" />
                    </span>
                  </div>
                  <siaf-input label="En moneda nacional" [value]="formatoImporte(s.importeNacional)" [disabled]="true" />
                </div>
              </section>
            </div>
          </siaf-expansion-panel>

          <siaf-form-table-search placeholder="Buscar" [value]="busqueda()" (valueChange)="busqueda.set($event); pagina.set(1)" />
          <div class="siaf-table-shell">
            <table class="siaf-table min-w-[960px]">
              <caption class="sr-only">Cuentas de registro de la cuenta {{ s.cuentaBancaria }}</caption>
              <thead>
                <tr class="siaf-table-head-row">
                  <th class="siaf-table-th w-[130px]" rowspan="2">F. operación</th>
                  <th class="siaf-table-th text-center" colspan="3">Cuenta de registro</th>
                  <th class="siaf-table-th text-center" colspan="2">Libretas</th>
                </tr>
                <tr class="siaf-table-head-row">
                  <th class="siaf-table-th w-[100px]">ID corr.</th>
                  <th class="siaf-table-th">Número</th>
                  <th class="siaf-table-th">Descripción</th>
                  <th class="siaf-table-th w-[170px] text-right">Imp. M. cuenta</th>
                  <th class="siaf-table-th w-[170px] text-right">Imp. M. nacional</th>
                </tr>
              </thead>
              <tbody>
                @for (libreta of tabla().filas; track libreta.idCorrelativo) {
                  <tr class="siaf-table-row">
                    <td class="siaf-table-td">{{ formatoFecha(s.fechaOperacion) }}</td>
                    <td class="siaf-table-td">{{ libreta.idCorrelativo }}</td>
                    <td class="siaf-table-td">{{ libreta.numero }}</td>
                    <td class="siaf-table-td">{{ libreta.descripcion }}</td>
                    <td class="siaf-table-td text-right">{{ formatoImporte(libreta.importe) }}</td>
                    <td class="siaf-table-td text-right">{{ formatoImporte(libreta.importeNacional) }}</td>
                  </tr>
                } @empty {
                  <tr class="siaf-table-row">
                    <td class="siaf-table-td text-center" colspan="6">No se encontraron cuentas de registro.</td>
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
            [totalItems]="filtradas().length"
            [totalPages]="tabla().totalPaginas"
            [rowsPerPage]="tamano()"
            (previous)="pagina.set(pagina() - 1)"
            (next)="pagina.set(pagina() + 1)"
            (rowsPerPageChange)="tamano.set($event); pagina.set(1)"
          />
        </div>
      }
    </siaf-side-panel>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaldoLibretasPanelComponent {
  /** Saldo a mostrar; `null` cierra el panel. Al cambiar, el buscador y la página vuelven a cero. */
  @Input() set saldo(value: SaldoInicial | null | undefined) {
    this.saldoSig.set(value ?? null);
    this.busqueda.set('');
    this.pagina.set(1);
  }

  @Output() closed = new EventEmitter<void>();

  readonly saldoSig = signal<SaldoInicial | null>(null);
  readonly busqueda = signal('');
  readonly pagina = signal(1);
  readonly tamano = signal(25);

  readonly tipoCotizacion = TIPO_COTIZACION;
  readonly ayudaImportes = 'Suma automática de las cuentas de registro.';
  readonly formatoFecha = formatoFecha;
  readonly formatoImporte = formatoImporte;

  readonly camposCuenta = computed((): SummaryCardField[] => {
    const s = this.saldoSig();
    if (!s) return [];
    return [
      { label: 'Número de cuenta', value: s.cuentaBancaria },
      { label: 'Denominación', value: cuentaPorNumero(s.cuentaBancaria)?.denominacion ?? '' },
      { label: 'Moneda', value: s.moneda },
    ];
  });

  readonly filtradas = computed((): LibretaVista[] => {
    const s = this.saldoSig();
    if (!s) return [];
    const q = this.busqueda();
    const importes = new Map(s.libretas.map((l) => [l.idCorrelativo, l.importe]));
    return cuentasRegistroDe(s.cuentaBancaria)
      .filter((l) => importes.has(l.idCorrelativo))
      .map((l) => ({ ...l, importe: importes.get(l.idCorrelativo)!, importeNacional: redondear(importes.get(l.idCorrelativo)! * s.tipoCambio) }))
      .filter((l) => !q || [l.idCorrelativo, l.numero, l.descripcion].some((v) => contiene(v, q)));
  });

  readonly tabla = computed(() => {
    const filas = this.filtradas();
    const totalPaginas = Math.max(1, Math.ceil(filas.length / this.tamano()));
    const actual = Math.min(this.pagina(), totalPaginas);
    return { filas: filas.slice((actual - 1) * this.tamano(), actual * this.tamano()), totalPaginas };
  });
}
