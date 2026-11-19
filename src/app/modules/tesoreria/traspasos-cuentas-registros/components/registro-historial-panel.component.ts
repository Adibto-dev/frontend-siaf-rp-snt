import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';

import { SolicitudResponse, SolicitudesApiService } from '../../../../core/api/solicitudes-api.service';
import { SolicitudeFormCardComponent } from '../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { FocoDirective } from '../../../../shared/ui/foco/foco.directive';
import { IconComponent } from '../../../../shared/ui/icon/icon.component';
import { ReadonlyFieldComponent } from '../../../../shared/ui/readonly-field/readonly-field.component';
import { SidePanelAnimacion } from '../../../../shared/ui/side-panel-animacion';
import { StepItem, StepsComponent } from '../../../../shared/ui/steps/steps.component';
import { TooltipDirective } from '../../../../shared/ui/tooltip/tooltip.directive';
import { ABREVIATURAS } from '../../../../shared/utils/abreviaturas.util';
import { cuentasRegistroDe, formatoImporte } from '../../saldos-iniciales/models/saldo-inicial.model';
import type { MovimientoTraslado } from '../models/traslado.model';

/** Lo que el panel muestra de un registro de traslado o de asignación financiera. */
export interface RegistroHistorial {
  documentoId: string;
  numeroDocumento: string;
  /** «Solicitud de Traslado de Recursos…» o «Solicitud de Asignación Financiera». */
  nombreDocumento: string;
  estado: 'Activo' | 'Inactivo';
  cuentaBancaria: string;
  /** Datos del registro: cuenta bancaria, moneda, modalidad o periodicidad, total… */
  campos: { caption: string; value: string }[];
  movimientos: MovimientoTraslado[];
}

/** dd/mm/aa hh:mm:ss para la tarjeta de la línea de tiempo. */
function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '-';
  const f = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${String(f.getFullYear()).slice(-2)}   ${dos(f.getHours())}:${dos(f.getMinutes())}:${dos(f.getSeconds())}`;
}

/** dd/mm/aaaa hh:mm:ss para las firmas. */
function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '';
  const f = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()}   ${dos(f.getHours())}:${dos(f.getMinutes())}:${dos(f.getSeconds())}`;
}

/**
 * Historial de un registro de traslado entre cuentas de registros o de asignación financiera, a pantalla completa, como
 * el de saldos iniciales (`siaf-saldo-historial-panel`). Se abre con el ícono de historial de la pestaña Registros.
 *
 * A la izquierda, la línea de tiempo con el documento que creó el registro (los registros no se modifican: una sola
 * tarjeta). A la derecha, el documento, los datos del registro, sus movimientos (débito y crédito por cuenta de
 * registro) y quién lo elaboró, verificó y aprobó.
 *
 * @teclado
 * - **Escape** o la X: cierran el panel (emite `closed`).
 * - **Tab**: el foco queda dentro del panel (`siafFoco`).
 */
@Component({
  selector: 'siaf-registro-historial-panel',
  standalone: true,
  imports: [FocoDirective, IconComponent, ReadonlyFieldComponent, SolicitudeFormCardComponent, StepsComponent, TooltipDirective],
  template: `
    @if (anim.visible()) {
      <section
        class="siaf-sidepanel-overlay fixed inset-y-0 left-0 right-0 z-50 bg-black/55 pl-0 lg:pl-[65px]"
        [class.cerrando]="anim.cerrando()"
        aria-modal="true"
        role="dialog"
        aria-labelledby="registro-historial-titulo"
        (click)="closed.emit()"
      >
        <aside
          class="flex h-screen w-full flex-col overflow-hidden bg-surface text-text shadow-siaf-lg lg:rounded-l-siaf-md"
          [siafFoco]="!!actual()"
          (siafFocoEscape)="closed.emit()"
          (click)="$event.stopPropagation()"
        >
          <header class="flex h-14 shrink-0 items-center gap-siaf-xs px-siaf-md">
            <h2 id="registro-historial-titulo" class="siaf-text-heading-6-bold-caps m-0 min-w-0 flex-1 text-text">Historial de registro</h2>
            <button
              class="inline-flex size-10 items-center justify-center rounded-siaf-md text-text transition hover:bg-surface-muted active:bg-[var(--sys-color-bg-states-light-pressed)] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
              type="button"
              aria-label="Cerrar historial del registro"
              (click)="closed.emit()"
            >
              <siaf-icon name="close" [size]="24" />
            </button>
          </header>

          <div class="min-h-0 flex-1 overflow-y-auto bg-surface">
            <div class="grid w-full grid-cols-1 gap-siaf-xl px-siaf-md py-siaf-md sm:px-siaf-xl lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-siaf-xl">
              <aside>
                <siaf-steps class="block lg:sticky lg:top-siaf-md" variant="cards" [steps]="pasos()" [activeStep]="1" />
              </aside>

              @if (actual(); as r) {
                <section class="flex min-w-0 flex-col gap-siaf-md">
                  <siaf-solicitude-form-card [bordered]="true">
                    <div>
                      <p class="siaf-text-overline-medium m-0 text-text-muted">Documento</p>
                      <p class="m-0 text-sm">{{ r.nombreDocumento }}</p>
                      <div class="mt-siaf-lg grid gap-x-siaf-lg gap-y-siaf-md md:grid-cols-3">
                        <readonly-field caption="N° documento" [value]="r.numeroDocumento" />
                        <readonly-field caption="Tipo de acción" value="Creación" />
                        <readonly-field caption="Estado de registro" [status]="r.estado" />
                      </div>
                    </div>
                  </siaf-solicitude-form-card>

                  <siaf-solicitude-form-card [bordered]="true">
                    <div class="grid gap-x-siaf-lg gap-y-siaf-md md:grid-cols-3">
                      @for (c of r.campos; track c.caption) {
                        <readonly-field [caption]="c.caption" [value]="c.value" />
                      }
                    </div>
                  </siaf-solicitude-form-card>

                  <div class="siaf-table-shell">
                    <table class="siaf-table min-w-[820px]">
                      <caption class="sr-only">Movimientos del registro</caption>
                      <thead>
                        <tr class="siaf-table-head-row">
                          <th class="siaf-table-th w-[100px]" [siafTooltip]="abrev.idCorrelativo.termino">{{ abrev.idCorrelativo.abreviatura }}</th>
                          <th class="siaf-table-th w-[300px]">Número</th>
                          <th class="siaf-table-th">Descripción</th>
                          <th class="siaf-table-th w-[120px]">Naturaleza</th>
                          <th class="siaf-table-th w-[170px] text-right">Importe</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (m of filas(); track m.idCorrelativo + m.naturaleza) {
                          <tr class="siaf-table-row">
                            <td class="siaf-table-td">{{ m.idCorrelativo }}</td>
                            <td class="siaf-table-td">{{ m.numero }}</td>
                            <td class="siaf-table-td">{{ m.descripcion }}</td>
                            <td class="siaf-table-td">{{ m.naturaleza }}</td>
                            <td class="siaf-table-td text-right">{{ m.importe }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>

                  <siaf-solicitude-form-card [bordered]="true">
                    <dl class="m-0 grid gap-siaf-md sm:grid-cols-3">
                      @for (firma of firmas(); track firma.etiqueta) {
                        <div class="grid gap-siaf-xs">
                          <div>
                            <dt class="siaf-text-overline-medium text-text-muted">{{ firma.etiqueta }}</dt>
                            <dd class="m-0 text-sm font-bold">{{ firma.usuario || '-' }}</dd>
                          </div>
                          <div>
                            <dt class="siaf-text-overline-medium text-text-muted">Fecha</dt>
                            <dd class="m-0 whitespace-pre text-sm font-bold">{{ firma.fecha || '-' }}</dd>
                          </div>
                        </div>
                      }
                    </dl>
                  </siaf-solicitude-form-card>
                </section>
              }
            </div>
          </div>
        </aside>
      </section>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RegistroHistorialPanelComponent {
  private readonly solicitudesApi = inject(SolicitudesApiService);
  readonly anim = new SidePanelAnimacion();
  readonly abrev = ABREVIATURAS;

  readonly actual = signal<RegistroHistorial | null>(null);
  /** Solicitudes ya pedidas (por id de documento), para la fecha y las firmas. */
  private readonly solicitudes = signal<Record<string, SolicitudResponse>>({});

  /** Registro pulsado; con `null` el panel se cierra. */
  @Input() set registro(valor: RegistroHistorial | null) {
    this.actual.set(valor);
    this.anim.actualizar(!!valor);
    if (valor && !this.solicitudes()[valor.documentoId]) {
      this.solicitudesApi.obtenerDetalle(valor.documentoId).subscribe((s) => this.solicitudes.update((m) => ({ ...m, [valor.documentoId]: s })));
    }
  }

  @Output() closed = new EventEmitter<void>();

  private historial() {
    const r = this.actual();
    return (r && this.solicitudes()[r.documentoId]?.historialEstados) || [];
  }

  /** Una sola tarjeta: el documento que creó el registro. */
  readonly pasos = computed((): StepItem[] => {
    const r = this.actual();
    if (!r) return [];
    const creado = this.historial().find((h) => h.estadoNuevo === 'ELABORADO')?.createdAt;
    return [
      {
        label: r.numeroDocumento,
        fields: [
          { label: 'N° documento', value: r.numeroDocumento, weight: 'bold' },
          { label: 'Tipo de acción', value: 'Creación', weight: 'bold' },
          { label: 'Fecha', value: fechaCorta(creado), weight: 'bold' },
        ],
      },
    ];
  });

  /** Movimientos con el número y la descripción de cada cuenta de registro: primero los débitos. */
  readonly filas = computed(() => {
    const r = this.actual();
    if (!r) return [];
    const cuentas = new Map(cuentasRegistroDe(r.cuentaBancaria).map((c) => [c.idCorrelativo, c]));
    return [...r.movimientos]
      .sort((a, b) => (a.naturaleza === b.naturaleza ? a.idCorrelativo.localeCompare(b.idCorrelativo) : a.naturaleza === 'Débito' ? -1 : 1))
      .map((m) => ({
        idCorrelativo: m.idCorrelativo,
        numero: cuentas.get(m.idCorrelativo)?.numero ?? '—',
        descripcion: cuentas.get(m.idCorrelativo)?.descripcion ?? '—',
        naturaleza: m.naturaleza,
        importe: formatoImporte(m.importe),
      }));
  });

  /** Elaborado, verificado y aprobado por. */
  readonly firmas = computed(() => {
    const historial = this.historial();
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
}
