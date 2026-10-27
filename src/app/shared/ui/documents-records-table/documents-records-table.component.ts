import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { NotificationsStateService } from '../../../core/realtime/notifications-state.service';
import type {
  DocumentsRecordsColumn,
  DocumentsRecordsRow,
  DocumentsRecordsRowAction,
  DocumentsRecordsRowActionEvent,
  DocumentsRecordsTab,
} from '../../types/documents-records.types';
import { FlowStatus, FlowStatusTagComponent } from '../flow-status-tag/flow-status-tag.component';
import { IconComponent } from '../icon/icon.component';
import { RecordStatus, RecordStatusTagComponent } from '../record-status-tag/record-status-tag.component';
import { TooltipDirective } from '../tooltip/tooltip.directive';

export type DocumentsRecordsSelectionChange = {
  row: DocumentsRecordsRow;
  selected: boolean;
};

/**
 * Tabla de las pestañas Documentos / Registros: columnas configurables, celdas por tipo
 * (enlace al documento, tag de flujo, tag de registro), checkbox de selección y botón de historial.
 *
 * Es la tabla interna de `siaf-documents-records-page`; para una grilla nueva compón la grilla
 * estándar (`siaf-table-controls` arriba + `siaf-pagination Bottom` abajo) alrededor de ella.
 *
 * @usar
 * - En las pestañas Documentos / Registros de `siaf-documents-records-page` (plan de cuentas, asiento de ajuste,
 *   catálogo de ajuste, catálogos de eventos, apertura contable y contabilización).
 * - Cuando las columnas vienen de configuración (`DocumentsRecordsColumn` con `kind`, `align` y `widthClass`) y el
 *   panel de columnas decide cuáles se ven.
 * - Con `headerGroup` en columnas seguidas para agruparlas bajo una cabecera común (Saldos iniciales: «Cuenta
 *   bancaria», «Libro bancos» y «Documentos»): la cabecera pasa a dos filas.
 * - Con `rowActions` para íconos por fila en Registros antes del historial (Saldos iniciales: ver documento de
 *   sustento, deshabilitado sin archivo, y ver cuentas de registro); se deshabilitan por fila con `disabled`.
 * - Con `selectionDisabled` para dejar marcables solo los documentos de la acción masiva: Elaborados para el creador
 *   (Verificar) y Verificados para el aprobador (Aprobar).
 * @evitar
 * - Para un listado de solo lectura con texto plano: `siaf-table`.
 * - Usarla sola, sin barra ni paginado: va dentro de la grilla estándar (`siaf-table-controls` arriba, con el
 *   seleccionar todo, y `siaf-pagination` con `position="Bottom"` y `rowPage` abajo).
 * - Mientras llegan las filas: `siaf-table-skeleton` con las mismas columnas y `minWidthClass`, no la tabla vacía.
 * - Copiar su marcado en otra pantalla: `siaf-tray-documents-view` todavía tiene una tabla parecida hecha a mano.
 * @teclado
 * - **Tab**: recorre, fila por fila, el checkbox (solo en Documentos), el enlace al documento y el botón de historial;
 *   un checkbox deshabilitado queda fuera.
 * - **Espacio**: marca o desmarca el checkbox de la fila (emite `selectionChanged`).
 * - **Enter**: en el enlace, abre el documento (`routerLink`).
 * - **Enter / Espacio**: en el botón de historial, emiten `historyOpened`; en una acción de `rowActions`,
 *   `rowActionTriggered`. Una acción deshabilitada queda fuera del Tab.
 * @accesibilidad
 * - **1.3.1 Información y relaciones (A)**: `<table>` con `<thead>` y un `<th scope="col">` por columna; los grupos
 *   (`headerGroup`) van en una primera fila con `<th scope="colgroup">` y `colspan`, y las columnas sueltas y las del
 *   checkbox e historial ocupan las dos filas (`rowspan`). Las del checkbox y del historial tienen el `<th>` vacío. No
 *   ordena columnas, así que no aplica `aria-sort`.
 * - **Pendiente · 4.1.2 Nombre, función y valor (A)**: el checkbox de cada fila no tiene nombre (ni `aria-label` ni
 *   `<label>`). El botón de historial sí lleva `aria-label`, pero en Registros dice siempre «Ver historial de cuenta
 *   contable», también en los asientos de ajuste.
 * - **Pendiente · 2.1.1 Teclado (A)**: la fila no es clicable y sus acciones son nativas, pero el texto completo de
 *   las cabeceras y celdas cortadas solo sale con `siafTooltip` al pasar el mouse: esas celdas no reciben foco (el
 *   enlace sí lo muestra al enfocarlo).
 * - **1.4.13 Contenido en hover o foco (AA)**: ese tooltip se cierra con Escape y se puede recorrer con el puntero.
 * - **Pendiente · 1.4.3 Contraste mínimo (AA)**: el enlace va en `text-neutral-high` (16.29:1 / 16.53:1) y «Nuevo» en
 *   blanco sobre `bg-brand-primary` (8.79:1 / 6.67:1), pero la etiqueta Observado de `siaf-flow-status-tag` (también
 *   Pendiente y Fallido) da 3.39:1 en claro, y el enlace en hover (`text-brand-primary`) pinta en oscuro con
 *   `bg-brand-primary` (2.66:1 sobre la superficie).
 * - **1.4.1 Uso del color (A)**: los estados llevan su nombre en la etiqueta y «Nuevo» es texto.
 * - **2.4.7 Foco visible (AA)**: sin estilo propio: enlace, checkbox y botón muestran el anillo nativo del navegador.
 * - **2.5.8 Tamaño del objetivo (AA)**: botón de historial de 32 px; el checkbox mide 16 px, pero cumple por
 *   espaciado (celda de 40 × 58 px).
 */
@Component({
  selector: 'siaf-documents-records-table',
  standalone: true,
  imports: [FlowStatusTagComponent, IconComponent, NgClass, RecordStatusTagComponent, RouterLink, TooltipDirective],
  template: `
    <div class="siaf-table-scroll min-w-0">
      <table class="siaf-text-body-2 w-full border-collapse text-left" [ngClass]="minWidthClass">
        <thead>
          <tr class="siaf-text-caption-1-bold-caps h-10 bg-surface-high text-text">
            @if (activeTab === 'documents') {
              <th class="w-10 rounded-l-siaf-sm px-siaf-sm py-siaf-sm" [attr.rowspan]="conGrupos ? 2 : null"></th>
            }
            @for (celda of cabeceraSuperior; track celda.clave) {
              @if (celda.columna; as column) {
                <!-- MFD RF-01: al superponer el mouse se muestra el texto completo de la columna -->
                <th class="truncate px-siaf-md py-siaf-sm" scope="col" siafTooltip [attr.rowspan]="conGrupos ? 2 : null" [ngClass]="[column.widthClass || 'w-[180px]', column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left']">{{ column.label }}</th>
              } @else {
                <th class="truncate border-b border-[var(--sys-color-divider-strong)] px-siaf-md py-siaf-sm text-center" scope="colgroup" siafTooltip [attr.colspan]="celda.span">{{ celda.grupo }}</th>
              }
            }
            <th class="sticky right-0 w-14 rounded-r-siaf-sm border-l border-[var(--sys-color-divider-strong)] bg-surface-high px-siaf-sm py-siaf-sm" [attr.rowspan]="conGrupos ? 2 : null"></th>
          </tr>
          @if (conGrupos) {
            <tr class="siaf-text-caption-1-bold-caps h-10 bg-surface-high text-text">
              @for (column of columnasAgrupadas; track column.key) {
                <th class="truncate px-siaf-md py-siaf-sm" scope="col" siafTooltip [ngClass]="[column.widthClass || 'w-[180px]', column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left']">{{ column.label }}</th>
              }
            </tr>
          }
        </thead>
        <tbody>
          @for (row of rows; track rowTrackValue(row, $index)) {
            <tr
              class="border-b border-[var(--sys-color-divider-default)] bg-surface hover:bg-[var(--sys-color-bg-states-light-hover)]"
              [class.h-12]="activeTab === 'records'"
              [class.cursor-pointer]="filaNavegable(row)"
              [attr.tabindex]="filaNavegable(row) ? 0 : null"
              [attr.aria-label]="filaNavegable(row) ? (activeTab === 'documents' ? 'Abrir documento' : 'Ver detalle del registro') : null"
              (click)="abrirRegistro(row, $event)"
              (keydown.enter)="abrirRegistro(row, $event)"
            >
              @if (activeTab === 'documents') {
                <td class="h-[58px] px-siaf-sm py-siaf-xs" data-sin-clic-fila>
                  <input
                    class="size-4 disabled:cursor-not-allowed"
                    type="checkbox"
                    [checked]="row.selected"
                    [disabled]="selectionDisabled(row)"
                    (change)="onSelectionChange(row, $event)"
                  />
                </td>
              }
              @for (column of columns; track column.key) {
                <td class="px-siaf-md py-siaf-sm" [ngClass]="[column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left', column.kind === 'document-link' ? 'max-w-[440px]' : '']">
                  @if (column.kind === 'document-link') {
                    <span class="flex min-w-0 items-center gap-siaf-xs">
                      <a class="siaf-text-body-2 min-w-0 flex-1 truncate text-text hover:text-brand-primary" siafTooltip [routerLink]="documentRoute(row)" (click)="onDocumentClick(row)">{{ row[column.key] }}</a>
                      @if (row['isNew']) {
                        <span class="siaf-text-caption-2-bold inline-flex shrink-0 items-center rounded-full bg-brand-primary px-2 py-0.5 tracking-wide text-white">Nuevo</span>
                      }
                    </span>
                  } @else if (column.kind === 'flow-status') {
                    <siaf-flow-status-tag [status]="flowStatus(row[column.key])" size="small" />
                  } @else if (column.kind === 'record-status') {
                    <siaf-record-status-tag [status]="recordStatus(row[column.key])" [size]="activeTab === 'records' ? 'small' : 'standard'" />
                  } @else {
                    <span class="block truncate" siafTooltip>{{ row[column.key] }}</span>
                  }
                </td>
              }
              <td data-sin-clic-fila class="sticky right-0 border-l border-[var(--sys-color-divider-strong)] bg-surface px-siaf-sm py-siaf-xs">
                <span class="flex items-center gap-siaf-xs">
                @for (accion of accionesVisibles; track accion.id) {
                  <button
                    class="inline-flex size-8 items-center justify-center rounded-siaf-md transition hover:bg-surface-muted active:bg-[var(--sys-color-bg-states-dark-pressed)] disabled:cursor-not-allowed disabled:bg-transparent disabled:text-[var(--sys-color-text-neutral-disabled)]"
                    type="button"
                    [attr.aria-label]="accion.label"
                    [siafTooltip]="accion.label"
                    [disabled]="accionDeshabilitada(accion, row)"
                    (click)="rowActionTriggered.emit({ actionId: accion.id, row })"
                  >
                    <siaf-icon [name]="accion.icon" [size]="20" />
                  </button>
                }
                <button class="inline-flex size-8 items-center justify-center rounded-siaf-md transition hover:bg-surface-muted active:bg-[var(--sys-color-bg-states-dark-pressed)]" type="button" [attr.aria-label]="activeTab === 'records' ? 'Ver historial del registro' : 'Historial de documento'" [title]="activeTab === 'records' ? 'Ver historial del registro' : 'Historial de documento'" (click)="historyOpened.emit(row)">
                  <siaf-icon name="history" [size]="20" />
                </button>
                </span>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DocumentsRecordsTableComponent {
  private readonly notificationsState = inject(NotificationsStateService);
  private readonly router = inject(Router);

  @Input() activeTab: DocumentsRecordsTab = 'documents';
  @Input() set columns(value: DocumentsRecordsColumn[] | null | undefined) {
    this._columns = value ?? [];
    this.armarCabecera();
  }
  get columns(): DocumentsRecordsColumn[] {
    return this._columns;
  }
  private _columns: DocumentsRecordsColumn[] = [];

  /** Hay al menos una columna con `headerGroup`: la cabecera va en dos filas. */
  conGrupos = false;
  /** Primera fila de la cabecera: columnas sueltas (ocupan las dos filas) o grupos de columnas seguidas. */
  cabeceraSuperior: { clave: string; columna?: DocumentsRecordsColumn; grupo?: string; span?: number }[] = [];
  /** Segunda fila: las columnas que están dentro de un grupo, en orden. */
  columnasAgrupadas: DocumentsRecordsColumn[] = [];

  private armarCabecera(): void {
    const superior: typeof this.cabeceraSuperior = [];
    for (const columna of this._columns) {
      const anterior = superior[superior.length - 1];
      if (!columna.headerGroup) {
        superior.push({ clave: columna.key, columna });
      } else if (anterior?.grupo === columna.headerGroup) {
        anterior.span = (anterior.span ?? 1) + 1;
      } else {
        superior.push({ clave: `grupo-${columna.key}`, grupo: columna.headerGroup, span: 1 });
      }
    }
    this.cabeceraSuperior = superior;
    this.columnasAgrupadas = this._columns.filter((c) => c.headerGroup);
    this.conGrupos = this.columnasAgrupadas.length > 0;
  }
  @Input() rows: DocumentsRecordsRow[] = [];
  @Input() minWidthClass = '';
  @Input() recordTrackKey = '';
  @Input() documentRoute: (row: DocumentsRecordsRow) => string = () => '';
  @Input() selectionDisabled: (row: DocumentsRecordsRow) => boolean = () => false;

  @Output() selectionChanged = new EventEmitter<DocumentsRecordsSelectionChange>();
  @Output() historyOpened = new EventEmitter<DocumentsRecordsRow>();
  /** Clic en una de `rowActions` (solo en Registros). */
  @Output() rowActionTriggered = new EventEmitter<DocumentsRecordsRowActionEvent>();

  /** Acciones de ícono por fila, antes del historial; solo se pintan en la pestaña Registros. */
  @Input() rowActions: DocumentsRecordsRowAction[] = [];

  /** Ruta del detalle de un registro: la fila entera de Registros lo abre. */
  @Input() recordRoute: ((row: DocumentsRecordsRow) => string) | null = null;

  filaNavegable(row: DocumentsRecordsRow): boolean {
    return !!this.rutaDeFila(row);
  }

  /** Documentos: la solicitud del documento; Registros: el detalle del registro (si la página lo define). */
  private rutaDeFila(row: DocumentsRecordsRow): string {
    return this.activeTab === 'documents' ? this.documentRoute(row) : this.recordRoute?.(row) ?? '';
  }

  /** Abre el documento o el registro, salvo que el clic sea en un control de la fila o en su celda (checkbox, botón, enlace o colapsable). */
  abrirRegistro(row: DocumentsRecordsRow, evento: Event): void {
    if (!this.filaNavegable(row)) return;
    const origen = evento.target as HTMLElement | null;
    if (origen?.closest('button, a, input, select, textarea, label, summary, [role="button"], [data-sin-clic-fila]')) return;
    if (this.activeTab === 'documents') this.onDocumentClick(row);
    void this.router.navigateByUrl(this.rutaDeFila(row));
  }

  get accionesVisibles(): DocumentsRecordsRowAction[] {
    return this.activeTab === 'records' ? this.rowActions : [];
  }

  accionDeshabilitada(accion: DocumentsRecordsRowAction, row: DocumentsRecordsRow): boolean {
    return accion.disabled?.(row) ?? false;
  }

  rowTrackValue(row: DocumentsRecordsRow, index: number): string | number {
    const key = this.activeTab === 'documents' ? 'number' : this.recordTrackKey;
    const value = row[key];
    // Si el valor está vacío o es placeholder ("—", "-"), usar index para evitar colisiones
    if (!value || value === '—' || value === '-') {
      return `idx-${index}`;
    }
    return String(value);
  }

  onDocumentClick(row: DocumentsRecordsRow): void {
    const documentId = row['documentId'];
    if (typeof documentId === 'string' && documentId) {
      void this.notificationsState.marcarLeidaPorDocumento(documentId);
    }
  }

  onSelectionChange(row: DocumentsRecordsRow, event: Event): void {
    this.selectionChanged.emit({
      row,
      selected: (event.target as HTMLInputElement).checked
    });
  }

  recordStatus(value: unknown): RecordStatus {
    const statuses: RecordStatus[] = ['Activo', 'Inactivo', 'Anulado', 'En Proceso', 'Validado', 'Eliminado', 'Abierto', 'Cerrado', 'Procesado'];
    return statuses.includes(value as RecordStatus) ? (value as RecordStatus) : 'Activo';
  }

  flowStatus(value: unknown): FlowStatus {
    const statuses: FlowStatus[] = [
      'Elaborado',
      'Registrado',
      'Verificado',
      'Validado',
      'Revisado',
      'Generado',
      'En proceso',
      'Autorizado',
      'Firmado',
      'Aprobado',
      'Aceptado',
      'Publicado',
      'Procesado',
      'Observado',
      'Pendiente',
      'Fallido',
      'Eliminado',
      'Rechazado',
      'Anulado'
    ];

    return statuses.includes(value as FlowStatus) ? (value as FlowStatus) : 'Elaborado';
  }
}

