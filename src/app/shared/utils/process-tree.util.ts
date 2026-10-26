import { MENU_PROCESOS_FILAS } from './menu-procesos.generado';

/**
 * Árbol maestro de procesos + utilidad de búsqueda de ruta.
 * Vive en shared/utils/ (no en layout/) porque lo consumen tanto piezas
 * del shell (layout/process-menu-tree, layout/create-document) como
 * utilidades transversales de shared (breadcrumbs.util) — shared no debe
 * depender de layout, así que la fuente de verdad va acá.
 */
export interface ProcessMenuNode {
  id: string;
  label: string;
  selected?: boolean;
  // Solo debe marcarse en nodos raiz: la vista inicial muestra hasta el segundo nivel.
  expanded?: boolean;
  // Ruta de la página principal del módulo (documentos y registros)
  moduleRoute?: string;
  // Si un nodo tiene estas propiedades, Crear documento puede completar documento/tipo y navegar.
  createRoute?: string;
  documentOptions?: string[];
  documentCreateOptions?: Array<{
    label: string;
    route?: string;
    actionTypes?: string[];
  }>;
  actionTypeOptions?: string[];
  /**
   * Marca un nodo como módulo planificado pero aún no implementado.
   * El menú lo renderiza con texto atenuado y badge "Próximamente",
   * y el click no navega (solo expande si tiene hijos).
   */
  comingSoon?: boolean;
  children?: ProcessMenuNode[];
}

/** Una fila de la planilla `docs/menu-procesos.xlsx` (ver `menu-procesos.generado.ts`). */
export interface FilaMenuProcesos {
  id: string;
  nombre: string;
  /** `id` del elemento superior; `null` en un proceso raíz. */
  padre: string | null;
  /** Posición entre hermanos (10, 20, 30…). */
  orden: number;
  /** `activo` navega, `proximamente` se ve atenuado, `oculto` no aparece (ni sus hijos). */
  estado: 'activo' | 'proximamente' | 'oculto';
  /** Informativo: no cambia cómo se dibuja. */
  tipo?: 'proceso' | 'subproceso' | 'actividad' | 'mfd';
  /** Pantalla que abre (solo en un MFD activo). */
  ruta?: string;
  /** Solo en procesos raíz: arranca desplegado. */
  abiertoAlInicio?: boolean;
}

/**
 * Datos técnicos que no van en la planilla: lo que usa el panel «Crear documento» y el resaltado inicial. Se suman al
 * nodo del mismo `id`. Un proceso nuevo con documentos agrega aquí su entrada cuando su pantalla de solicitud existe.
 */
const DATOS_EXTRA_POR_ID: Record<string, Partial<ProcessMenuNode>> = {
  'gestion-recursos-publicos': { selected: true },
  'doc-traslado-cta-registros': {
    createRoute: '/procesos/registro-cuentas-bancarias/solicitud',
    documentOptions: ['Registro de traslado entre cuentas de registros'],
    documentCreateOptions: [
      {
        label: 'Registro de traslado entre cuentas de registros',
        route: '/procesos/registro-cuentas-bancarias/solicitud',
        actionTypes: ['Creación'],
      },
    ],
    actionTypeOptions: ['Creación'],
  },
  'doc-saldos-iniciales': {
    createRoute: '/procesos/saldos-iniciales/solicitud',
    documentOptions: ['Registro de saldos iniciales'],
    documentCreateOptions: [
      {
        label: 'Registro de saldos iniciales',
        route: '/procesos/saldos-iniciales/solicitud',
        actionTypes: ['Creación'],
      },
    ],
    actionTypeOptions: ['Creación'],
  },
};

/**
 * Arma el árbol del menú a partir de filas planas: agrupa por `padre`, ordena por `orden`, quita lo `oculto` (con sus
 * hijos) y traduce `proximamente` a `comingSoon`. Las validaciones (padres existentes, ids únicos…) las hace
 * `npm run menu:build`.
 */
export function construirArbolDeProcesos(
  filas: readonly FilaMenuProcesos[],
  extras: Record<string, Partial<ProcessMenuNode>> = {},
): ProcessMenuNode[] {
  const hijosDe = new Map<string | null, FilaMenuProcesos[]>();
  for (const fila of filas) {
    if (fila.estado === 'oculto') continue;
    const grupo = hijosDe.get(fila.padre) ?? [];
    grupo.push(fila);
    hijosDe.set(fila.padre, grupo);
  }

  const armar = (padre: string | null): ProcessMenuNode[] =>
    [...(hijosDe.get(padre) ?? [])]
      .sort((a, b) => a.orden - b.orden)
      .map((fila) => {
        const children = armar(fila.id);
        return {
          id: fila.id,
          label: fila.nombre,
          ...(fila.ruta ? { moduleRoute: fila.ruta } : {}),
          ...(fila.abiertoAlInicio && !fila.padre ? { expanded: true } : {}),
          ...(fila.estado === 'proximamente' ? { comingSoon: true } : {}),
          ...extras[fila.id],
          ...(children.length ? { children } : {}),
        };
      });

  return armar(null);
}

/**
 * Árbol de procesos del taller. **Se edita en `docs/menu-procesos.xlsx`** (Excel) y se regenera con
 * `npm run menu:build`; aquí solo se arma. Solo «Registro de cuentas bancarias» está implementado.
 *
 * IDs consumidos por componentes externos (migas de pan con `findProcessPathById`): no renombrarlos.
 *   - doc-traslado-cta-registros    (PROCESS_ID en cuentas-bancarias.rutas.ts)
 *   - cons-traslado-cta-registros   (CONSULTAS_PROCESS_ID)
 * `npm run menu:build` avisa si alguno de estos ids (o una clave de `DATOS_EXTRA_POR_ID`) ya no está en la planilla.
 */
export const DEFAULT_PROCESS_TREE: ProcessMenuNode[] = construirArbolDeProcesos(MENU_PROCESOS_FILAS, DATOS_EXTRA_POR_ID);

/**
 * Nombre visible de un elemento del menú (columna «nombre» de la planilla). Las pantallas lo usan como título para que
 * el menú, las migas de pan y el encabezado digan lo mismo. Si el id no existe, devuelve `respaldo`.
 */
export function nombreDeProceso(id: string, respaldo = ''): string {
  return findProcessPathById(id).at(-1)?.label ?? respaldo;
}

export function findProcessPathById(id: string, nodes: readonly ProcessMenuNode[] = DEFAULT_PROCESS_TREE): ProcessMenuNode[] {
  for (const node of nodes) {
    if (node.id === id) {
      return [node];
    }

    const childPath = findProcessPathById(id, node.children || []);

    if (childPath.length > 0) {
      return [node, ...childPath];
    }
  }

  return [];
}

/**
 * Árbol del menú "Ajustes" (módulo de administración). Lo pinta el mismo `siaf-process-menu-tree`
 * que el menú de procesos, con otros textos. En el taller no hay módulo de administración: las hojas
 * van como «Próximamente» y no navegan.
 */
export const ADMIN_MENU_TREE: ProcessMenuNode[] = [
  {
    id: 'administracion',
    label: 'Administración',
    expanded: true,
    children: [
      {
        id: 'usuarios-accesos',
        label: 'Usuarios y accesos',
        expanded: true,
        children: [
          { id: 'gestion-usuarios', label: 'Gestión de usuarios', comingSoon: true },
          { id: 'perfiles-funcionales', label: 'Perfiles funcionales', comingSoon: true },
        ],
      },
      {
        id: 'organizacion',
        label: 'Organización',
        children: [
          { id: 'entidades', label: 'Entidades', comingSoon: true },
          { id: 'unidades', label: 'Unidades orgánicas', comingSoon: true },
        ],
      },
    ],
  },
];
