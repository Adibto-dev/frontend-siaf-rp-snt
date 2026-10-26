import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

import { TextFieldComponent } from '../../shared/ui/text-field/text-field.component';
import { TreeViewComponent, TreeViewNode } from '../../shared/ui/tree-view/tree-view.component';
import { DEFAULT_PROCESS_TREE, ProcessMenuNode } from '../../shared/utils/process-tree.util';

// El árbol/tipo/utilidad de búsqueda viven en shared/utils/process-tree.util
// (shared no puede depender de layout). Se re-exportan acá para no romper a
// los consumidores existentes que ya importan desde este archivo.
export type { ProcessMenuNode };
export { DEFAULT_PROCESS_TREE, findProcessPathById } from '../../shared/utils/process-tree.util';

/**
 * Árbol canónico de procesos del shell: el menú jerárquico que abre la opción "Procesos" del sidebar.
 *
 * Sus datos por defecto son `DEFAULT_PROCESS_TREE` de `shared/utils/process-tree.util` (este archivo solo
 * re-exporta el tipo y las utilidades). Es el único menú en árbol: el shell también lo usa para "Ajustes" con
 * `ADMIN_MENU_TREE` y otros textos, así que un árbol nuevo es solo otro arreglo de nodos. El árbol es
 * `siaf-tree-view` del kit (estados del Figma y teclado de árbol); este componente le suma el panel, los títulos y
 * el buscador, que funciona como paleta de comandos: filtra la navegación en vivo, sin ir al servidor, y abre las
 * ramas con coincidencias. Los nodos `comingSoon` se ven deshabilitados y solo se abren: nunca emiten `nodeSelected`.
 *
 * @usar
 * - Para el panel Procesos del armazón: `siaf-app-shell` lo abre desde el rail y navega a la `moduleRoute` o
 *   `createRoute` del nodo emitido (plan de cuentas contables, catálogo de eventos, asientos de ajuste, apertura
 *   contable…).
 * - Para el menú Ajustes: el mismo componente con `ADMIN_MENU_TREE` y sus textos (`title`, `subtitle`, `placeholder`,
 *   `searchLabel`), con gestión de usuarios, entidades y auditoría.
 * - Para cualquier menú jerárquico nuevo del armazón: basta otro arreglo de `ProcessMenuNode`.
 * @evitar
 * - Para envolverlo o copiarlo en otro componente de menú: por eso se retiró `siaf-admin-menu`; basta pasarle otros
 *   `nodes` y textos.
 * - Para un árbol dentro de una pantalla (plan de cuentas, clasificador): usar `siaf-tree-view` directamente.
 * - Para buscar registros en el servidor: usar `siaf-form-table-search` (en Documentos y registros y la bandeja, su
 *   variante `siaf-records-search-toolbar`); este buscador solo filtra la navegación en memoria.
 * @teclado
 * - **Tab**: pasa por el buscador y su lupa, y luego entra al árbol una sola vez (en el nodo elegido o el primero).
 * - **Escribir en el buscador**: filtra el árbol en vivo, sin distinguir tildes ni mayúsculas, y abre las ramas con
 *   coincidencias.
 * - **En el árbol**: ↓ / ↑ entre nodos, → abre o entra al primer hijo, ← cierra o sube al padre, Inicio / Fin, y
 *   Enter / Espacio eligen el nodo (y abren o cierran su rama). Ver `siaf-tree-view`.
 * @accesibilidad
 * - **1.3.1 Información y relaciones (A)**: `<aside>` con `h2` y `h3`; el árbol es `role="tree"` con nivel y posición
 *   de cada nodo (`siaf-tree-view`). Pendiente: el `aria-label` del `aside` es fijo («Menu de procesos») y también se
 *   lee en Ajustes.
 * - **1.4.1 Uso del color (A)**: el nodo elegido va con fondo `light-activated`, color azul y negrita.
 * - **1.4.3 Contraste mínimo (AA)**: en claro, título `text-neutral-high` 16.29:1 y nodos `text-neutral-medium` 14.53:1
 *   sobre blanco; en oscuro el panel usa `bg-surfaces-field` y falta medirlo.
 * - **2.4.7 Foco visible (AA)**: el nodo con foco muestra la capa de foco y un contorno azul de 2 px.
 * - **Pendiente · 2.4.3 Orden del foco (A)**: no toma el foco al abrirse ni cierra con Escape. El armazón lo pinta
 *   después del rail: desde Procesos el Tab pasa antes por Ayuda y Ajustes, y si lo pide una página
 *   (`ShellNavigationService`) queda antes que el botón que lo abrió.
 * - **Pendiente · 4.1.3 Mensajes de estado (AA)**: al filtrar no se anuncia cuántos nodos quedan y, sin coincidencias,
 *   el árbol queda vacío y sin mensaje.
 */
@Component({
  selector: 'siaf-process-menu-tree',
  standalone: true,
  imports: [TextFieldComponent, TreeViewComponent],
  template: `
    <aside
      class="flex h-[calc(100vh-56px)] w-screen flex-col bg-[var(--sys-color-bg-surfaces-field,var(--sys-color-bg-surfaces-surface))] text-text shadow-siaf-elevation-1 lg:max-w-[370px]"
      aria-label="Menu de procesos"
    >
      <header class="sticky top-0 z-[2] flex min-h-14 w-full items-center bg-[var(--sys-color-bg-surfaces-field,var(--sys-color-bg-surfaces-surface))] p-siaf-md">
        <h2 class="siaf-text-heading-6-bold-caps m-0 min-h-6 leading-none text-[var(--sys-color-text-neutral-high)]">
          {{ title }}
        </h2>
      </header>

      <div class="min-h-0 flex-1 overflow-y-auto bg-[var(--sys-color-bg-surfaces-field,var(--sys-color-bg-surfaces-surface-highest))] px-siaf-md pt-siaf-xs">
        <!-- Campo del design system: etiqueta flotante y borde de éxito, igual
             que el resto de inputs. A diferencia de los buscadores de datos,
             este filtra la NAVEGACIÓN al teclear (paleta de comandos): el
             tecleo filtra en vivo y no hay viaje al servidor que ahorrar. -->
        <siaf-input
          class="block w-full"
          [label]="placeholder"
          [value]="query()"
          trailingIcon="search"
          [trailingButtonLabel]="searchLabel"
          (valueChange)="onQuery($any($event))"
        />

        <section class="flex w-full flex-col gap-siaf-md overflow-hidden pt-siaf-lg">
          <h3 class="siaf-text-body-2-bold m-0 px-siaf-md text-[var(--sys-color-text-neutral-medium)]">
            {{ subtitle }}
          </h3>

          <siaf-tree-view
            class="pb-siaf-md"
            [nodes]="arbol()"
            [selectedId]="selectedId()"
            [expandAll]="!!query()"
            [ariaLabel]="subtitle"
            (nodeActivated)="activate($event)"
          />
        </section>
      </div>
    </aside>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ProcessMenuTreeComponent {
  @Input() title = 'Procesos';
  @Input() subtitle = 'Seleccionar proceso o procedimiento';
  @Input() placeholder = 'Buscar proceso o procedimiento';
  @Input() searchLabel = 'Buscar proceso o procedimiento';

  @Input() set nodes(value: ProcessMenuNode[] | null | undefined) {
    const nodos = value ?? [];
    this.nodosSig.set(nodos);
    this.selectedId.set(this.buscarElegido(nodos));
  }
  get nodes(): ProcessMenuNode[] {
    return this.nodosSig();
  }

  @Output() nodeSelected = new EventEmitter<ProcessMenuNode>();

  readonly query = signal('');
  readonly selectedId = signal('');
  private readonly nodosSig = signal<ProcessMenuNode[]>(DEFAULT_PROCESS_TREE);
  private readonly originales = new Map<string, ProcessMenuNode>();

  /** Nodos filtrados por la búsqueda y convertidos al árbol del kit. */
  readonly arbol = computed<TreeViewNode[]>(() => {
    const busqueda = this.normalize(this.query());
    const nodos = busqueda ? this.filterNodes(this.nodosSig(), busqueda) : this.nodosSig();
    this.originales.clear();
    return this.aArbol(nodos, true);
  });

  constructor() {
    this.selectedId.set(this.buscarElegido(DEFAULT_PROCESS_TREE));
  }

  activate(node: TreeViewNode): void {
    const original = this.originales.get(node.id);
    if (!original || original.comingSoon) return;
    this.selectedId.set(node.id);
    this.nodeSelected.emit(original);
  }

  onQuery(value: string): void {
    this.query.set(String(value ?? ''));
  }

  private aArbol(nodos: ProcessMenuNode[], raiz: boolean): TreeViewNode[] {
    return nodos.map((n) => {
      this.originales.set(n.id, n);
      return {
        id: n.id,
        label: n.label,
        // Solo las raíces arrancan abiertas, aunque alguien marque expanded en un hijo.
        expanded: raiz && Boolean(n.expanded),
        disabled: Boolean(n.comingSoon),
        children: n.children?.length ? this.aArbol(n.children, false) : undefined,
      };
    });
  }

  private buscarElegido(nodos: ProcessMenuNode[]): string {
    for (const n of nodos) {
      if (n.selected) return n.id;
      const hijo = n.children?.length ? this.buscarElegido(n.children) : '';
      if (hijo) return hijo;
    }
    return '';
  }

  private filterNodes(nodes: ProcessMenuNode[], search: string): ProcessMenuNode[] {
    const result: ProcessMenuNode[] = [];

    for (const node of nodes) {
      const children = node.children ? this.filterNodes(node.children, search) : [];
      const matches = this.normalize(node.label).includes(search);

      if (!matches && children.length === 0) {
        continue;
      }

      result.push({ ...node, children: children.length > 0 ? children : node.children });
    }

    return result;
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .trim();
  }
}
