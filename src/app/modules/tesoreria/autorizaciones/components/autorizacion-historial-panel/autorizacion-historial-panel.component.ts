import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';

import { SolicitudResponse, SolicitudesApiService } from '../../../../../core/api/solicitudes-api.service';
import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { FocoDirective } from '../../../../../shared/ui/foco/foco.directive';
import { IconComponent } from '../../../../../shared/ui/icon/icon.component';
import { RecordStatusTagComponent } from '../../../../../shared/ui/record-status-tag/record-status-tag.component';
import { SidePanelAnimacion } from '../../../../../shared/ui/side-panel-animacion';
import { StepItem, StepsComponent } from '../../../../../shared/ui/steps/steps.component';
import { TooltipDirective } from '../../../../../shared/ui/tooltip/tooltip.directive';
import { AutorizacionRegistro, DocumentoAutorizacion, NOMBRE_DOCUMENTO, etiquetaTipoAccion } from '../../models/autorizacion.model';
import { AutorizacionDetalleComponent, type AutorizacionVista } from '../autorizacion-detalle/autorizacion-detalle.component';

const dos = (n: number) => String(n).padStart(2, '0');

/** dd/mm/aa hh:mm:ss para las tarjetas de la línea de tiempo. */
function fechaCorta(iso: string): string {
  const f = new Date(iso);
  return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${String(f.getFullYear()).slice(-2)}   ${dos(f.getHours())}:${dos(f.getMinutes())}:${dos(f.getSeconds())}`;
}

/** dd/mm/aaaa hh:mm:ss para las firmas. */
function fechaHora(iso: string | null | undefined): string {
  if (!iso) return '';
  const f = new Date(iso);
  return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()}   ${dos(f.getHours())}:${dos(f.getMinutes())}:${dos(f.getSeconds())}`;
}

/**
 * Historial de un registro de autorización, a pantalla completa. Se abre con el ícono de historial de la pestaña
 * Registros de «Documentos de autorización».
 *
 * A la izquierda, la línea de tiempo con los documentos del registro (la creación y cada modificación), del más
 * reciente al más antiguo; al elegir uno, a la derecha cómo quedó la autorización con ese documento
 * (`siaf-autorizacion-detalle`) y quién lo elaboró y autorizó.
 *
 * @teclado
 * - **Escape** o la X: cierran el panel (emite `closed`).
 * - **Tab**: el foco queda dentro del panel (`siafFoco`).
 */
@Component({
  selector: 'siaf-autorizacion-historial-panel',
  standalone: true,
  imports: [AutorizacionDetalleComponent, FocoDirective, IconComponent, RecordStatusTagComponent, SolicitudeFormCardComponent, StepsComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (anim.visible()) {
      <section
        class="siaf-sidepanel-overlay fixed inset-y-0 left-0 right-0 z-50 bg-black/55 pl-0 lg:pl-[65px]"
        [class.cerrando]="anim.cerrando()"
        aria-modal="true"
        role="dialog"
        aria-labelledby="autorizacion-historial-titulo"
        (click)="closed.emit()"
      >
        <aside
          class="flex h-screen w-full flex-col overflow-hidden bg-surface text-text shadow-siaf-lg lg:rounded-l-siaf-md"
          [siafFoco]="!!registro()"
          (siafFocoEscape)="closed.emit()"
          (click)="$event.stopPropagation()"
        >
          <header class="flex h-14 shrink-0 items-center gap-siaf-xs px-siaf-md">
            <h2 id="autorizacion-historial-titulo" class="siaf-text-heading-6-bold-caps m-0 min-w-0 flex-1 text-text">Historial de registro</h2>
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
                <siaf-steps
                  class="block lg:sticky lg:top-siaf-md"
                  variant="cards"
                  [steps]="pasos()"
                  [activeStep]="indice() + 1"
                  (activeStepChange)="elegir($event - 1)"
                />
              </aside>

              @if (actual(); as d) {
                <section class="flex min-w-0 flex-col gap-siaf-md">
                  <siaf-solicitude-form-card [bordered]="true">
                    <div>
                      <p class="siaf-text-overline-medium m-0 text-text-muted">Documento</p>
                      <p class="m-0 text-sm">{{ nombreDocumento }}</p>
                      <dl class="m-0 mt-siaf-lg grid gap-siaf-md md:grid-cols-3">
                        <div class="min-w-0">
                          <dt class="siaf-text-overline-medium text-text-muted">N° documento</dt>
                          <dd class="m-0 truncate text-sm" siafTooltip>{{ d.numero }}</dd>
                        </div>
                        <div>
                          <dt class="siaf-text-overline-medium text-text-muted">Tipo de acción</dt>
                          <dd class="m-0 text-sm">{{ etiquetaTipoAccion(d.tipoAccion) }}</dd>
                        </div>
                        <div>
                          <dt class="siaf-text-overline-medium text-text-muted">Estado de registro</dt>
                          <dd class="m-0">
                            @if (vista(); as v) {
                              <siaf-record-status-tag [status]="v.estado" size="small" />
                            } @else {
                              <span class="text-sm">-</span>
                            }
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </siaf-solicitude-form-card>

                  @if (vista(); as v) {
                    <siaf-autorizacion-detalle [autorizacion]="v" [lineal]="true" />
                  } @else {
                    <p class="m-0 p-siaf-md text-sm text-text-muted" role="status">Cargando documento…</p>
                  }

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
})
export class AutorizacionHistorialPanelComponent {
  private readonly solicitudesApi = inject(SolicitudesApiService);
  readonly anim = new SidePanelAnimacion();

  readonly registro = signal<AutorizacionRegistro | null>(null);
  /** Posición del documento mostrado en la línea de tiempo. */
  readonly indice = signal(0);
  /** Documentos ya pedidos (por id), para sus datos y firmas. */
  private readonly solicitudes = signal<Record<string, SolicitudResponse>>({});

  /** Registro pulsado; con `null` el panel se cierra. Abre en su documento más reciente. */
  @Input({ alias: 'registro' }) set registroValor(valor: AutorizacionRegistro | null) {
    this.registro.set(valor);
    this.anim.actualizar(!!valor);
    if (valor) this.elegir(0);
  }

  @Output() closed = new EventEmitter<void>();

  readonly nombreDocumento = NOMBRE_DOCUMENTO;
  readonly etiquetaTipoAccion = etiquetaTipoAccion;

  /** Documentos del registro, del más reciente al más antiguo. */
  readonly documentos = computed((): DocumentoAutorizacion[] => [...(this.registro()?.documentos ?? [])].reverse());
  readonly actual = computed(() => this.documentos()[this.indice()] ?? null);

  readonly pasos = computed((): StepItem[] =>
    this.documentos().map((d) => ({
      label: d.numero,
      fields: [
        { label: 'N° documento', value: d.numero, weight: 'bold' },
        { label: 'Tipo de acción', value: etiquetaTipoAccion(d.tipoAccion), weight: 'bold' },
        { label: 'Fecha', value: fechaCorta(d.fecha), weight: 'bold' },
      ],
    })),
  );

  /** Cómo quedó la autorización con el documento elegido; lo que el documento no cambia sale del registro. */
  readonly vista = computed((): AutorizacionVista | null => {
    const d = this.actual();
    const r = this.registro();
    const s = d ? this.solicitudes()[d.documentoId] : undefined;
    if (!d || !r || !s) return null;
    const a = s.detalleAutorizacion;
    return {
      procedimiento: a?.procedimiento || r.procedimiento,
      responsable: a?.responsable || r.responsable,
      cuentaBancaria: a?.cuentaBancaria || r.cuentaBancaria,
      estado: a?.estado ?? r.estado,
      fechaDesde: a ? a.fechaDesde : r.fechaDesde,
      fechaHasta: a ? a.fechaHasta : r.fechaHasta,
      // El asunto del documento lleva delante el área entre corchetes («[OFICINA …] motivo»): se muestra solo el motivo.
      motivo: (s.asuntoMotivo ?? '').replace(/^\[[^\]]*\]\s*/, '') || r.motivo,
    };
  });

  /** Elaborado y autorizado por el creador autorizador (sin aprobador). */
  readonly firmas = computed(() => {
    const d = this.actual();
    const historial = (d && this.solicitudes()[d.documentoId]?.historialEstados) || [];
    const paso = (etiqueta: string, estado: string) => {
      const h = [...historial].reverse().find((x) => x.estadoNuevo === estado);
      const c = h?.creador;
      return {
        etiqueta,
        usuario: c ? [c.nombres, c.apellidoPaterno, c.apellidoMaterno].filter(Boolean).join(' ').toUpperCase() : '',
        fecha: fechaHora(h?.createdAt),
      };
    };
    return [paso('Elaborado por', 'ELABORADO'), paso('Autorizado por', 'APROBADO')];
  });

  elegir(indice: number): void {
    this.indice.set(Math.max(0, indice));
    const d = this.actual();
    if (d && !this.solicitudes()[d.documentoId]) {
      this.solicitudesApi.obtenerDetalle(d.documentoId).subscribe((s) => this.solicitudes.update((m) => ({ ...m, [d.documentoId]: s })));
    }
  }
}
