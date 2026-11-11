import { Routes } from '@angular/router';

import { salidaProtegidaGuard } from '../../core/state/salida-protegida';

/** Procesos de tesorería del taller: traslados (ejemplo), saldos iniciales y autorizaciones. Cada uno con su bandeja y su solicitud. */
export const TESORERIA_ROUTES: Routes = [
  {
    path: 'procesos/autorizaciones',
    loadComponent: () =>
      import('./autorizaciones/pages/documents/autorizaciones-documents.component').then((m) => m.AutorizacionesDocumentsComponent),
  },
  {
    path: 'procesos/autorizaciones/solicitud',
    canDeactivate: [salidaProtegidaGuard],
    loadComponent: () =>
      import('./autorizaciones/pages/solicitud/autorizacion-request.component').then((m) => m.AutorizacionRequestComponent),
  },
  {
    path: 'procesos/autorizaciones/registro/:registroId',
    loadComponent: () =>
      import('./autorizaciones/pages/registro/autorizacion-registro-detalle.component').then((m) => m.AutorizacionRegistroDetalleComponent),
  },
  {
    path: 'procesos/autorizaciones/solicitud/:id',
    canDeactivate: [salidaProtegidaGuard],
    loadComponent: () =>
      import('./autorizaciones/pages/solicitud/autorizacion-request.component').then((m) => m.AutorizacionRequestComponent),
  },
  // Rutas anteriores del proceso (cuando se llamaba «registro de cuentas bancarias»): redirigen a las nuevas.
  { path: 'procesos/registro-cuentas-bancarias', pathMatch: 'full', redirectTo: '/procesos/traspasos-cuentas-registros' },
  { path: 'procesos/registro-cuentas-bancarias/solicitud', redirectTo: '/procesos/traspasos-cuentas-registros/solicitud' },
  { path: 'procesos/registro-cuentas-bancarias/solicitud/:id', redirectTo: '/procesos/traspasos-cuentas-registros/solicitud/:id' },
  { path: 'procesos/registro-cuentas-bancarias/consultas', redirectTo: '/procesos/traspasos-cuentas-registros/consultas' },
  {
    path: 'procesos/traspasos-cuentas-registros',
    loadComponent: () =>
      import('./traspasos-cuentas-registros/pages/documents/traslados-documents.component').then(
        (m) => m.TrasladosDocumentsComponent,
      ),
  },
  {
    path: 'procesos/traspasos-cuentas-registros/solicitud',
    canDeactivate: [salidaProtegidaGuard],
    loadComponent: () =>
      import('./traspasos-cuentas-registros/pages/solicitud/traslado-request.component').then(
        (m) => m.TrasladoRequestComponent,
      ),
  },
  {
    path: 'procesos/traspasos-cuentas-registros/solicitud/:id',
    canDeactivate: [salidaProtegidaGuard],
    loadComponent: () =>
      import('./traspasos-cuentas-registros/pages/solicitud/traslado-request.component').then(
        (m) => m.TrasladoRequestComponent,
      ),
  },
  {
    path: 'procesos/traspasos-cuentas-registros/consultas',
    loadComponent: () =>
      import('./traspasos-cuentas-registros/pages/consultas/traslados-consultas.component').then(
        (m) => m.TrasladosConsultasComponent,
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
    canDeactivate: [salidaProtegidaGuard],
    loadComponent: () =>
      import('./saldos-iniciales/pages/solicitud/saldos-iniciales-request.component').then(
        (m) => m.SaldosInicialesRequestComponent,
      ),
  },
  {
    path: 'procesos/saldos-iniciales/solicitud/:id',
    canDeactivate: [salidaProtegidaGuard],
    loadComponent: () =>
      import('./saldos-iniciales/pages/solicitud/saldos-iniciales-request.component').then(
        (m) => m.SaldosInicialesRequestComponent,
      ),
  },
  {
    path: 'procesos/saldos-iniciales/automatico/:id',
    loadComponent: () =>
      import('./saldos-iniciales/pages/automatico/saldos-apertura-documento.component').then(
        (m) => m.SaldosAperturaDocumentoComponent,
      ),
  },
  {
    path: 'procesos/saldos-iniciales/ajuste/:id',
    loadComponent: () =>
      import('./saldos-iniciales/pages/ajuste/ajuste-saldo-documento.component').then(
        (m) => m.AjusteSaldoDocumentoComponent,
      ),
  },
  {
    path: 'procesos/saldos-iniciales/documento/:documentoId/saldo/:saldoId',
    loadComponent: () =>
      import('./saldos-iniciales/pages/registro/saldo-inicial-detalle.component').then(
        (m) => m.SaldoInicialDetalleComponent,
      ),
  },
  {
    path: 'procesos/saldos-iniciales/registro/:registroId',
    loadComponent: () =>
      import('./saldos-iniciales/pages/registro/saldo-inicial-detalle.component').then(
        (m) => m.SaldoInicialDetalleComponent,
      ),
  },
];
