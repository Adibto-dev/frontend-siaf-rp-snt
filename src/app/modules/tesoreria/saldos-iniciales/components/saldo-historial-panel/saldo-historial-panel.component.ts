import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';

import { SolicitudResponse, SolicitudesApiService } from '../../../../../core/api/solicitudes-api.service';
import { FocoDirective } from '../../../../../shared/ui/foco/foco.directive';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { RecordStatusTagComponent } from '../../../../../shared/ui/record-status-tag/record-status-tag.component';
import { SidePanelAnimacion } from '../../../../../shared/ui/side-panel-animacion';
import { StepItem, StepsComponent } from '../../../../../shared/ui/steps/steps.component';
import { TooltipDirective } from '../../../../../shared/ui/tooltip/tooltip.directive';
import { NOMBRE_AUTOMATICO, NOMBRE_DOCUMENTO, SaldoInicialRegistro } from '../../models/saldo-inicial.model';
import { SaldoDetalleComponent } from '../saldo-detalle/saldo-detalle.component';

/** dd/mm/aa hh:mm:ss para las tarjetas de la línea de tiempo. */
function fechaCorta(iso: string): string {
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

/** Título del panel según el origen del registro. */
function tituloDe(r: SaldoInicialRegistro | undefined): string {
  if (r?.ajuste) return 'Ajuste de saldo inicial libretas';
  if (r?.automatico) return 'Saldo de apertura libretas';
  return 'Saldo inicial libretas';
}

/**
 * Historial de un registro de saldos iniciales (Figma 24670:148333), a pantalla completa. Se abre con el ícono de
 * historial de la pestaña Registros.
 *
 * A la izquierda, la línea de tiempo con los documentos de la misma cuenta bancaria (saldo inicial o de apertura y sus
 * ajustes), del más reciente al más antiguo; al elegir uno se muestra a la derecha su documento, el detalle del saldo
 * (`siaf-saldo-detalle`) y quién lo elaboró, verificó y aprobó (en los automáticos, registró y procesó).
 *
 * @teclado
 * - **Escape** o la X: cierran el panel (emite `closed`).
 * - **Tab**: el foco queda dentro del panel (`siafFoco`).
 */
@Component({
  selector: 'siaf-saldo-historial-panel',
  standalone: true,
  imports: [FocoDirective, IconComponent, RecordStatusTagComponent, SaldoDetalleComponent, StepsComponent, TooltipDirective],
  template: `
    @if (anim.visible()) {
      <section
        class="siaf-sidepanel-overlay fixed inset-y-0 left-0 right-0 z-50 bg-black/55 pl-0 lg:pl-[65px]"
        [class.cerrando]="anim.cerrando()"
        aria-modal="true"
        role="dialog"
        aria-labelledby="saldo-historial-titulo"
        (click)="closed.emit()"
      >
        <aside
          class="flex h-screen w-full flex-col overflow-hidden bg-surface text-text shadow-siaf-lg lg:rounded-l-siaf-md"
          [siafFoco]="!!registro"
          (siafFocoEscape)="closed.emit()"
          (click)="$event.stopPropagation()"
        >
          <header class="flex h-14 shrink-0 items-center gap-siaf-xs px-siaf-md">
            <h2 id="saldo-historial-titulo" class="siaf-text-heading-6-bold-caps m-0 min-w-0 flex-1 text-text">{{ titulo() }}</h2>
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
            <div class="mx-auto grid w-full max-w-[1160px] grid-cols-1 gap-siaf-xl px-siaf-md py-siaf-md sm:px-siaf-xl lg:grid-cols-[210px_minmax(0,890px)] lg:gap-[64px] lg:px-0">
              <aside>
                <siaf-steps
                  class="block lg:sticky lg:top-siaf-md"
                  variant="cards"
                  [steps]="pasos()"
                  [activeStep]="indice() + 1"
                  (activeStepChange)="elegir($event - 1)"
                />
              </aside>

              @if (actual(); as r) {
                <section class="flex min-w-0 flex-col gap-siaf-md">
                  <section class="rounded-siaf-md border border-[var(--sys-color-divider-strong)] bg-surface px-siaf-lg py-siaf-md">
                    <p class="siaf-text-overline-medium m-0 text-text-muted">Documento</p>
                    <p class="m-0 text-sm">{{ nombreDocumento(r) }}</p>
                    <dl class="m-0 mt-siaf-lg grid gap-siaf-md md:grid-cols-3">
                      <div class="min-w-0">
                        <dt class="siaf-text-overline-medium text-text-muted">N° documento</dt>
                        <dd class="m-0 truncate text-sm" siafTooltip>{{ r.numeroDocumento }}</dd>
                      </div>
                      <div>
                        <dt class="siaf-text-overline-medium text-text-muted">Tipo de acción</dt>
                        <dd class="m-0 text-sm">Creación</dd>
                      </div>
                      <div>
                        <dt class="siaf-text-overline-medium text-text-muted">Estado de registro</dt>
                        <dd class="m-0"><siaf-record-status-tag [status]="r.estado" size="small" /></dd>
                      </div>
                    </dl>
                  </section>

                  <siaf-saldo-detalle [registro]="r" />

                  <section class="rounded-siaf-md border border-[var(--sys-color-divider-strong)] bg-surface px-siaf-lg py-siaf-md">
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
                  </section>
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
export class SaldoHistorialPanelComponent {
  private readonly solicitudesApi = inject(SolicitudesApiService);
  readonly anim = new SidePanelAnimacion();

  private readonly todos = signal<SaldoInicialRegistro[]>([]);
  private readonly elegido = signal<SaldoInicialRegistro | null>(null);
  /** Posición del documento mostrado en la línea de tiempo. */
  readonly indice = signal(0);
  /** Solicitudes ya pedidas (por id de documento), para las firmas. */
  private readonly solicitudes = signal<Record<string, SolicitudResponse>>({});

  registro: SaldoInicialRegistro | null = null;

  /** Registro pulsado; con `null` el panel se cierra. */
  @Input({ alias: 'registro' }) set registroValor(valor: SaldoInicialRegistro | null) {
    this.registro = valor;
    this.elegido.set(valor);
    this.anim.actualizar(!!valor);
    if (valor) this.elegir(this.historial().findIndex((r) => r.registroId === valor.registroId));
  }

  /** Todos los registros: de ellos salen los de la misma cuenta bancaria. */
  @Input() set registros(valor: SaldoInicialRegistro[]) {
    this.todos.set(valor);
  }

  @Output() closed = new EventEmitter<void>();

  /** Registros de la misma cuenta bancaria, del más reciente al más antiguo. */
  readonly historial = computed(() => {
    const cuenta = this.elegido()?.cuentaBancaria;
    if (!cuenta) return [];
    return this.todos()
      .filter((r) => r.cuentaBancaria === cuenta)
      .sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro));
  });

  readonly actual = computed(() => this.historial()[this.indice()] ?? this.elegido());
  readonly titulo = computed(() => tituloDe(this.actual() ?? undefined));

  readonly pasos = computed((): StepItem[] =>
    this.historial().map((r) => ({
      label: r.numeroDocumento,
      fields: [
        { label: 'N° documento', value: r.numeroDocumento, weight: 'bold' },
        { label: 'Tipo de acción', value: 'Creación', weight: 'bold' },
        { label: 'Fecha', value: fechaCorta(r.fechaRegistro), weight: 'bold' },
      ],
    })),
  );

  /** Elaborado, verificado y aprobado por (en los automáticos: registrado y procesado por el sistema). */
  readonly firmas = computed(() => {
    const r = this.actual();
    const historial = (r && this.solicitudes()[r.documentoId]?.historialEstados) || [];
    const paso = (etiqueta: string, estado: string) => {
      const h = [...historial].reverse().find((x) => x.estadoNuevo === estado);
      const c = h?.creador;
      return {
        etiqueta,
        usuario: c ? [c.nombres, c.apellidoPaterno, c.apellidoMaterno].filter(Boolean).join(' ').toUpperCase() : '',
        fecha: fechaHora(h?.createdAt),
      };
    };
    return r?.automatico
      ? [paso('Registrado por', 'REGISTRADO'), paso('Procesado por', 'PROCESADO')]
      : [paso('Elaborado por', 'ELABORADO'), paso('Verificado por', 'VERIFICADO'), paso('Aprobado por', 'APROBADO')];
  });

  nombreDocumento(r: SaldoInicialRegistro): string {
    return r.automatico ? NOMBRE_AUTOMATICO : NOMBRE_DOCUMENTO;
  }

  elegir(indice: number): void {
    this.indice.set(Math.max(0, indice));
    const r = this.historial()[this.indice()];
    if (r && !this.solicitudes()[r.documentoId]) {
      this.solicitudesApi.obtenerDetalle(r.documentoId).subscribe((s) => this.solicitudes.update((m) => ({ ...m, [r.documentoId]: s })));
    }
  }
}
