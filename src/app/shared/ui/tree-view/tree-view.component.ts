import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, ElementRef, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';

import { palabrasDeBusqueda, tramosResaltados } from '../../utils/resaltado-busqueda.util';
import { IconComponent } from '../icon/icon.component';

export interface TreeViewNode {
  id: string;
  label: string;
  /** Ícono opcional después de la flecha (Figma «With icon», p. ej. `folder_open`). */
  icon?: string;
  /** Abierto al aparecer por primera vez. Después lo maneja el árbol (o `expandAll`). */
  expanded?: boolean;
  /** No se puede elegir: se ve en gris y no emite `nodeActivated`. Si tiene hijos, igual se abre y se cierra. */
  disabled?: boolean;
  children?: TreeViewNode[];
}

/** Nodo visible en el orden en que se recorre con las flechas. */
interface NodoVisible {
  node: TreeViewNode;
  nivel: number;
  padreId: string | null;
}

/**
 * Árbol del kit (Figma UI KIT, nodo 18416:125 «Tree view · summary item»): cada ítem lleva la flecha `arrow_right`
 * de 20 px (gira al abrirse), un ícono opcional de 20 px y el texto en Body 2, con 8 px de relleno y radio de 4 px.
 * Estados del Figma: hover (capa `light-hover`), foco (capa `light-focus` y contorno azul), deshabilitado (texto e
 * íconos en gris, cursor `not-allowed` y sin capa de hover) y activado (el elegido: capa `light-activated`, texto Body 2 Bold azul).
 *
 * Es interactivo: un clic o Enter abre o cierra la rama y elige el nodo (`nodeActivated`, `selectedId`); los nodos
 * `disabled` solo se abren. Las ramas recuerdan si están abiertas; `expandAll` las abre todas (para resultados de una
 * búsqueda). Es la base de `siaf-process-menu-tree`.
 *
 * @usar
 * - Para navegar o elegir dentro de una jerarquía: el menú de Procesos y Ajustes (`siaf-process-menu-tree`), un plan
 *   de cuentas, un clasificador o una entidad con sus unidades.
 * - Con `selectedId` para marcar el nodo actual y `(nodeActivated)` para reaccionar a la elección.
 * - Con `icon` en los nodos cuando ayuda a distinguir el tipo (carpeta, entidad, documento).
 * @evitar
 * - Para una lista plana: `siaf-list`.
 * - Para secciones plegables de contenido: `siaf-accordion` o `siaf-expansion-panel`.
 * - Para un menú de acciones: `siaf-menu` o `siaf-cascading-menu`.
 * - Con `highlight` para poner en negrita las palabras buscadas (sin tildes ni mayúsculas) cuando quien arma los
 *   `nodes` los filtra: el árbol no filtra.
 * @teclado
 * - **Tab**: entra al árbol una sola vez, en el nodo elegido (o el primero); otro Tab sale del árbol.
 * - **↓ / ↑**: siguiente o anterior nodo visible.
 * - **→**: abre la rama; si ya está abierta, va al primer hijo.
 * - **←**: cierra la rama; si está cerrada o es una hoja, va al padre.
 * - **Inicio / Fin**: primer o último nodo visible.
 * - **Enter / Espacio**: abre o cierra la rama y elige el nodo (si no está deshabilitado).
 * @accesibilidad
 * - **1.3.1 Información y relaciones (A)**: `role="tree"` con `treeitem` y `group` anidados en `ul`/`li`; cada ítem
 *   publica `aria-level`, `aria-setsize` y `aria-posinset`, así que el lector anuncia nivel y posición.
 * - **4.1.2 Nombre, función y valor (A)**: las ramas publican `aria-expanded`, el elegido `aria-selected="true"` y los
 *   deshabilitados `aria-disabled`. El árbol se nombra con `ariaLabel`. Los íconos son decorativos.
 * - **2.4.7 Foco visible (AA)**: el ítem con foco muestra la capa `light-focus` y un contorno azul de 2 px
 *   (`border-states-focus`, 5.35:1 claro / 10.15:1 oscuro); la capa gris sola no llega a 3:1.
 * - **1.4.1 Uso del color (A)**: el elegido se distingue también por el peso (Bold), no solo por el color.
 * - **1.4.3 Contraste mínimo (AA)**: texto `text-neutral-medium` (14.53:1 / 12.87:1) y el elegido en
 *   `text-neutral-activated`; el deshabilitado está exento.
 */
@Component({
  selector: 'siaf-tree-view',
  standalone: true,
  imports: [IconComponent, NgTemplateOutlet],
  template: `
    <ul class="m-0 flex list-none flex-col gap-siaf-xxs p-0" role="tree" [attr.aria-label]="ariaLabel || null" (keydown)="onKeydown($event)">
      <ng-container *ngTemplateOutlet="ramaTpl; context: { $implicit: nodosSig(), nivel: 1 }" />
    </ul>

    <ng-template #ramaTpl let-items let-nivel="nivel">
      @for (node of items; track node.id; let i = $index) {
        <li
          class="siaf-tree-item m-0 outline-none"
          role="treeitem"
          [attr.data-tree-id]="node.id"
          [attr.aria-level]="nivel"
          [attr.aria-setsize]="items.length"
          [attr.aria-posinset]="i + 1"
          [attr.aria-expanded]="tieneHijos(node) ? abierto(node) : null"
          [attr.aria-selected]="node.id === elegidoSig() ? 'true' : null"
          [attr.aria-disabled]="node.disabled ? 'true' : null"
          [attr.tabindex]="node.id === focoId() ? 0 : -1"
          (focus)="onFocus($event, node)"
          (click)="onClick($event, node)"
        >
          <div
            class="siaf-tree-row flex items-center gap-siaf-xs rounded-siaf-sm p-siaf-xs"
            [class.siaf-tree-row--activado]="node.id === elegidoSig()"
            [class.siaf-tree-row--deshabilitado]="node.disabled"
          >
            @if (tieneHijos(node)) {
              <siaf-icon class="siaf-tree-icono flex shrink-0 transition-transform duration-150" name="arrow_right" [size]="20" [class.rotate-90]="abierto(node)" />
            } @else {
              <span class="size-5 shrink-0" aria-hidden="true"></span>
            }
            @if (node.icon) {
              <siaf-icon class="siaf-tree-icono flex shrink-0" [name]="node.icon" [size]="20" />
            }
            <!-- En una sola línea: un salto entre tramos agregaría espacios al texto -->
            <span class="min-w-0 flex-1" [class]="node.id === elegidoSig() ? 'siaf-text-body-2-bold' : 'siaf-text-body-2'">@for (tramo of tramos(node.label); track $index) {@if (tramo.marca) {<mark class="siaf-text-body-2-bold bg-transparent text-inherit">{{ tramo.texto }}</mark>} @else {<span>{{ tramo.texto }}</span>}}</span>
          </div>

          @if (tieneHijos(node) && abierto(node)) {
            <ul class="m-0 ml-siaf-md mt-siaf-xxs flex list-none flex-col gap-siaf-xxs border-l border-[var(--sys-color-divider-strong)] p-0 pl-siaf-xs" role="group">
              <ng-container *ngTemplateOutlet="ramaTpl; context: { $implicit: node.children, nivel: nivel + 1 }" />
            </ul>
          }
        </li>
      }
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
    }

    .siaf-tree-row {
      color: var(--sys-color-text-neutral-medium);
      cursor: pointer;
      transition: background-color 150ms;
    }

    .siaf-tree-icono {
      color: var(--sys-color-icon-states-enabled);
    }

    .siaf-tree-row:hover {
      background-color: var(--sys-color-bg-states-light-hover);
    }

    /* Foco con teclado: capa del Figma y contorno azul (la capa sola no llega a 3:1). */
    .siaf-tree-item:focus-visible > .siaf-tree-row {
      background-color: var(--sys-color-bg-states-light-focus);
      outline: 2px solid var(--sys-color-border-states-focus);
      outline-offset: -2px;
    }

    .siaf-tree-row--activado,
    .siaf-tree-row--activado:hover {
      background-color: var(--sys-color-bg-states-light-activated);
      color: var(--sys-color-text-neutral-activated);
    }

    .siaf-tree-row--activado .siaf-tree-icono {
      color: var(--sys-color-icon-states-active);
    }

    /* Deshabilitado: no se puede elegir, así que el cursor lo avisa y no hay capa de hover. */
    .siaf-tree-row--deshabilitado,
    .siaf-tree-row--deshabilitado:hover {
      color: var(--sys-color-text-neutral-disabled);
      cursor: not-allowed;
      background-color: transparent;
    }

    .siaf-tree-row--deshabilitado .siaf-tree-icono {
      color: var(--sys-color-icon-states-disabled);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TreeViewComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly nodosSig = signal<TreeViewNode[]>([]);
  readonly elegidoSig = signal('');
  private readonly expandirTodoSig = signal(false);
  private readonly abiertos = signal<ReadonlySet<string>>(new Set());
  /** Ids ya vistos: `expanded` de un nodo solo cuenta la primera vez que aparece. */
  private readonly vistos = new Set<string>();
  private readonly focoSig = signal('');

  @Input() set nodes(value: TreeViewNode[] | null | undefined) {
    const nodos = value ?? [];
    const abiertos = new Set(this.abiertos());
    const recorrer = (lista: TreeViewNode[]) => {
      for (const n of lista) {
        if (!this.vistos.has(n.id)) {
          this.vistos.add(n.id);
          if (n.expanded) abiertos.add(n.id);
        }
        if (n.children?.length) recorrer(n.children);
      }
    };
    recorrer(nodos);
    this.abiertos.set(abiertos);
    this.nodosSig.set(nodos);
  }

  /** Id del nodo elegido (estado «Activated» del Figma). */
  @Input() set selectedId(value: string | null | undefined) {
    this.elegidoSig.set(value ?? '');
  }

  /** Abre todas las ramas (p. ej. mientras hay una búsqueda); mientras está activo no se pueden cerrar. */
  @Input() set expandAll(value: boolean) {
    this.expandirTodoSig.set(value);
  }

  /** Nombre del árbol para el lector de pantalla. */
  @Input() ariaLabel = '';

  /**
   * Texto buscado: cada palabra que aparece en una etiqueta va en negrita (sin distinguir tildes ni mayúsculas).
   * No filtra: el filtrado lo hace quien arma los `nodes`.
   */
  @Input() set highlight(value: string | null | undefined) {
    this.palabrasSig.set(palabrasDeBusqueda(value ?? ''));
  }
  private readonly palabrasSig = signal<string[]>([]);

  /** Parte la etiqueta en tramos marcados y sin marcar según `highlight`. */
  tramos(label: string): { texto: string; marca: boolean }[] {
    return tramosResaltados(label, this.palabrasSig());
  }

  /** Se elige un nodo habilitado (clic, Enter o Espacio). */
  @Output() nodeActivated = new EventEmitter<TreeViewNode>();
  /** Una rama se abre o se cierra. */
  @Output() expandedChange = new EventEmitter<{ id: string; expanded: boolean }>();

  /** Nodos visibles en orden de recorrido. */
  private readonly visibles = computed<NodoVisible[]>(() => {
    this.abiertos();
    this.expandirTodoSig();
    const out: NodoVisible[] = [];
    const recorrer = (lista: TreeViewNode[], nivel: number, padreId: string | null) => {
      for (const node of lista) {
        out.push({ node, nivel, padreId });
        if (this.tieneHijos(node) && this.abierto(node)) recorrer(node.children!, nivel + 1, node.id);
      }
    };
    recorrer(this.nodosSig(), 1, null);
    return out;
  });

  /** Ítem con `tabindex="0"`: el que tuvo el foco, el elegido o el primero visible. */
  readonly focoId = computed(() => {
    const visibles = this.visibles();
    const ids = new Set(visibles.map((v) => v.node.id));
    if (ids.has(this.focoSig())) return this.focoSig();
    if (ids.has(this.elegidoSig())) return this.elegidoSig();
    return visibles[0]?.node.id ?? '';
  });

  tieneHijos(node: TreeViewNode): boolean {
    return Boolean(node.children?.length);
  }

  abierto(node: TreeViewNode): boolean {
    return this.expandirTodoSig() || this.abiertos().has(node.id);
  }

  onFocus(event: FocusEvent, node: TreeViewNode): void {
    // El foco que llega a un hijo también pasa por los `li` padres: solo cuenta el propio.
    if (event.target === event.currentTarget) this.focoSig.set(node.id);
  }

  onClick(event: MouseEvent, node: TreeViewNode): void {
    event.stopPropagation();
    this.focoSig.set(node.id);
    this.activar(node);
  }

  onKeydown(event: KeyboardEvent): void {
    const visibles = this.visibles();
    const i = visibles.findIndex((v) => v.node.id === this.focoId());
    if (i < 0) return;
    const actual = visibles[i];

    switch (event.key) {
      case 'ArrowDown':
        this.enfocar(visibles[Math.min(i + 1, visibles.length - 1)].node.id);
        break;
      case 'ArrowUp':
        this.enfocar(visibles[Math.max(i - 1, 0)].node.id);
        break;
      case 'Home':
        this.enfocar(visibles[0].node.id);
        break;
      case 'End':
        this.enfocar(visibles[visibles.length - 1].node.id);
        break;
      case 'ArrowRight':
        if (!this.tieneHijos(actual.node)) break;
        if (!this.abierto(actual.node)) this.cambiar(actual.node, true);
        else this.enfocar(actual.node.children![0].id);
        break;
      case 'ArrowLeft':
        if (this.tieneHijos(actual.node) && this.abierto(actual.node) && !this.expandirTodoSig()) this.cambiar(actual.node, false);
        else if (actual.padreId) this.enfocar(actual.padreId);
        break;
      case 'Enter':
      case ' ':
        this.activar(actual.node);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  private activar(node: TreeViewNode): void {
    if (this.tieneHijos(node)) this.cambiar(node, !this.abierto(node));
    if (node.disabled) return;
    this.elegidoSig.set(node.id);
    this.nodeActivated.emit(node);
  }

  private cambiar(node: TreeViewNode, abrir: boolean): void {
    if (this.expandirTodoSig()) return;
    const abiertos = new Set(this.abiertos());
    if (abrir) abiertos.add(node.id);
    else abiertos.delete(node.id);
    this.abiertos.set(abiertos);
    this.expandedChange.emit({ id: node.id, expanded: abrir });
  }

  private enfocar(id: string): void {
    this.focoSig.set(id);
    // El ítem ya está en el DOM (se recorre lo visible); se enfoca después de que el tabindex se actualice.
    queueMicrotask(() => this.host.nativeElement.querySelector<HTMLElement>(`[data-tree-id="${CSS.escape(id)}"]`)?.focus());
  }
}
