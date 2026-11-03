import { ABREVIATURAS } from '../../../../../shared/utils/abreviaturas.util';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

import { FormTableSearchComponent } from '../../../../../shared/components/form-table-search/form-table-search.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import { ExpansionPanelComponent } from '../../../../../shared/ui/expansion-panel/expansion-panel.component';
import { SidePanelComponent } from '../../../../../shared/ui/side-panel/side-panel.component';
import { SummaryCardComponent, SummaryCardField } from '../../../../../shared/ui/summary-card/summary-card.component';
import { ReadonlyFieldComponent } from '../../../../../shared/ui/readonly-field/readonly-field.component';
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
  saldoActualizado,
} from '../../models/saldo-inicial.model';

type LibretaVista = CuentaRegistro & { importe: number; importeNacional: number; saldoInicial: number; saldoActual: number };

const contiene = (texto: string, busqueda: string): boolean => texto.toLowerCase().includes(busqueda.trim().toLowerCase());

/**
 * Panel lateral «Saldos iniciales libretas»: datos de la cuenta bancaria de un saldo y la tabla de sus cuentas de
 * registro (libretas) con importes, buscador y paginación (Figma 23870:87733 y 23870:87777).
 *
 * En un ajuste (Figma 32428:112208) el título es «Ajuste de saldo inicial libretas» y suma la secuencia de referencia,
 * la sección «Saldo inicial» (importe inicial, naturaleza y saldo actualizado) y el saldo actualizado de cada libreta.
 *
 * Lo abren «Ver saldos iniciales libretas» en la solicitud RSIN y en la pestaña Registros de Documentos de saldos
 * iniciales: con `saldo` en `null` queda cerrado.
 */
@Component({
  selector: 'siaf-saldo-libretas-panel',
  standalone: true,
  imports: [
    ExpansionPanelComponent,
    FormTableSearchComponent,
    PaginationComponent,
    SidePanelComponent,
    SummaryCardComponent,
    ReadonlyFieldComponent,
    TooltipDirective,
  ],
  template: `
    <siaf-side-panel [title]="saldoSig()?.ajuste ? 'Ajuste de saldo inicial libretas' : 'Saldos iniciales libretas'" [open]="!!saldoSig()" [showFooter]="false" (closed)="closed.emit()">
      @if (saldoSig(); as s) {
        <div class="grid gap-siaf-md">
          <siaf-expansion-panel title="Cuenta bancaria" [expanded]="false">
            <div class="grid gap-siaf-lg">
              <div class="grid gap-x-siaf-lg gap-y-siaf-md" [class.sm:grid-cols-2]="!s.ajuste" [class.sm:grid-cols-3]="!!s.ajuste">
                <readonly-field caption="Secuencia" [value]="s.secuencia" />
                <readonly-field caption="Fecha de operación" [value]="formatoFecha(s.fechaOperacion)" />
                @if (s.ajuste) {
                  <readonly-field caption="Secuencia de referencia" [value]="s.ajuste.secuenciaReferencia" />
                }
              </div>
              <section class="grid gap-siaf-sm">
                <h4 class="m-0 text-sm font-bold uppercase text-text">Cuenta bancaria</h4>
                <siaf-summary-card [fields]="camposCuenta()" [bordered]="true" [showClose]="false" />
              </section>
              @if (s.moneda === 'USD') {
                <section class="grid gap-siaf-sm">
                  <h4 class="m-0 text-sm font-bold uppercase text-text">Tipo de cambio</h4>
                  <div class="grid gap-x-siaf-lg gap-y-siaf-md sm:grid-cols-2">
                    <readonly-field caption="Tipo de cotización" [value]="tipoCotizacion" />
                    <readonly-field caption="Compra" [value]="s.tipoCambio.toFixed(2)" />
                  </div>
                </section>
              }
              @if (s.ajuste; as a) {
                <section class="grid gap-siaf-sm">
                  <h4 class="m-0 text-sm font-bold uppercase text-text">Saldo inicial</h4>
                  <div class="grid gap-x-siaf-lg gap-y-siaf-md md:grid-cols-2 xl:grid-cols-3">
                    <readonly-field caption="Importe de saldo inicial" [value]="formatoImporte(a.saldoInicial)" [bold]="true" [highlight]="true" />
                    <readonly-field caption="Naturaleza de la operación" [value]="a.naturaleza" [bold]="true" [highlight]="true" />
                    <readonly-field caption="Saldo actualizado" [value]="formatoImporte(saldoActualizado(a.saldoInicial, s.importeCuenta, a.naturaleza))" [bold]="true" [highlight]="true" />
                  </div>
                </section>
              }
              <section class="grid gap-siaf-sm">
                <h4 class="m-0 text-sm font-bold uppercase text-text">Importes</h4>
                <div class="grid gap-x-siaf-lg gap-y-siaf-md md:grid-cols-2 xl:grid-cols-3">
                  <readonly-field caption="En moneda de la cuenta" [value]="formatoImporte(s.importeCuenta)" [bold]="true" [highlight]="true" [help]="ayudaImportes" />
                  <readonly-field caption="En moneda nacional" [value]="formatoImporte(s.importeNacional)" [bold]="true" [highlight]="true" />
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
                  <th class="siaf-table-th w-[130px]" rowspan="2" [siafTooltip]="abrev.fechaOperacion.termino">{{ abrev.fechaOperacion.abreviatura }}</th>
                  <th class="siaf-table-th siaf-table-th--grupo" colspan="3">Cuenta de registro</th>
                  <th class="siaf-table-th siaf-table-th--grupo" colspan="2">Libretas</th>
                  @if (s.ajuste) {
                    <th class="siaf-table-th siaf-table-th--grupo" colspan="2">Saldo</th>
                  }
                </tr>
                <tr class="siaf-table-head-row">
                  <th class="siaf-table-th siaf-table-th--grupo-inicio w-[100px]" [siafTooltip]="abrev.idCorrelativo.termino">{{ abrev.idCorrelativo.abreviatura }}</th>
                  <th class="siaf-table-th">Número</th>
                  <th class="siaf-table-th siaf-table-th--grupo-fin">Descripción</th>
                  <th class="siaf-table-th siaf-table-th--grupo-inicio w-[170px] text-right" [siafTooltip]="abrev.importeCuenta.termino">{{ abrev.importeCuenta.abreviatura }}</th>
                  <th class="siaf-table-th siaf-table-th--grupo-fin w-[170px] text-right" [siafTooltip]="abrev.importeNacional.termino">{{ abrev.importeNacional.abreviatura }}</th>
                  @if (s.ajuste) {
                    <th class="siaf-table-th siaf-table-th--grupo-inicio w-[150px] text-right" [siafTooltip]="abrev.saldoInicial.termino">{{ abrev.saldoInicial.abreviatura }}</th>
                    <th class="siaf-table-th siaf-table-th--grupo-fin w-[150px] text-right" [siafTooltip]="abrev.saldoActualizadoEnGrupo.termino">{{ abrev.saldoActualizadoEnGrupo.abreviatura }}</th>
                  }
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
                    @if (s.ajuste) {
                      <td class="siaf-table-td text-right">{{ formatoImporte(libreta.saldoInicial) }}</td>
                      <td class="siaf-table-td text-right">{{ formatoImporte(libreta.saldoActual) }}</td>
                    }
                  </tr>
                } @empty {
                  <tr class="siaf-table-row">
                    <td class="siaf-table-td text-center" [attr.colspan]="s.ajuste ? 8 : 6">No se encontraron cuentas de registro.</td>
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
  /** Abreviaturas de las cabeceras (tooltip con el término completo). */
  readonly abrev = ABREVIATURAS;
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
  readonly ayudaImportes = 'Suma automática de los importes de las cuentas de registros.';
  readonly formatoFecha = formatoFecha;
  readonly formatoImporte = formatoImporte;
  readonly saldoActualizado = saldoActualizado;

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
    const libretas = new Map(s.libretas.map((l) => [l.idCorrelativo, l]));
    // En un ajuste: saldo de la libreta antes del ajuste, para calcular su saldo actualizado.
    const iniciales = new Map((s.ajuste?.libretasIniciales ?? []).map((l) => [l.idCorrelativo, l.importe]));
    return cuentasRegistroDe(s.cuentaBancaria)
      .filter((l) => libretas.has(l.idCorrelativo))
      .map((l) => {
        const libreta = libretas.get(l.idCorrelativo)!;
        return {
          ...l,
          importe: libreta.importe,
          importeNacional: redondear(libreta.importe * s.tipoCambio),
          saldoInicial: iniciales.get(l.idCorrelativo) ?? 0,
          saldoActual: s.ajuste ? saldoActualizado(iniciales.get(l.idCorrelativo) ?? 0, libreta.importe, libreta.naturaleza ?? s.ajuste.naturaleza) : 0,
        };
      })
      .filter((l) => !q || [l.idCorrelativo, l.numero, l.descripcion].some((v) => contiene(v, q)));
  });

  readonly tabla = computed(() => {
    const filas = this.filtradas();
    const totalPaginas = Math.max(1, Math.ceil(filas.length / this.tamano()));
    const actual = Math.min(this.pagina(), totalPaginas);
    return { filas: filas.slice((actual - 1) * this.tamano(), actual * this.tamano()), totalPaginas };
  });
}
