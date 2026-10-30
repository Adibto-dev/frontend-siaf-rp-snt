import { ChangeDetectionStrategy, Component, Input, signal } from '@angular/core';

import { IconComponent } from '../icon/icon.component';
import { RecordStatus, RecordStatusTagComponent } from '../record-status-tag/record-status-tag.component';
import { TooltipDirective } from '../tooltip/tooltip.directive';

/** Largo desde el que un texto `multiline` se recorta y ofrece «Leer más». */
export const READONLY_LEER_MAS_DESDE = 160;

/**
 * Campo de solo lectura del Figma «Readonly forms»: caption flotante y el valor sin contenedor, borde ni íconos de
 * edición. Muestra `--` cuando está vacío. Es lo que pintan `siaf-input`, `siaf-date-time-picker` y
 * `text-area-control` con `[readonly]`: un formulario en modo lectura se ve así sin duplicar el markup.
 *
 * Variantes de Figma: texto, importe (`align="right"`), negrita (`bold`), resaltado (`highlight`, fondo
 * `bg-surfaces-highlight`), varios valores como chips (`tags`), estado de registro (`status`), texto largo con
 * «Leer más» (`multiline`) e ícono info con ayuda (`help`, solo si hay texto).
 *
 * @figma 7544:2031 Readonly forms
 * @usar
 * - En el modo lectura de una solicitud: mejor `[readonly]="soloLectura()"` en el campo editable, que pinta este
 *   componente con su mismo caption, valor y asterisco.
 * - Directo para los criterios de búsqueda sobre los resultados de las consultas y la cabecera de un detalle o reporte.
 * - `align="right"` para importes; `bold` o `highlight` para el dato que hay que destacar (total, número).
 * - `tags` para varios valores (select múltiple) y `status` para el estado de un registro.
 * - `multiline` para un texto largo (justificación, descripción): se recorta y «Leer más» lo despliega.
 * - `help` para el ícono info con su explicación; sin texto no se muestra.
 * @evitar
 * - Para un dato que el usuario puede cambiar: usar `siaf-input`, `text-area-control` o `siaf-date-time-picker`.
 * - Para un dato fijo dentro de un formulario en edición (ej. el periodo): ahí va el campo `[disabled]`.
 * - Para el ítem elegido desde un panel lateral: usar `siaf-summary-card`; para un aviso breve, `message-box`.
 * - Confundirlo con `siaf-readonly`, el recuadro gris con etiqueta en mayúsculas que ninguna pantalla usa.
 * @teclado
 * - Solo «Leer más» / «Leer menos» y el ícono info reciben foco (Tab); Enter o Espacio despliegan el texto.
 * @accesibilidad
 * - **1.3.1 Información y relaciones (A)**: es texto estático, no un campo: el caption va antes del valor en el DOM,
 *   así que se leen juntos y en orden; los chips van en una lista.
 * - **1.4.3 Contraste mínimo (AA)**: caption `text-neutral-low` 5.01:1, valor `text-neutral-medium` 14.53:1 (también
 *   sobre `bg-surfaces-highlight`), «Leer más» `text-brand-primary` y asterisco `text-feedback-danger`.
 * - **4.1.2 Nombre, función y valor (A)**: «Leer más» es un botón con `aria-expanded`; el ícono info se llama «Ayuda».
 * - **1.4.1 Uso del color (A)**: el obligatorio se marca con un asterisco, no solo con el color.
 */
@Component({
  selector: 'readonly-field',
  standalone: true,
  imports: [IconComponent, RecordStatusTagComponent, TooltipDirective],
  styles: `
    :host {
      display: block;
      min-width: 0;
    }
  `,
  template: `
    <div class="grid w-full min-w-0">
      <div
        class="relative flex min-h-10 items-center gap-siaf-xs rounded-siaf-md px-siaf-md py-siaf-xs"
        [class.bg-[var(--sys-color-bg-surfaces-highlight)]]="highlight"
      >
        <span class="siaf-text-caption-1-medium absolute -top-2.5 left-3 z-[1] rounded-siaf-sm bg-surface px-siaf-xxs text-[var(--sys-color-text-neutral-low)]">
          {{ captionText }}@if (required) { <span class="text-[var(--sys-color-text-feedback-danger)]">*</span> }
        </span>

        <div class="min-w-0 flex-1">
          @if (status) {
            <siaf-record-status-tag [status]="status" size="small" />
          } @else if (tags.length) {
            <ul class="m-0 flex list-none flex-wrap gap-siaf-xs p-0">
              @for (tag of tags; track tag) {
                <li class="siaf-text-body-2 rounded-siaf-md border border-[var(--sys-color-border-states-enabled)] px-siaf-xs py-siaf-xxs leading-none text-[var(--sys-color-text-neutral-medium)]">{{ tag }}</li>
              }
            </ul>
          } @else {
            <p
              class="siaf-text-body-2 m-0 break-words text-[var(--sys-color-text-neutral-medium)]"
              [class.siaf-text-body-2-bold]="bold"
              [class.text-right]="align === 'right'"
              [class.line-clamp-3]="recortado()"
              data-valor
            >{{ displayValue }}</p>
            @if (conLeerMas) {
              <button
                class="siaf-text-caption-1-medium mt-siaf-xs block w-full rounded-siaf-sm text-right text-[var(--sys-color-text-brand-primary)] hover:underline focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                type="button"
                [attr.aria-expanded]="!recortado()"
                (click)="expandido.set(!expandido())"
              >{{ recortado() ? 'Leer más' : 'Leer menos' }}</button>
            }
          }
        </div>

        @if (help) {
          <span
            class="inline-flex shrink-0 self-start rounded-siaf-sm text-[var(--sys-color-text-neutral-medium)] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
            tabindex="0"
            role="img"
            aria-label="Ayuda"
            [siafTooltip]="help"
          >
            <siaf-icon name="info" [size]="24" />
          </span>
        }
      </div>

      @if (hint) {
        <span class="siaf-text-caption-1 px-siaf-md pt-siaf-xxs text-text-muted">{{ hint }}</span>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReadonlyFieldComponent {
  @Input() caption = '';
  @Input() value: string | number | null = '';
  @Input() required = false;
  /** `right` para importes. */
  @Input() align: 'left' | 'right' = 'left';
  @Input() bold = false;
  /** Fondo `bg-surfaces-highlight` para el dato que hay que destacar. */
  @Input() highlight = false;
  /** Varios valores como chips (select múltiple). */
  @Input() tags: string[] = [];
  /** Estado de un registro con `siaf-record-status-tag`. */
  @Input() status: RecordStatus | '' = '';
  /** Texto largo: se recorta y ofrece «Leer más». */
  @Input() multiline = false;
  /** Explicación del ícono info; sin texto no se muestra. */
  @Input() help = '';
  /** Texto de apoyo debajo del valor. */
  @Input() hint = '';

  readonly expandido = signal(false);

  get captionText(): string {
    return this.caption.replace(/\s*\*$/, '');
  }

  get displayValue(): string {
    const valor = this.value === null || this.value === undefined ? '' : String(this.value);
    return valor.trim() ? valor : '--';
  }

  get conLeerMas(): boolean {
    return this.multiline && this.displayValue.length > READONLY_LEER_MAS_DESDE;
  }

  recortado(): boolean {
    return this.conLeerMas && !this.expandido();
  }
}
