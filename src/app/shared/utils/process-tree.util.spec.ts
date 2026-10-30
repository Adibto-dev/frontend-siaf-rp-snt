import { construirArbolDeProcesos, DEFAULT_PROCESS_TREE, findProcessPathById, FilaMenuProcesos, nombreDeProceso } from './process-tree.util';

describe('construirArbolDeProcesos', () => {
  const filas: FilaMenuProcesos[] = [
    { id: 'b', nombre: 'Proceso B', padre: null, orden: 20, estado: 'activo' },
    { id: 'a', nombre: 'Proceso A', padre: null, orden: 10, estado: 'activo', abiertoAlInicio: true },
    { id: 'a-2', nombre: 'Sub A2', padre: 'a', orden: 20, estado: 'proximamente' },
    { id: 'a-1', nombre: 'Sub A1', padre: 'a', orden: 10, estado: 'activo' },
    { id: 'a-1-act', nombre: 'Actividad', padre: 'a-1', orden: 10, estado: 'activo' },
    { id: 'a-1-act-mfd', nombre: 'MFD', padre: 'a-1-act', orden: 10, estado: 'activo', ruta: '/procesos/x' },
    { id: 'a-oculto', nombre: 'Oculto', padre: 'a', orden: 30, estado: 'oculto' },
    { id: 'a-oculto-hijo', nombre: 'Hijo de oculto', padre: 'a-oculto', orden: 10, estado: 'activo' },
  ];

  it('ordena por «orden» en cada nivel, sin importar el orden de las filas', () => {
    const arbol = construirArbolDeProcesos(filas);
    expect(arbol.map((n) => n.id)).toEqual(['a', 'b']);
    expect(arbol[0].children?.map((n) => n.id)).toEqual(['a-1', 'a-2']);
  });

  it('arma tantos niveles como haya y pasa la ruta a moduleRoute', () => {
    const camino = findProcessPathById('a-1-act-mfd', construirArbolDeProcesos(filas));
    expect(camino.map((n) => n.id)).toEqual(['a', 'a-1', 'a-1-act', 'a-1-act-mfd']);
    expect(camino[3].moduleRoute).toBe('/procesos/x');
  });

  it('traduce estados: proximamente → comingSoon; oculto desaparece con sus hijos', () => {
    const arbol = construirArbolDeProcesos(filas);
    expect(findProcessPathById('a-2', arbol).at(-1)?.comingSoon).toBeTrue();
    expect(findProcessPathById('a-oculto', arbol)).toEqual([]);
    expect(findProcessPathById('a-oculto-hijo', arbol)).toEqual([]);
  });

  it('solo abre al inicio los procesos raíz y suma los datos extra por id', () => {
    const arbol = construirArbolDeProcesos(filas, { 'a-1': { createRoute: '/crear' } });
    expect(arbol[0].expanded).toBeTrue();
    expect(arbol[1].expanded).toBeUndefined();
    expect(arbol[0].children?.[0].createRoute).toBe('/crear');
  });
});

describe('DEFAULT_PROCESS_TREE (desde docs/menu-procesos.xlsx)', () => {
  it('el MFD de documentos del proceso de ejemplo existe, navega y conserva los datos de «Crear documento»', () => {
    const documentos = findProcessPathById('doc-traslado-cta-registros', DEFAULT_PROCESS_TREE).at(-1);
    expect(documentos?.moduleRoute).toBe('/procesos/traspasos-cuentas-registros');
    expect(documentos?.createRoute).toBe('/procesos/traspasos-cuentas-registros/solicitud');
    expect(findProcessPathById('cons-traslado-cta-registros', DEFAULT_PROCESS_TREE).length).toBeGreaterThan(0);
  });

  it('nombreDeProceso devuelve el nombre del menú, o el respaldo si el id no existe', () => {
    expect(nombreDeProceso('doc-traslado-cta-registros')).toBe(findProcessPathById('doc-traslado-cta-registros').at(-1)!.label);
    expect(nombreDeProceso('no-existe', 'Respaldo')).toBe('Respaldo');
  });
});
