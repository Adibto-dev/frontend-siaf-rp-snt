// ARCHIVO GENERADO: no editar a mano. Se arma desde docs/menu-procesos.xlsx con `npm run menu:build`.
import type { FilaMenuProcesos } from './process-tree.util';

export const MENU_PROCESOS_FILAS: FilaMenuProcesos[] = [
  { id: 'planeacion-financiera', nombre: 'Planeación financiera', padre: null, orden: 10, estado: 'oculto', tipo: 'proceso' },
  { id: 'gestion-recursos-publicos', nombre: 'Gestión de recursos públicos', padre: null, orden: 10, estado: 'activo', tipo: 'proceso' },
  { id: 'gestion-liquidez', nombre: 'Gestión de liquidez', padre: 'gestion-recursos-publicos', orden: 20, estado: 'activo', tipo: 'subproceso' },
  { id: 'conciliacion-bancaria', nombre: 'Conciliación bancaria', padre: 'gestion-liquidez', orden: 30, estado: 'activo', tipo: 'subproceso' },
  { id: 'reg-saldos-iniciales-lib-bancos-libretas', nombre: 'Registro de saldos iniciales en libro bancos y libretas de cuentas de registro', padre: 'conciliacion-bancaria', orden: 40, estado: 'activo', tipo: 'subproceso' },
  { id: 'doc-saldos-iniciales', nombre: 'Documentos de saldos iniciales', padre: 'reg-saldos-iniciales-lib-bancos-libretas', orden: 50, estado: 'activo', tipo: 'mfd', ruta: '/procesos/saldos-iniciales' },
  { id: 'doc-autorizacion', nombre: 'Documentos de autorización', padre: 'reg-saldos-iniciales-lib-bancos-libretas', orden: 60, estado: 'activo', tipo: 'mfd', ruta: '/procesos/autorizaciones' },
  { id: 'traspasos-cuentas-registros', nombre: 'Traspasos de cuentas de registros', padre: 'gestion-liquidez', orden: 30, estado: 'activo', tipo: 'subproceso' },
  { id: 'doc-traslado-cta-registros', nombre: 'Documentos de traslado entre cuentas de registros', padre: 'traspasos-cuentas-registros', orden: 40, estado: 'activo', tipo: 'mfd', ruta: '/procesos/registro-cuentas-bancarias' },
  { id: 'cons-traslado-cta-registros', nombre: 'Consultas y reportes de traslado entre cuentas de registros', padre: 'traspasos-cuentas-registros', orden: 40, estado: 'activo', tipo: 'mfd', ruta: '/procesos/registro-cuentas-bancarias/consultas' },
  { id: 'clasificadores-catalogos', nombre: 'Clasificadores y catálogos', padre: null, orden: 10, estado: 'proximamente', tipo: 'proceso' },
  { id: 'consultas-reportes', nombre: 'Consultas y reportes', padre: null, orden: 10, estado: 'oculto', tipo: 'proceso' },
];
