import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import { ButtonComponent } from '../button/button.component';

import { FlowStatus, FlowStatusTagComponent } from '../flow-status-tag/flow-status-tag.component';
import { TooltipDirective } from '../tooltip/tooltip.directive';
import { ESTADO } from '../../../core/models/documento.model';

/**
 * Card de cabecera de un documento: N° de documento, N° de documento contable (opcional)
 * y su estado de flujo, con layout distinto en móvil y escritorio.
 *
 * Úsalo en las páginas de solicitud para resumir el documento abierto. Para la card de
 * "ítem seleccionado" desde un side panel el componente canónico es `siaf-summary-card`.
 *
 * @usar
 * - En la cabecera de las pantallas de solicitud, junto a `siaf-solicitude-info-card`, para el N° y el estado del
 *   documento abierto: plan de cuentas, catálogo de ajustes, catálogo de eventos, eventos contables y apertura contable.
 * - Con `contableNumber` cuando el documento ya tiene N° de documento contable: asiento de ajuste y asiento anual de
 *   apertura contable.
 * - En el detalle de los documentos y pedidos de Contabilización.
 * @evitar
 * - Para el ítem elegido desde un panel lateral: usar `siaf-summary-card`.
 * - Para datos generales como fecha, ente rector o entidad: usar `siaf-solicitude-info-card`.
 * - Para el estado de un registro (Activo, Anulado): usar `siaf-record-status-tag`; esta card muestra el estado del
 *   flujo del documento.
 * - Etiquetas largas: en escritorio la columna mide 140 px y la etiqueta se trunca.
 * - Con `detailAnchorId`: en Observado o Rechazado, junto al estado, un ícono ⓘ que lleva a la sección del detalle e
 *   historial (`siaf-detail-history-tabs` con ese `id`), la deja en la pestaña Detalle y le pasa el foco.
 * @teclado
 * - Solo el ícono ⓘ recibe foco; **Enter** o **Espacio** van al detalle.
 * @accesibilidad
 * - **1.3.1 Información y relaciones (A)**: cada etiqueta precede a su valor en el orden de lectura; las versiones
 *   móvil y escritorio se ocultan con `display: none`, así que el lector de pantalla lee una sola.
 * - **1.4.1 Uso del color (A)**: el estado va escrito en `siaf-flow-status-tag`, no solo en el color.
 * - **Pendiente · 1.4.3 Contraste mínimo (AA)**: etiquetas `text-neutral-low` 5.01:1 (oscuro 8.86:1) y N° de
 *   documento `text-neutral-high` 16.29:1 (16.53:1) cumplen, pero el N° contable usa la clase `text-brand-primary`
 *   (color de fondo de marca), 2.66:1 en oscuro, y el estado Observado / Pendiente / Fallido da 3.39:1 en claro.
 * - **1.4.13 Contenido en hover o foco (AA)**: en escritorio el N° truncado se completa con `siafTooltip`, que se
 *   cierra con Escape y se puede recorrer con el puntero.
 * - **Pendiente · 2.1.1 Teclado (A)**: ese texto no recibe foco, así que con teclado el globo no aparece (el lector de
 *   pantalla sí lee el valor entero).
 */
@Component({
  selector: 'siaf-document-summary-card',
  standalone: true,
  imports: [ButtonComponent, FlowStatusTagComponent, TooltipDirective],
  template: `
    <article class="h-full rounded-siaf-md bg-surface px-siaf-lg py-siaf-md">
      <!-- Mobile -->
      <div class="flex flex-col gap-siaf-xs lg:hidden">
        <div class="flex items-start gap-siaf-xs">
          <div class="flex min-w-0 flex-1 flex-col gap-siaf-xxs">
            <span class="siaf-text-overline-medium truncate leading-4 text-text-muted" siafTooltip>{{ documentNumberLabel }}</span>
            <!-- Móvil: sin hover no hay tooltip posible, así que el número envuelve. -->
            <strong class="siaf-text-body-2-bold min-w-0 break-words leading-6 text-text">{{ documentNumber }}</strong>
          </div>
          <div class="flex min-w-0 flex-1 flex-col gap-siaf-xxs">
            <span class="siaf-text-overline-medium truncate leading-4 text-text-muted" siafTooltip>{{ statusLabel }}</span>
            <div class="flex items-center gap-siaf-xxs">
              <siaf-flow-status-tag [status]="status" size="small" />
              @if (verDetalleVisible) {
                <siaf-button variant="text" size="sm" icon="info" [iconOnly]="true" ariaLabel="Ver detalle e historial" siafTooltip="Ver detalle e historial" (click)="irAlDetalle()" />
              }
            </div>
          </div>
        </div>
        @if (contableNumber) {
          <div class="flex flex-col gap-siaf-xxs">
            <span class="siaf-text-overline-medium truncate leading-4 text-text-muted" siafTooltip>{{ contableNumberLabel }}</span>
            <strong class="siaf-text-body-2-bold min-w-0 break-words leading-6 text-brand-primary">{{ contableNumber }}</strong>
          </div>
        }
      </div>

      <!-- Desktop -->
      <div class="hidden gap-siaf-xs lg:grid">
        <div class="grid min-h-6 items-center gap-siaf-xs lg:grid-cols-[140px_1fr]">
          <span class="siaf-text-overline-medium truncate leading-4 text-text-muted" siafTooltip>{{ documentNumberLabel }}</span>
          <strong class="siaf-text-body-2-bold min-w-0 truncate leading-6 text-text" siafTooltip>{{ documentNumber }}</strong>
        </div>
        @if (contableNumber) {
          <div class="grid min-h-6 items-center gap-siaf-xs lg:grid-cols-[140px_1fr]">
            <span class="siaf-text-overline-medium truncate leading-4 text-text-muted" siafTooltip>{{ contableNumberLabel }}</span>
            <strong class="siaf-text-body-2-bold min-w-0 truncate leading-6 text-brand-primary" siafTooltip>{{ contableNumber }}</strong>
          </div>
        }
        <div class="grid min-h-6 items-center gap-siaf-xs lg:grid-cols-[140px_1fr]">
          <span class="siaf-text-overline-medium truncate leading-4 text-text-muted" siafTooltip>{{ statusLabel }}</span>
          <div class="flex items-center gap-siaf-xxs">
              <siaf-flow-status-tag [status]="status" size="small" />
              @if (verDetalleVisible) {
                <siaf-button variant="text" size="sm" icon="info" [iconOnly]="true" ariaLabel="Ver detalle e historial" siafTooltip="Ver detalle e historial" (click)="irAlDetalle()" />
              }
            </div>
        </div>
      </div>
    </article>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentSummaryCardComponent {
  @Input() documentNumber = '';
  @Input() status: FlowStatus = ESTADO.ELABORADO;
  @Input() documentNumberLabel = 'N° documento';
  @Input() statusLabel = 'Estado';
  /** Número de documento contable (ej: AA-1-2026-01) — opcional, se muestra como tercera fila */
  @Input() contableNumber: string | null = null;
  @Input() contableNumberLabel = 'N° Doc. Contable';
  /**
   * `id` de la sección del detalle e historial (`siaf-detail-history-tabs`). En Observado o Rechazado muestra el ícono
   * ⓘ que lleva a ella; `null` (sin sección) lo oculta.
   */
  @Input() detailAnchorId: string | null = null;

  get verDetalleVisible(): boolean {
    return !!this.detailAnchorId && (this.status === ESTADO.OBSERVADO || this.status === ESTADO.RECHAZADO);
  }

  /** Baja hasta la sección y le avisa (evento `siaf-ver-detalle`) para que abra Detalle y tome el foco. */
  irAlDetalle(): void {
    const destino = this.detailAnchorId ? document.getElementById(this.detailAnchorId) : null;
    if (!destino) return;
    destino.dispatchEvent(new CustomEvent('siaf-ver-detalle'));
    destino.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
