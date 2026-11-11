import type { PerfilItem } from '../core/api/auth-api.service';

/**
 * Usuarios de demostración del taller. Entran con su DNI y la contraseña común.
 *
 * - Victoria (creador) registra y verifica solicitudes.
 * - Mateo (aprobador) aprueba, observa o rechaza lo verificado.
 * - Santiago (creador autorizador) es el único que crea y autoriza documentos de autorización excepcional (RAUT).
 * - Valentina (visualizador de documentos) solo consulta: ve los documentos y registros, sin ninguna acción.
 * - Ariana tiene los dos perfiles: sirve para mostrar el cambio de perfil desde el menú del usuario.
 *
 * Son datos de ejemplo: no hay contraseñas reales ni se validan contra un servidor.
 */
export const CONTRASENA_DEMO = 'Demo-DGTP2026';

export interface UsuarioDemo {
  id: string;
  dni: string;
  email: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  /** Qué muestra en el panel de usuarios del login. */
  descripcion: string;
  /** Rol que se ve en las cuentas guardadas del login. */
  rol: string;
  perfiles: PerfilItem[];
  /** Oculto en el panel de usuarios del login (sigue pudiendo entrar con su DNI). Quitarlo para volver a mostrarlo. */
  oculto?: boolean;
}

const ENTIDAD = {
  entidad: 'Ministerio de Economía y Finanzas',
  entidadId: 'ent-mef',
  entidadCodigo: '0001',
  entidadSiglas: 'MEF',
  ue: null,
  ueId: null,
  ueSiglas: null,
  unidad: 'Oficina General de Administración',
  unidadSigla: 'OGA',
  unidadId: 'uo-oga',
  procedimiento: 'Registro de cuentas bancarias',
  procedimientoCodigo: 'RCB',
  nivelAmbito: 'PLIEGO' as const,
  entidadAmbitoId: 'amb-gn',
  entidadAmbitoCodigo: 'GN',
};

function perfil(id: string, rolCodigo: 'CREADOR' | 'APROBADOR' | 'VISUALIZADOR', rol: string, perfilFuncional: string): PerfilItem {
  return { id, ...ENTIDAD, rol, rolCodigo, perfilFuncional };
}

/** Permisos del creador autorizador: los del creador más `authorization.create` (RAUT). */
export const PERMISOS_CREADOR_AUTORIZADOR = [
  'document.create', 'document.edit', 'document.delete', 'document.verify', 'document.read',
  'chart_account.read', 'chart_account.create', 'authorization.create',
];

/**
 * Nombres anteriores de los usuarios de la demo (mismo id). Los datos ya guardados en el navegador los tienen copiados
 * (firmas, historial, avisos): `mock-db.ts` los cambia por los actuales al leerlos, sin perder lo creado.
 */
export const NOMBRES_ANTERIORES: Record<string, { nombres: string; apellidoPaterno: string; apellidoMaterno: string }> = {
  'usr-ana': { nombres: 'Ana', apellidoPaterno: 'Torres', apellidoMaterno: 'Díaz' },
  'usr-luis': { nombres: 'Luis', apellidoPaterno: 'Ramírez', apellidoMaterno: 'Soto' },
  'usr-jorge': { nombres: 'Jorge', apellidoPaterno: 'Salas', apellidoMaterno: 'Vega' },
  'usr-rosa': { nombres: 'Rosa', apellidoPaterno: 'Quispe', apellidoMaterno: 'Huamán' },
  'usr-carla': { nombres: 'Carla', apellidoPaterno: 'Mendoza', apellidoMaterno: 'Ríos' },
};

export const USUARIOS_DEMO: UsuarioDemo[] = [
  {
    id: 'usr-ana',
    dni: '45872163',
    email: 'consultor_ucp10@mef.gob.pe',
    nombres: 'Victoria',
    apellidoPaterno: 'Mendoza',
    apellidoMaterno: 'Paredes',
    rol: 'Creador',
    descripcion: 'Creador: registra y verifica solicitudes',
    perfiles: [perfil('perfil-ana-creador', 'CREADOR', 'Creador', 'Operador de cuentas bancarias')],
  },
  {
    id: 'usr-luis',
    dni: '70318246',
    email: 'consultor_ucp11@mef.gob.pe',
    nombres: 'Mateo',
    apellidoPaterno: 'Flores',
    apellidoMaterno: 'Gutiérrez',
    rol: 'Aprobador',
    descripcion: 'Aprobador: aprueba, observa o rechaza',
    perfiles: [perfil('perfil-luis-aprobador', 'APROBADOR', 'Aprobador', 'Aprobador de cuentas bancarias')],
  },
  {
    id: 'usr-carla',
    dni: '41269587',
    email: 'consultor_ucp12@mef.gob.pe',
    nombres: 'Ariana',
    apellidoPaterno: 'Ramírez',
    apellidoMaterno: 'Vega',
    rol: 'Creador y aprobador',
    oculto: true,
    descripcion: 'Dos perfiles: creador y aprobador (cambia de perfil)',
    perfiles: [
      perfil('perfil-carla-creador', 'CREADOR', 'Creador', 'Operador de cuentas bancarias'),
      perfil('perfil-carla-aprobador', 'APROBADOR', 'Aprobador', 'Aprobador de cuentas bancarias'),
    ],
  },
  {
    id: 'usr-jorge',
    dni: '48219635',
    email: 'consultor_ucp13@mef.gob.pe',
    nombres: 'Valentina',
    apellidoPaterno: 'Espinoza',
    apellidoMaterno: 'Rojas',
    rol: 'Visualizador de documentos',
    descripcion: 'Visualizador de documentos: solo consulta, sin acciones',
    perfiles: [
      {
        ...perfil('perfil-jorge-visualizador', 'VISUALIZADOR', 'Visualizador de documentos', 'Visualizador de documentos'),
        permisos: ['document.read', 'chart_account.read'],
      },
    ],
  },
  {
    id: 'usr-rosa',
    dni: '46153928',
    email: 'consultor_ucp14@mef.gob.pe',
    nombres: 'Santiago',
    apellidoPaterno: 'Castillo',
    apellidoMaterno: 'Vargas',
    rol: 'Creador - Autorizador',
    descripcion: 'Creador autorizador: crea y autoriza autorizaciones excepcionales',
    perfiles: [
      {
        ...perfil('perfil-rosa-autorizador', 'CREADOR', 'Creador', 'Creador autorizador'),
        permisos: PERMISOS_CREADOR_AUTORIZADOR,
      },
    ],
  },
];

export function buscarUsuarioPorPerfil(perfilId: string): { usuario: UsuarioDemo; perfil: PerfilItem } | null {
  for (const usuario of USUARIOS_DEMO) {
    const encontrado = usuario.perfiles.find((p) => p.id === perfilId);
    if (encontrado) return { usuario, perfil: encontrado };
  }
  return null;
}
