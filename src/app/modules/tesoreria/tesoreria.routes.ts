import { Routes } from '@angular/router';

/** Procesos de tesorería del taller: traslados (ejemplo) y saldos iniciales. Cada uno con su bandeja y su solicitud. */
export const TESORERIA_ROUTES: Routes = [
  {
    path: 'procesos/registro-cuentas-bancarias',
    loadComponent: () =>
      import('./cuentas-bancarias/pages/documents/cuentas-bancarias-documents.component').then(
        (m) => m.CuentasBancariasDocumentsComponent,
      ),
  },
  {
    path: 'procesos/registro-cuentas-bancarias/solicitud',
    loadComponent: () =>
      import('./cuentas-bancarias/pages/solicitud/cuenta-bancaria-request.component').then(
        (m) => m.CuentaBancariaRequestComponent,
      ),
  },
  {
    path: 'procesos/registro-cuentas-bancarias/solicitud/:id',
    loadComponent: () =>
      import('./cuentas-bancarias/pages/solicitud/cuenta-bancaria-request.component').then(
        (m) => m.CuentaBancariaRequestComponent,
      ),
  },
  {
    path: 'procesos/registro-cuentas-bancarias/consultas',
    loadComponent: () =>
      import('./cuentas-bancarias/pages/consultas/cuentas-bancarias-consultas.component').then(
        (m) => m.CuentasBancariasConsultasComponent,
      ),
  },
  {
    path: 'procesos/saldos-iniciales',
    loadComponent: () =>
      import('./saldos-iniciales/pages/documents/saldos-iniciales-documents.component').then(
        (m) => m.SaldosInicialesDocumentsComponent,
      ),
  },
  {
    path: 'procesos/saldos-iniciales/solicitud',
    loadComponent: () =>
      import('./saldos-iniciales/pages/solicitud/saldos-iniciales-request.component').then(
        (m) => m.SaldosInicialesRequestComponent,
      ),
  },
  {
    path: 'procesos/saldos-iniciales/solicitud/:id',
    loadComponent: () =>
      import('./saldos-iniciales/pages/solicitud/saldos-iniciales-request.component').then(
        (m) => m.SaldosInicialesRequestComponent,
      ),
  },
];
