import type { PerfilItem } from '../core/api/auth-api.service';

/**
 * Usuarios de demostración del taller. Entran con su DNI y la contraseña común.
 *
 * - Ana (creador) registra y verifica solicitudes.
 * - Luis (aprobador) aprueba, observa o rechaza lo verificado.
 * - Rosa (creador autorizador) es la única que crea y autoriza documentos de autorización excepcional (RAUT).
 * - Jorge (visualizador de documentos) solo consulta: ve los documentos y registros, sin ninguna acción.
 * - Carla tiene los dos perfiles: sirve para mostrar el cambio de perfil desde el menú del usuario.
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

export const USUARIOS_DEMO: UsuarioDemo[] = [
  {
    id: 'usr-ana',
    dni: '45872163',
    email: 'ana.torres@taller.pe',
    nombres: 'Ana',
    apellidoPaterno: 'Torres',
    apellidoMaterno: 'Díaz',
    rol: 'Creador',
    descripcion: 'Creador: registra y verifica solicitudes',
    perfiles: [perfil('perfil-ana-creador', 'CREADOR', 'Creador', 'Operador de cuentas bancarias')],
  },
  {
    id: 'usr-luis',
    dni: '70318246',
    email: 'luis.ramirez@taller.pe',
    nombres: 'Luis',
    apellidoPaterno: 'Ramírez',
    apellidoMaterno: 'Soto',
    rol: 'Aprobador',
    descripcion: 'Aprobador: aprueba, observa o rechaza',
    perfiles: [perfil('perfil-luis-aprobador', 'APROBADOR', 'Aprobador', 'Aprobador de cuentas bancarias')],
  },
  {
    id: 'usr-carla',
    dni: '41269587',
    email: 'carla.mendoza@taller.pe',
    nombres: 'Carla',
    apellidoPaterno: 'Mendoza',
    apellidoMaterno: 'Ríos',
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
    email: 'jorge.salas@taller.pe',
    nombres: 'Jorge',
    apellidoPaterno: 'Salas',
    apellidoMaterno: 'Vega',
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
    email: 'rosa.quispe@taller.pe',
    nombres: 'Rosa',
    apellidoPaterno: 'Quispe',
    apellidoMaterno: 'Huamán',
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
