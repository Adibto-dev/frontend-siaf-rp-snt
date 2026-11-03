import { ABREVIATURAS } from '../../../../../shared/utils/abreviaturas.util';
import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';

import { FormTableSearchComponent } from '../../../../../shared/components/form-table-search/form-table-search.component';
import { PaginationComponent } from '../../../../../shared/components/pagination/pagination.component';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { MessageBoxComponent } from '../../../../../shared/ui/message-box/message-box.component';
import { RecordStatusTagComponent } from '../../../../../shared/ui/record-status-tag/record-status-tag.component';
import { ReadonlyFieldComponent } from '../../../../../shared/ui/readonly-field/readonly-field.component';
import { TooltipDirective } from '../../../../../shared/ui/tooltip/tooltip.directive';
import { UploadedFileCardComponent } from '../../../../../shared/ui/uploaded-file-card/uploaded-file-card.component';
import { SummaryCardComponent, type SummaryCardField } from '../../../../../shared/ui/summary-card/summary-card.component';
import { SustentoVisorComponent } from '../sustento-visor/sustento-visor.component';
import { archivoDeSustento, type SaldoConSustento } from '../../utils/sustento-pdf.util';
import {
  MOVIMIENTO_INTERNO,
  MOVIMIENTO_INTERNO_AJUSTE,
  MOVIMIENTO_INTERNO_APERTURA,
  PERIODO,
  SaldoInicialRegistro,
  TIPO_COTIZACION,
  TIPO_OPERACION,
  TIPO_OPERACION_AJUSTE,
  TIPO_OPERACION_APERTURA,
  cuentaPorNumero,
  cuentasRegistroDe,
  entidadPorCodigo,
  formatoFecha,
  formatoImporte,
  redondear,
  saldoActualizado,
} from '../../models/saldo-inicial.model';

const contiene = (texto: string, busqueda: string): boolean => texto.toLowerCase().includes(busqueda.trim().toLowerCase());

/** Un dato de solo lectura: etiqueta arriba y valor abajo, como en el Figma. */
interface Dato {
  etiqueta: string;
  valor: string;
}

/**
 * Bloque de solo lectura con la información consolidada de un saldo registrado: tipo de operación, movimiento interno,
 * entidad financiera y el saldo (cuenta bancaria, tipo de cambio, importes, cuentas de registro, sustento y estado).
 * Se adapta al origen del registro: saldo inicial (SI0001), apertura automática (SIA001) o ajuste (ASC002).
 * Lo usan la página «Detalle del saldo inicial» y el panel de historial del registro.
 */
@Component({
  selector: 'siaf-saldo-detalle',
  standalone: true,
  imports: [
    FormTableSearchComponent,
    MessageBoxComponent,
    NgTemplateOutlet,
    PaginationComponent,
    RecordStatusTagComponent,
    SolicitudeFormCardComponent,
    SummaryCardComponent,
    ReadonlyFieldComponent,
    TooltipDirective,
    UploadedFileCardComponent,
    SustentoVisorComponent,
  ],
  template: `
    <siaf-saldo-sustento-visor [saldo]="sustentoVisto()" (closed)="sustentoVisto.set(null)" />

    @if (registro(); as r) {
      <div class="flex flex-col gap-siaf-md">
        <!-- Tipo de operación del saldo -->
        <siaf-solicitude-form-card [bordered]="lineal" title="Tipo de operación del saldo">
          <ng-container *ngTemplateOutlet="datos; context: { $implicit: tipoOperacion() }" />
        </siaf-solicitude-form-card>
  
        <!-- Movimiento interno -->
        <siaf-solicitude-form-card [bordered]="lineal" title="Movimiento interno">
          <siaf-summary-card [fields]="tarjeta(movimiento())" [bordered]="true" [showClose]="false" />
        </siaf-solicitude-form-card>
  
        <!-- Entidad financiera -->
        <siaf-solicitude-form-card [bordered]="lineal" title="Entidad financiera">
          <siaf-summary-card [fields]="tarjeta(entidad())" [bordered]="true" [showClose]="false" />
        </siaf-solicitude-form-card>
  
        <!-- Saldo inicial libro bancos -->
        <siaf-solicitude-form-card [bordered]="lineal" [title]="r.ajuste ? 'Ajuste de saldo inicial libro bancos' : 'Saldo inicial libro bancos'">
          <div class="grid gap-siaf-lg">
            <dl class="m-0 grid gap-siaf-md px-siaf-sm sm:grid-cols-3">
              <div>
                <dt class="siaf-text-caption-1 text-[var(--sys-color-text-neutral-low)]">Secuencia</dt>
                <dd class="m-0 text-sm">{{ r.secuencia || '-' }}</dd>
              </div>
              <div>
                <dt class="siaf-text-caption-1 text-[var(--sys-color-text-neutral-low)]">Fecha de operación</dt>
                <dd class="m-0 text-sm">{{ formatoFecha(r.fechaOperacion) }}</dd>
              </div>
              @if (r.ajuste) {
                <div>
                  <dt class="siaf-text-caption-1 text-[var(--sys-color-text-neutral-low)]">Secuencia de referencia</dt>
                  <dd class="m-0 text-sm">{{ r.ajuste.secuenciaReferencia }}</dd>
                </div>
              }
            </dl>
  
            <section class="grid gap-siaf-sm">
              <h4 class="m-0 text-sm font-bold uppercase text-text">Cuenta bancaria</h4>
              <siaf-summary-card [fields]="tarjeta(cuenta())" [bordered]="true" [showClose]="false" />
            </section>
  
            @if (r.moneda === 'USD') {
              <section class="grid gap-siaf-sm">
                <h4 class="m-0 text-sm font-bold uppercase text-text">Tipo de cambio</h4>
                <ng-container *ngTemplateOutlet="datos; context: { $implicit: cambio() }" />
              </section>
            }
  
            @if (r.ajuste) {
              <section class="grid gap-siaf-sm">
                <h4 class="m-0 text-sm font-bold uppercase text-text">Saldo inicial</h4>
                <div class="grid gap-x-siaf-lg gap-y-siaf-md md:grid-cols-2 xl:grid-cols-3">
                  @for (d of saldoInicial(); track d.etiqueta) {
                    <readonly-field [caption]="d.etiqueta" [value]="d.valor" [bold]="true" [highlight]="true" />
                  }
                </div>
              </section>
            }
  
            <section class="grid gap-siaf-sm">
              <h4 class="m-0 text-sm font-bold uppercase text-text">Importes</h4>
              <div class="grid gap-x-siaf-lg gap-y-siaf-md md:grid-cols-2 xl:grid-cols-3">
                <readonly-field caption="En moneda de la cuenta" [value]="formatoImporte(r.importeCuenta)" [bold]="true" [highlight]="true" [help]="ayudaImportes" />
                <readonly-field caption="En moneda nacional" [value]="formatoImporte(r.importeNacional)" [bold]="true" [highlight]="true" />
              </div>
            </section>
  
            <section class="grid gap-siaf-sm">
              <h4 class="m-0 text-sm font-bold uppercase text-text">Cuentas de registro</h4>
              <siaf-form-table-search placeholder="Buscar" [value]="busqueda()" (valueChange)="busqueda.set($event); pagina.set(1)" />
              <div class="siaf-table-shell">
                <table class="siaf-table min-w-[960px]">
                  <caption class="sr-only">Cuentas de registro de la cuenta {{ r.cuentaBancaria }}</caption>
                  <thead>
                    <tr class="siaf-table-head-row">
                      <th class="siaf-table-th w-[130px]" rowspan="2" [siafTooltip]="abrev.fechaOperacion.termino">{{ abrev.fechaOperacion.abreviatura }}</th>
                      <th class="siaf-table-th siaf-table-th--grupo" colspan="3">Cuenta de registro</th>
                      <th class="siaf-table-th siaf-table-th--grupo" colspan="2">Libretas</th>
                      @if (r.ajuste) {
                        <th class="siaf-table-th w-[150px] text-right" rowspan="2">Saldo act.</th>
                      }
                    </tr>
                    <tr class="siaf-table-head-row">
                      <th class="siaf-table-th siaf-table-th--grupo-inicio w-[100px]" [siafTooltip]="abrev.idCorrelativo.termino">{{ abrev.idCorrelativo.abreviatura }}</th>
                      <th class="siaf-table-th">Número</th>
                      <th class="siaf-table-th siaf-table-th--grupo-fin">Descripción</th>
                      <th class="siaf-table-th siaf-table-th--grupo-inicio w-[170px] text-right" [siafTooltip]="abrev.importeCuenta.termino">{{ abrev.importeCuenta.abreviatura }}</th>
                      <th class="siaf-table-th siaf-table-th--grupo-fin w-[170px] text-right" [siafTooltip]="abrev.importeNacional.termino">{{ abrev.importeNacional.abreviatura }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (libreta of tabla().filas; track libreta.idCorrelativo) {
                      <tr class="siaf-table-row">
                        <td class="siaf-table-td">{{ formatoFecha(r.fechaOperacion) }}</td>
                        <td class="siaf-table-td">{{ libreta.idCorrelativo }}</td>
                        <td class="siaf-table-td">{{ libreta.numero }}</td>
                        <td class="siaf-table-td">{{ libreta.descripcion }}</td>
                        <td class="siaf-table-td text-right">{{ formatoImporte(libreta.importe) }}</td>
                        <td class="siaf-table-td text-right">{{ formatoImporte(libreta.importeNacional) }}</td>
                        @if (r.ajuste) {
                          <td class="siaf-table-td text-right">{{ formatoImporte(libreta.saldoActualizado) }}</td>
                        }
                      </tr>
                    } @empty {
                      <tr class="siaf-table-row">
                        <td class="siaf-table-td text-center" [attr.colspan]="r.ajuste ? 7 : 6">No se encontraron cuentas de registro.</td>
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
                [totalItems]="libretas().length"
                [totalPages]="tabla().totalPaginas"
                [rowsPerPage]="tamano()"
                (previous)="pagina.set(pagina() - 1)"
                (next)="pagina.set(pagina() + 1)"
                (rowsPerPageChange)="tamano.set($event); pagina.set(1)"
              />
            </section>
  
            <!-- Los automáticos no tienen sustento: el archivo está en su documento. -->
            <!-- Siempre se muestra (también en la apertura automática); sin archivo, el mismo aviso del formulario. -->
            <section class="grid gap-siaf-sm">
              <h4 class="m-0 text-sm font-bold uppercase text-text">Documento de sustento</h4>
              @if (r.sustento) {
                <!-- En el historial solo se descarga; en el detalle se ve en el visor. -->
                <siaf-uploaded-file-card
                  [file]="{ name: r.sustento }"
                  [readonly]="true"
                  [viewable]="!lineal"
                  [downloadable]="lineal"
                  (viewed)="sustentoVisto.set(r)"
                  (downloaded)="descargarSustento(r)"
                />
              } @else {
                <message-box text="No se ha adjuntado ningún archivo." />
              }
            </section>
  
            <!-- En el historial el estado ya está en el bloque Documento. -->
            @if (!lineal) {
            <div class="border-t border-[var(--sys-color-divider-default)] px-siaf-sm pt-siaf-md">
              <p class="siaf-text-caption-1 m-0 mb-siaf-xxs text-[var(--sys-color-text-neutral-low)]">Estado de registro</p>
              <siaf-record-status-tag [status]="r.estado" />
            </div>
            }
          </div>
        </siaf-solicitude-form-card>
      </div>
    }

    <ng-template #datos let-lista>
      <dl class="m-0 grid gap-siaf-md px-siaf-sm sm:grid-cols-3">
        @for (d of lista; track d.etiqueta) {
          <div class="min-w-0">
            <dt class="siaf-text-caption-1 text-[var(--sys-color-text-neutral-low)]">{{ d.etiqueta }}</dt>
            <dd class="m-0 truncate text-sm" siafTooltip>{{ d.valor }}</dd>
          </div>
        }
      </dl>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaldoDetalleComponent {
  /** Abreviaturas de las cabeceras (tooltip con el término completo). */
  readonly abrev = ABREVIATURAS;
  readonly registro = signal<SaldoInicialRegistro | null>(null);
  /** Cards lineales (con borde), sin estado al final y el sustento solo para descargar: así se ve en el historial. */
  @Input() lineal = false;
  /** Registro cuyo documento de sustento se ve en el visor de PDF. */
  readonly sustentoVisto = signal<SaldoConSustento | null>(null);

  /** Registro a mostrar; al cambiar, la tabla de cuentas de registro vuelve a la primera página. */
  @Input({ alias: 'registro' }) set registroValor(valor: SaldoInicialRegistro | null) {
    this.registro.set(valor);
    this.busqueda.set('');
    this.pagina.set(1);
  }

  readonly ayudaImportes = 'Suma automática de los importes de las cuentas de registros.';
  readonly formatoFecha = formatoFecha;
  readonly formatoImporte = formatoImporte;

  /** Descarga el sustento (el archivo subido o, si no hay, el PDF de ejemplo) con su nombre. */
  async descargarSustento(r: SaldoInicialRegistro): Promise<void> {
    if (!r.sustento) return;
    const url = URL.createObjectURL(await archivoDeSustento(r));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = r.sustento;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Datos etiqueta/valor en el formato de `siaf-summary-card`. */
  tarjeta(datos: { etiqueta: string; valor: string }[]): SummaryCardField[] {
    return datos.map((d) => ({ label: d.etiqueta, value: d.valor }));
  }

  readonly tipoOperacion = computed((): Dato[] => [
    { etiqueta: 'Tipo de operación del saldo', valor: this.registro()?.ajuste ? TIPO_OPERACION_AJUSTE : this.registro()?.automatico ? TIPO_OPERACION_APERTURA : TIPO_OPERACION },
    { etiqueta: 'Periodo', valor: PERIODO },
  ]);
  readonly movimiento = computed((): Dato[] => {
    const r = this.registro();
    const m = r?.ajuste ? MOVIMIENTO_INTERNO_AJUSTE : r?.automatico ? MOVIMIENTO_INTERNO_APERTURA : MOVIMIENTO_INTERNO;
    return [
      { etiqueta: 'Código', valor: m.codigo },
      { etiqueta: 'Denominación', valor: m.denominacion },
      { etiqueta: 'Naturaleza del movimiento', valor: m.naturaleza },
      { etiqueta: 'Sigla', valor: m.sigla },
    ];
  });

  readonly entidad = computed((): Dato[] => {
    const e = entidadPorCodigo(this.registro()?.entidadFinanciera);
    return e
      ? [
          { etiqueta: 'Tipo', valor: e.tipo },
          { etiqueta: 'Código', valor: e.codigo },
          { etiqueta: 'Denominación', valor: e.denominacion },
          { etiqueta: 'Sigla', valor: e.sigla },
        ]
      : [];
  });

  readonly cuenta = computed((): Dato[] => {
    const r = this.registro();
    if (!r) return [];
    return [
      { etiqueta: 'Número de cuenta', valor: r.cuentaBancaria },
      { etiqueta: 'Denominación', valor: cuentaPorNumero(r.cuentaBancaria)?.denominacion ?? '' },
      { etiqueta: 'Moneda', valor: r.moneda },
    ];
  });

  readonly cambio = computed((): Dato[] => [
    { etiqueta: 'Tipo de cotización', valor: TIPO_COTIZACION },
    { etiqueta: 'Compra', valor: this.registro()?.tipoCambio.toFixed(2) ?? '' },
  ]);

  /** Solo en un ajuste: saldo de referencia, naturaleza y saldo resultante. */
  readonly saldoInicial = computed((): Dato[] => {
    const r = this.registro();
    if (!r?.ajuste) return [];
    return [
      { etiqueta: 'Importe de saldo inicial', valor: formatoImporte(r.ajuste.saldoInicial) },
      { etiqueta: 'Naturaleza de la operación', valor: r.ajuste.naturaleza },
      { etiqueta: 'Saldo actualizado', valor: formatoImporte(saldoActualizado(r.ajuste.saldoInicial, r.importeCuenta, r.ajuste.naturaleza)) },
    ];
  });

  // ── Cuentas de registro ───────────────────────────────────────────
  readonly busqueda = signal('');
  readonly pagina = signal(1);
  readonly tamano = signal(25);
  readonly libretas = computed(() => {
    const r = this.registro();
    if (!r) return [];
    const q = this.busqueda();
    const importes = new Map(r.libretas.map((l) => [l.idCorrelativo, l.importe]));
    const iniciales = new Map((r.ajuste?.libretasIniciales ?? []).map((l) => [l.idCorrelativo, l.importe]));
    return cuentasRegistroDe(r.cuentaBancaria)
      .filter((l) => importes.has(l.idCorrelativo))
      .map((l) => ({ ...l, importe: importes.get(l.idCorrelativo)!, importeNacional: redondear(importes.get(l.idCorrelativo)! * r.tipoCambio),
        saldoActualizado: r.ajuste ? saldoActualizado(iniciales.get(l.idCorrelativo) ?? 0, importes.get(l.idCorrelativo)!, r.ajuste.naturaleza) : 0,
      }))
      .filter((l) => !q || [l.idCorrelativo, l.numero, l.descripcion].some((v) => contiene(v, q)));
  });
  readonly tabla = computed(() => {
    const filas = this.libretas();
    const totalPaginas = Math.max(1, Math.ceil(filas.length / this.tamano()));
    const actual = Math.min(this.pagina(), totalPaginas);
    return { filas: filas.slice((actual - 1) * this.tamano(), actual * this.tamano()), totalPaginas };
  });
}
