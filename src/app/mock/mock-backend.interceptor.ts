import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { Observable, of, throwError, timer } from 'rxjs';
import { delay, mergeMap } from 'rxjs/operators';

import type { CambiarPerfilResponse, LoginResponse, PerfilItem } from '../core/api/auth-api.service';
import type { SolicitudResponse } from '../core/api/solicitudes-api.service';
import { APP_CONFIG } from '../core/config/app.config';
import type { EstadoDocumento } from '../core/models/documento.model';
import type { CuentaBancariaDatos } from '../modules/tesoreria/traspasos-cuentas-registros/models/cuenta-bancaria.model';
import { AutorizacionDatos, AutorizacionVigente, CODIGO_DOCUMENTO as CODIGO_AUTORIZACION, PERMISO_AUTORIZAR, PROCEDIMIENTOS, USUARIO_AJUSTE_SALDO, cuentaDeAutorizacion, errorAmpliacion, errorVigencia, estaVigente, responsablePorUsuario } from '../modules/tesoreria/autorizaciones/models/autorizacion.model';
import { CODIGO_DOCUMENTO as CODIGO_SALDOS, SaldosInicialesDatos, calcularAjuste, calcularSaldo, cuentaPorNumero, entidadPorCodigo } from '../modules/tesoreria/saldos-iniciales/models/saldo-inicial.model';
import {
  DatosTaller,
  ENTIDAD_CREADORA,
  NotificacionMock,
  TIPO_DOCUMENTO,
  TIPOS_DOCUMENTO,
  UNIDAD_CREADORA,
  filaHistorial,
  guardarDatos,
  leerDatos,
  nuevoId,
  numeroDocumento,
  registrarAutorizacion,
  registrarSaldos, ROL_SISTEMA, USUARIO_SISTEMA, avisarAutorizacionAjuste, cuentasConSaldoInicial } from './mock-db';
import { CONTRASENA_DEMO, USUARIOS_DEMO, UsuarioDemo, buscarUsuarioPorPerfil } from './usuarios-demo';

/**
 * Backend simulado del taller.
 *
 * Responde las llamadas a `APP_CONFIG.api.baseUrl` como lo haría el backend de SIAF-RP, con los datos de `mock-db.ts`,
 * y deja pasar todo lo demás (assets). Respeta las reglas del flujo de una solicitud: quién puede hacer cada
 * transición, comentario obligatorio al observar o rechazar, sustento obligatorio para elaborar, número al elaborar y
 * registro al aprobar. Para sumar un endpoint: una entrada en `RUTAS` con su manejador.
 */

interface Sesion {
  usuario: UsuarioDemo;
  perfil: PerfilItem;
}

interface Contexto {
  req: HttpRequest<unknown>;
  params: string[];
  query: URLSearchParams;
  sesion: Sesion | null;
  datos: DatosTaller;
}

interface Respuesta {
  status: number;
  body?: unknown;
}

type Manejador = (ctx: Contexto) => Respuesta;

const LATENCIA_MS = 250;

// ─── Token (JWT sin firma: la app solo lee `exp`) ──────────────────

function base64Url(objeto: object): string {
  return btoa(JSON.stringify(objeto)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function firmarToken(usuario: UsuarioDemo, perfil: PerfilItem): string {
  const ahora = Math.floor(Date.now() / 1000);
  const payload = { sub: usuario.id, perfilId: perfil.id, sesionId: 'taller', iat: ahora, exp: ahora + 8 * 3600 };
  return `${base64Url({ alg: 'none', typ: 'JWT' })}.${base64Url(payload)}.taller`;
}

function sesionDelToken(token: string | null | undefined): Sesion | null {
  if (!token) return null;
  try {
    const segmento = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(segmento)) as { perfilId?: string };
    return payload.perfilId ? buscarUsuarioPorPerfil(payload.perfilId) : null;
  } catch {
    return null;
  }
}

// ─── Respuestas ────────────────────────────────────────────────────

const ok = (body: unknown = null, status = 200): Respuesta => ({ status, body });
const error = (status: number, message: string): Respuesta => ({ status, body: { message } });

function nombreCompleto(u: { nombres: string; apellidoPaterno: string; apellidoMaterno: string }): string {
  return `${u.nombres} ${u.apellidoPaterno} ${u.apellidoMaterno}`;
}

function rolDe(perfil: PerfilItem): { codigo: string; nombre: string } {
  return { codigo: perfil.rolCodigo, nombre: perfil.rol };
}

// ─── Autenticación ─────────────────────────────────────────────────

function respuestaLogin(usuario: UsuarioDemo): LoginResponse {
  const perfilActivo = usuario.perfiles[0];
  return { accessToken: firmarToken(usuario, perfilActivo), debeCambiarPassword: false, perfilActivo, perfilesDisponibles: usuario.perfiles };
}

const login: Manejador = ({ req }) => {
  const { dni, password } = (req.body ?? {}) as { dni?: string; password?: string };
  const usuario = USUARIOS_DEMO.find((u) => u.dni === dni?.trim());
  if (!usuario || password !== CONTRASENA_DEMO) return error(401, 'DNI o contraseña incorrectos.');
  return ok(respuestaLogin(usuario));
};

const refresh: Manejador = ({ sesion }) => {
  const actual = sesion ?? sesionDelToken(localStorage.getItem('siaf_access_token'));
  if (!actual) return error(401, 'Sesión expirada.');
  return ok({ accessToken: firmarToken(actual.usuario, actual.perfil) });
};

const cambiarPerfil: Manejador = ({ req, sesion }) => {
  if (!sesion) return error(401, 'Sesión expirada.');
  const { perfilId } = (req.body ?? {}) as { perfilId?: string };
  const perfil = sesion.usuario.perfiles.find((p) => p.id === perfilId);
  if (!perfil) return error(404, 'El perfil no pertenece al usuario.');
  const respuesta: CambiarPerfilResponse = { accessToken: firmarToken(sesion.usuario, perfil), perfilActivo: perfil };
  return ok(respuesta);
};

const solicitarOtp: Manejador = ({ req }) => {
  const { email } = (req.body ?? {}) as { email?: string };
  return USUARIOS_DEMO.some((u) => u.email === email?.trim()) ? ok(null, 204) : error(404, 'El correo no está registrado.');
};

const verificarOtp: Manejador = ({ req }) => {
  const { email, codigo } = (req.body ?? {}) as { email?: string; codigo?: string };
  const usuario = USUARIOS_DEMO.find((u) => u.email === email?.trim());
  if (!usuario) return error(404, 'El correo no está registrado.');
  if (codigo !== '123456') return error(400, 'El código no es válido. En el taller es 123456.');
  return ok(respuestaLogin(usuario));
};

// ─── Catálogos ─────────────────────────────────────────────────────

const tiposDocumento: Manejador = () => ok([
  {
    ...TIPO_DOCUMENTO,
    modulo: 'tesoreria',
    esActivo: true,
    accionesPermitidas: [{ tipoAccion: 'creacion' }],
    proceso: { codigo: 'registro-cuentas-bancarias', nombre: 'Registro de cuentas bancarias', modulo: 'tesoreria' },
  },
  {
    ...TIPOS_DOCUMENTO[1],
    modulo: 'tesoreria',
    esActivo: true,
    accionesPermitidas: [{ tipoAccion: 'creacion' }],
    proceso: { codigo: 'saldos-iniciales', nombre: 'Registro de saldos iniciales en libro bancos y libretas', modulo: 'tesoreria' },
  },
  {
    ...TIPOS_DOCUMENTO.find((t) => t.codigo === CODIGO_AUTORIZACION)!,
    modulo: 'tesoreria',
    esActivo: true,
    accionesPermitidas: [{ tipoAccion: 'creacion' }, { tipoAccion: 'modificacion' }],
    proceso: { codigo: 'autorizaciones', nombre: 'Documentos de autorización', modulo: 'tesoreria' },
  },
]);

// ─── Notificaciones ────────────────────────────────────────────────

function visibles(datos: DatosTaller, sesion: Sesion): NotificacionMock[] {
  return datos.notificaciones
    .filter((n) => (n.paraUsuarioId ? n.paraUsuarioId === sesion.usuario.id : n.paraRolCodigo === sesion.perfil.rolCodigo))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const notificaciones: Manejador = ({ datos, sesion }) => ok(sesion ? visibles(datos, sesion).slice(0, 20) : []);
const historialNotificaciones: Manejador = ({ datos, sesion }) => ok(sesion ? visibles(datos, sesion) : []);
const contadorNotificaciones: Manejador = ({ datos, sesion }) => ok({ total: sesion ? visibles(datos, sesion).filter((n) => !n.leida).length : 0 });

const marcarLeidas: Manejador = ({ datos, sesion }) => {
  if (sesion) {
    const ahora = new Date().toISOString();
    visibles(datos, sesion).forEach((n) => { n.leida = true; n.leidaEn = n.leidaEn ?? ahora; });
    guardarDatos(datos);
  }
  return ok(null, 204);
};

const marcarLeidaDocumento: Manejador = ({ datos, sesion, params }) => {
  if (sesion) {
    const ahora = new Date().toISOString();
    visibles(datos, sesion).filter((n) => n.documento?.id === params[0]).forEach((n) => { n.leida = true; n.leidaEn = n.leidaEn ?? ahora; });
    guardarDatos(datos);
  }
  return ok(null, 204);
};

function notificar(datos: DatosTaller, s: SolicitudResponse, estado: EstadoDocumento, comentario: string | null): void {
  const textos: Partial<Record<EstadoDocumento, { titulo: string; mensaje: string }>> = {
    VERIFICADO: { titulo: 'Solicitud por aprobar', mensaje: `La solicitud ${s.numero} fue verificada y espera su aprobación.` },
    APROBADO: { titulo: 'Solicitud aprobada', mensaje: `La solicitud ${s.numero} fue aprobada.` },
    OBSERVADO: { titulo: 'Solicitud observada', mensaje: `La solicitud ${s.numero} fue observada: ${comentario ?? 'revise el comentario'}.` },
    RECHAZADO: { titulo: 'Solicitud rechazada', mensaje: `La solicitud ${s.numero} fue rechazada.` },
  };
  const texto = textos[estado];
  if (!texto) return;
  // RAUT no tiene aprobador: lo verificado vuelve al mismo creador autorizador.
  const destino = estado === 'VERIFICADO' && s.catDocumento?.codigo !== CODIGO_AUTORIZACION
    ? { paraRolCodigo: 'APROBADOR' as const }
    : { paraUsuarioId: s.creador?.id };
  datos.notificaciones.push({
    id: nuevoId(datos, 'not'),
    tipo: `DOCUMENTO_${estado}`,
    ...texto,
    leida: false,
    leidaEn: null,
    createdAt: new Date().toISOString(),
    documento: { id: s.id, numero: s.numero, catDocumento: TIPOS_DOCUMENTO.find((t) => t.codigo === s.catDocumento?.codigo) ?? TIPO_DOCUMENTO },
    ...destino,
  });
}

// ─── Solicitudes ───────────────────────────────────────────────────

function buscarSolicitud(datos: DatosTaller, id: string): SolicitudResponse | undefined {
  return datos.solicitudes.find((s) => s.id === id);
}

function bandeja(ctx: Contexto, estados?: EstadoDocumento[]): Respuesta {
  const { datos, sesion, query } = ctx;
  if (!sesion) return error(401, 'Sesión expirada.');
  const tipos = (query.get('tipos') ?? '').split(',').filter(Boolean);
  const busqueda = (query.get('search') ?? '').trim().toLowerCase();

  let lista = datos.solicitudes.filter((s) => s.entidadCreadora?.id === sesion.perfil.entidadId && s.estado !== 'NUEVO' && s.estado !== 'REGISTRADO');
  // REGISTRADO: el sistema aún no procesa el documento automático; recién al quedar PROCESADO aparece en las bandejas.
  if (estados) lista = lista.filter((s) => estados.includes(s.estado));
  if (tipos.length) lista = lista.filter((s) => tipos.includes(s.catDocumento?.codigo ?? ''));
  if (busqueda) {
    lista = lista.filter((s) =>
      [s.numero, s.asuntoMotivo, s.catDocumento?.nombre, s.creador ? nombreCompleto(s.creador) : '']
        .some((valor) => (valor ?? '').toLowerCase().includes(busqueda)),
    );
  }
  lista = [...lista].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const pagina = Number(query.get('page'));
  const limite = Number(query.get('limit'));
  if (pagina && limite) {
    return ok({ data: lista.slice((pagina - 1) * limite, pagina * limite), total: lista.length, page: pagina, limit: limite });
  }
  return ok(lista);
}

const bandejaCreador: Manejador = (ctx) => bandeja(ctx);
const bandejaAprobador: Manejador = (ctx) => bandeja(ctx, ['VERIFICADO', 'OBSERVADO', 'APROBADO', 'RECHAZADO', 'PROCESADO']);

const detalleSolicitud: Manejador = ({ datos, params }) => {
  const s = buscarSolicitud(datos, params[0]);
  return s ? ok(s) : error(404, 'La solicitud no existe.');
};

const crearSolicitud: Manejador = ({ req, datos, sesion }) => {
  if (!sesion) return error(401, 'Sesión expirada.');
  if (sesion.perfil.rolCodigo !== 'CREADOR') return error(403, 'Solo un creador puede registrar solicitudes.');
  const dto = (req.body ?? {}) as { tipoDocumentoId?: string; tipoAccion?: string; organoLinea?: string; justificacion?: string };
  const tipo = TIPOS_DOCUMENTO.find((t) => t.id === dto.tipoDocumentoId) ?? TIPO_DOCUMENTO;
  if (tipo.codigo === CODIGO_AUTORIZACION && !puedeAutorizar(sesion)) return error(403, 'Su perfil no puede registrar autorizaciones excepcionales.');
  const ahora = new Date().toISOString();
  const id = nuevoId(datos, 'sol');
  const s: SolicitudResponse = {
    id,
    numero: null,
    catDocumento: tipo,
    tipoAccion: dto.tipoAccion ?? 'creacion',
    estado: 'NUEVO',
    asuntoMotivo: `[${dto.organoLinea ?? ''}] ${dto.justificacion ?? ''}`,
    entidadCreadora: ENTIDAD_CREADORA,
    unidadCreadora: UNIDAD_CREADORA,
    creador: { id: sesion.usuario.id, nombres: sesion.usuario.nombres, apellidoPaterno: sesion.usuario.apellidoPaterno, apellidoMaterno: sesion.usuario.apellidoMaterno },
    fechaRegistro: ahora,
    createdAt: ahora,
    updatedAt: ahora,
    itemsCuenta: [],
    detalleCuentaBancaria: null,
    sustentos: [],
    historialEstados: [filaHistorial(datos, null, 'NUEVO', ahora, sesion.usuario, rolDe(sesion.perfil))],
  };
  datos.solicitudes.push(s);
  guardarDatos(datos);
  return ok(s, 201);
};

const actualizarSolicitud: Manejador = ({ req, datos, params, sesion }) => {
  const s = buscarSolicitud(datos, params[0]);
  if (!s) return error(404, 'La solicitud no existe.');
  if (sesion?.perfil.rolCodigo !== 'CREADOR') return error(403, 'Solo el creador puede editar la solicitud.');
  if (!['ELABORADO', 'OBSERVADO'].includes(s.estado)) return error(409, 'Solo se edita una solicitud elaborada u observada.');
  const dto = (req.body ?? {}) as { justificacion?: string; organoLinea?: string };
  s.asuntoMotivo = `[${dto.organoLinea ?? ''}] ${dto.justificacion ?? ''}`;
  s.updatedAt = new Date().toISOString();
  guardarDatos(datos);
  return ok(s);
};

const guardarCuentaBancaria: Manejador = ({ req, datos, params }) => {
  const s = buscarSolicitud(datos, params[0]);
  if (!s) return error(404, 'La solicitud no existe.');
  if (!['NUEVO', 'ELABORADO', 'OBSERVADO'].includes(s.estado)) return error(409, 'La solicitud ya no admite cambios.');
  const cuenta = req.body as CuentaBancariaDatos;
  if (!/^\d{10,20}$/.test(cuenta?.numeroCuenta ?? '')) return error(400, 'El número de cuenta debe tener entre 10 y 20 dígitos.');
  s.detalleCuentaBancaria = { documentoId: s.id, ...cuenta };
  s.updatedAt = new Date().toISOString();
  guardarDatos(datos);
  return ok({ message: 'Cuenta guardada' });
};

const guardarSaldosIniciales: Manejador = ({ req, datos, params }) => {
  const s = buscarSolicitud(datos, params[0]);
  if (!s) return error(404, 'La solicitud no existe.');
  if (s.catDocumento?.codigo !== CODIGO_SALDOS) return error(409, 'La solicitud no es de saldos iniciales.');
  if (!['NUEVO', 'ELABORADO', 'OBSERVADO'].includes(s.estado)) return error(409, 'La solicitud ya no admite cambios.');
  const dto = req.body as SaldosInicialesDatos;
  if (dto?.saldos?.some((x) => x.ajuste)) return guardarAjusteSaldo(datos, s, dto);
  if (!entidadPorCodigo(dto?.entidadFinanciera)) return error(400, 'Seleccione la entidad financiera.');
  if (!dto.saldos?.length) return error(400, 'Agregue al menos un saldo inicial.');
  const cuentas = dto.saldos.map((x) => x.cuentaBancaria);
  if (new Set(cuentas).size !== cuentas.length) return error(400, 'Una cuenta bancaria no puede repetirse en el documento.');
  for (const saldo of dto.saldos) {
    if (cuentaPorNumero(saldo.cuentaBancaria)?.entidadCodigo !== dto.entidadFinanciera) return error(400, `La cuenta ${saldo.cuentaBancaria} no pertenece a la entidad financiera.`);
    if (!saldo.fechaOperacion) return error(400, 'Indique la fecha de operación de cada saldo.');
  }
  // Los importes y el tipo de cambio se recalculan aquí: el backend no confía en los totales que manda la pantalla.
  const saldos = dto.saldos.map((x) => calcularSaldo(x.id, x.fechaOperacion, x.cuentaBancaria,
    Object.fromEntries(x.libretas.map((l) => [l.idCorrelativo, l.importe]))))
    .map((x, i) => ({ ...x, sustento: dto.saldos[i].sustento || null }));
  if (saldos.some((x) => x.importeCuenta <= 0)) return error(400, 'Cada saldo debe tener al menos un importe mayor a cero.');
  s.detalleSaldosIniciales = { documentoId: s.id, entidadFinanciera: dto.entidadFinanciera, saldos };
  s.updatedAt = new Date().toISOString();
  guardarDatos(datos);
  return ok({ message: 'Saldos guardados' });
};

/** Estados de un documento de ajuste que todavía no termina (la autorización sigue activa). */
const AJUSTE_EN_CURSO = ['NUEVO', 'ELABORADO', 'VERIFICADO', 'OBSERVADO'];

/** Documento de ajuste sin aprobar de una cuenta (otro distinto de `excepto`). */
function ajusteEnCurso(datos: DatosTaller, cuenta: string, excepto?: string): SolicitudResponse | undefined {
  return datos.solicitudes.find((d) => d.id !== excepto && AJUSTE_EN_CURSO.includes(d.estado)
    && !!d.detalleSaldosIniciales?.saldos.some((x) => x.ajuste && x.cuentaBancaria === cuenta));
}

/**
 * Ajuste de saldo inicial (tipo de operación 2): una sola cuenta, con saldo inicial registrado y una autorización
 * vigente, y un solo documento de ajuste en curso por cuenta. La autorización queda Inactivo al aprobarse el ajuste.
 */
function guardarAjusteSaldo(datos: DatosTaller, s: SolicitudResponse, dto: SaldosInicialesDatos) {
  if (dto.saldos.length !== 1) return error(400, 'Un ajuste se hace sobre una sola cuenta bancaria.');
  const [x] = dto.saldos;
  if (!x.fechaOperacion) return error(400, 'Indique la fecha de operación.');
  const original = datos.registrosSaldos.find((r) => r.estado === 'Activo' && !r.ajuste && r.cuentaBancaria === x.cuentaBancaria);
  if (!original) return error(400, 'La cuenta bancaria no tiene saldo inicial registrado.');
  const yaGrabado = s.detalleSaldosIniciales?.saldos.some((y) => y.ajuste && y.cuentaBancaria === x.cuentaBancaria);
  const hoy = new Date().toISOString().slice(0, 10);
  const autorizacion = datos.registrosAutorizacion.find((r) => r.cuentaBancaria === x.cuentaBancaria && estaVigente(r, hoy));
  if (!yaGrabado && !autorizacion) return error(400, 'No tiene una autorización vigente para ajustar el saldo inicial de esta cuenta.');
  if (ajusteEnCurso(datos, x.cuentaBancaria, s.id)) return error(400, 'Ya existe un documento de ajuste en curso para esta cuenta bancaria.');
  const ajuste = calcularAjuste(x.id, x.fechaOperacion, x.cuentaBancaria,
    Object.fromEntries(x.libretas.map((l) => [l.idCorrelativo, { importe: l.importe, naturaleza: l.naturaleza ?? 'Crédito' }])), original);
  if (ajuste.importeCuenta <= 0) return error(400, 'El ajuste debe tener un importe distinto de cero.');
  s.detalleSaldosIniciales = { documentoId: s.id, entidadFinanciera: original.entidadFinanciera, saldos: [{ ...ajuste, sustento: x.sustento || null }] };
  s.updatedAt = new Date().toISOString();
  guardarDatos(datos);
  return ok({ message: 'Ajuste guardado' });
}

/** Solo un perfil con `authorization.create` (creador autorizador) crea, graba y autoriza documentos RAUT. */
const puedeAutorizar = (sesion: { perfil: { permisos?: string[] } } | null): boolean =>
  !!sesion?.perfil.permisos?.includes(PERMISO_AUTORIZAR);

const guardarAutorizacion: Manejador = ({ req, datos, params, sesion }) => {
  const s = buscarSolicitud(datos, params[0]);
  if (!s) return error(404, 'La solicitud no existe.');
  if (s.catDocumento?.codigo !== CODIGO_AUTORIZACION) return error(409, 'La solicitud no es un documento de autorización.');
  if (!puedeAutorizar(sesion)) return error(403, 'Su perfil no puede registrar autorizaciones excepcionales.');
  if (!['NUEVO', 'ELABORADO'].includes(s.estado)) return error(409, 'La solicitud ya no admite cambios.');
  const dto = req.body as AutorizacionDatos;
  if (s.tipoAccion === 'modificacion') {
    if (dto?.tipoModificacion !== 'vigencia') return error(400, 'Seleccione el tipo de modificación.');
    const registro = datos.registrosAutorizacion.find((r) => r.id === dto.registroId);
    if (!registro) return error(400, 'Seleccione la autorización a modificar.');
    if (registro.estado !== 'Activo') return error(400, 'Solo se modifican autorizaciones activas.');
    // Solo cambia la vigencia: la fecha desde es la de la creación; SÍ exige una fecha hasta nueva; NO da de baja.
    const activo = dto.estado === 'Activo';
    if (activo) {
      const problema = errorAmpliacion(registro.fechaHasta, dto.fechaHasta);
      if (problema) return error(400, problema);
    }
    s.detalleAutorizacion = {
      documentoId: s.id, registroId: registro.id, tipoModificacion: 'vigencia',
      procedimiento: registro.procedimiento, responsable: registro.responsable, cuentaBancaria: registro.cuentaBancaria,
      estado: activo ? 'Activo' : 'Inactivo', fechaDesde: registro.fechaDesde, fechaHasta: activo ? dto.fechaHasta : registro.fechaHasta,
    };
  } else {
    if (!PROCEDIMIENTOS.some((p) => p.value === dto?.procedimiento)) return error(400, 'Seleccione el procedimiento.');
    if (!responsablePorUsuario(dto.responsable)) return error(400, 'Seleccione el responsable.');
    if (!cuentaDeAutorizacion(dto.cuentaBancaria)) return error(400, 'Seleccione la cuenta bancaria.');
    // Solo se autoriza el ajuste de una cuenta que ya tiene saldo inicial.
    if (!cuentasConSaldoInicial(datos).has(dto.cuentaBancaria)) return error(400, 'La cuenta bancaria no tiene saldo inicial registrado.');
    const problema = errorVigencia(dto.fechaDesde, dto.fechaHasta);
    if (problema) return error(400, problema);
    // Un responsable tiene una sola autorización activa a la vez (hasta que grabe su ajuste).
    const ocupado = datos.registrosAutorizacion.some((r) => r.estado === 'Activo' && r.responsable === dto.responsable);
    if (ocupado) return error(400, 'El responsable ya tiene una autorización activa.');
    s.detalleAutorizacion = { documentoId: s.id, ...dto, estado: 'Activo', registroId: null, tipoModificacion: null };
  }
  s.updatedAt = new Date().toISOString();
  guardarDatos(datos);
  return ok({ message: 'Autorización guardada' });
};

const subirSustento: Manejador = ({ req, datos, params }) => {
  const s = buscarSolicitud(datos, params[0]);
  if (!s) return error(404, 'La solicitud no existe.');
  const formulario = req.body instanceof FormData ? req.body : null;
  const archivo = formulario?.get('archivo');
  if (!(archivo instanceof File)) return error(400, 'Adjunte un archivo.');
  const sustento = {
    id: nuevoId(datos, 'sus'),
    tipoSustento: String(formulario?.get('tipoSustento') ?? 'sustento'),
    createdAt: new Date().toISOString(),
    archivo: {
      id: nuevoId(datos, 'arc'),
      nombreOriginal: archivo.name,
      extension: archivo.name.split('.').pop() ?? '',
      mimeType: archivo.type,
      sizeBytes: String(archivo.size),
      storagePath: 'taller',
    },
  };
  // El taller guarda solo el nombre del archivo (no su contenido) y un único sustento por solicitud.
  s.sustentos = [sustento];
  guardarDatos(datos);
  return ok(sustento, 201);
};

const listarSustentos: Manejador = ({ datos, params }) => ok(buscarSolicitud(datos, params[0])?.sustentos ?? []);

const eliminarSustento: Manejador = ({ datos, params }) => {
  const s = buscarSolicitud(datos, params[0]);
  if (s) {
    s.sustentos = (s.sustentos ?? []).filter((x) => x.id !== params[1]);
    guardarDatos(datos);
  }
  return ok(null, 204);
};

const TRANSICIONES: Record<'CREADOR' | 'APROBADOR', Partial<Record<EstadoDocumento, EstadoDocumento[]>>> = {
  CREADOR: {
    NUEVO: ['ELABORADO'],
    ELABORADO: ['ELABORADO', 'VERIFICADO', 'ELIMINADO'],
    OBSERVADO: ['ELABORADO', 'VERIFICADO'],
  },
  APROBADOR: {
    VERIFICADO: ['APROBADO', 'OBSERVADO', 'RECHAZADO'],
  },
};

/**
 * RAUT (autorización excepcional, sin aprobador): Grabar → ELABORADO; Autorizar (desde NUEVO o ELABORADO) → APROBADO
 * en un solo paso, dejando en el historial elaborado (creador), verificado (sistema SIAF RP) y aprobado (creador).
 */
const TRANSICIONES_AUTORIZACION: Partial<Record<EstadoDocumento, EstadoDocumento[]>> = {
  NUEVO: ['ELABORADO', 'APROBADO'],
  ELABORADO: ['ELABORADO', 'APROBADO', 'ELIMINADO'],
};

const cambiarEstado: Manejador = ({ req, datos, params, sesion }) => {
  if (!sesion) return error(401, 'Sesión expirada.');
  const s = buscarSolicitud(datos, params[0]);
  if (!s) return error(404, 'La solicitud no existe.');
  const dto = (req.body ?? {}) as { estadoNuevo?: EstadoDocumento; comentario?: string; motivo?: string };
  const nuevo = dto.estadoNuevo;
  const rol = sesion.perfil.rolCodigo as 'CREADOR' | 'APROBADOR';
  const esAutorizacion = s.catDocumento?.codigo === CODIGO_AUTORIZACION;
  if (esAutorizacion && !puedeAutorizar(sesion)) return error(403, 'Su perfil no puede registrar autorizaciones excepcionales.');
  const permitidos = (esAutorizacion ? TRANSICIONES_AUTORIZACION : TRANSICIONES[rol])?.[s.estado] ?? [];
  if (!nuevo || !permitidos.includes(nuevo)) {
    return error(409, `No se puede pasar de ${s.estado} a ${nuevo ?? '—'} con el perfil ${sesion.perfil.rol}.`);
  }
  const comentario = dto.comentario?.trim() ?? '';
  if ((nuevo === 'OBSERVADO' || nuevo === 'RECHAZADO') && !comentario) return error(400, 'Escriba el comentario.');
  if (nuevo === 'ELIMINADO' && (s.historialEstados ?? []).some((h) => h.estadoNuevo === 'OBSERVADO')) {
    return error(409, 'No se puede eliminar una solicitud que fue observada.');
  }
  if (esAutorizacion && (nuevo === 'ELABORADO' || nuevo === 'APROBADO')) {
    // Sin sustento: basta con los datos de la autorización.
    if (!s.detalleAutorizacion) return error(400, 'Registre los datos de la autorización.');
  } else if (nuevo === 'ELABORADO') {
    if (s.catDocumento?.codigo === CODIGO_SALDOS) {
      // En saldos iniciales el sustento es opcional.
      if (!s.detalleSaldosIniciales?.saldos.length) return error(400, 'Agregue al menos un saldo inicial.');
    } else {
      if (!s.detalleCuentaBancaria) return error(400, 'Registre los datos de la cuenta bancaria.');
      if (!(s.sustentos ?? []).length) return error(400, 'Adjunte el documento de sustento.');
    }
  }

  const ahora = new Date().toISOString();
  const anterior = s.estado;
  if ((nuevo === 'ELABORADO' || (esAutorizacion && nuevo === 'APROBADO')) && !s.numero) {
    s.numero = numeroDocumento(datos, s.catDocumento?.codigo ?? TIPO_DOCUMENTO.codigo, new Date(), s.entidadCreadora?.siglas, s.unidadCreadora?.sigla);
  }
  if (esAutorizacion && nuevo === 'APROBADO') {
    // Autorizar: elabora (si hace falta), el sistema verifica y el creador autorizador aprueba.
    const rol = rolDe(sesion.perfil);
    const filas = [
      ...(anterior === 'NUEVO' ? [filaHistorial(datos, 'NUEVO', 'ELABORADO', ahora, sesion.usuario, rol)] : []),
      filaHistorial(datos, 'ELABORADO', 'VERIFICADO', ahora, USUARIO_SISTEMA, ROL_SISTEMA),
      filaHistorial(datos, 'VERIFICADO', 'APROBADO', ahora, sesion.usuario, rol),
    ];
    s.historialEstados = [...(s.historialEstados ?? []), ...filas];
    s.fechaEvaluacion = ahora;
  } else if (!(anterior === 'ELABORADO' && nuevo === 'ELABORADO')) {
    // Volver a grabar un ELABORADO no deja fila en el historial.
    const texto = nuevo === 'RECHAZADO' && dto.motivo ? `[${dto.motivo}] ${comentario}` : comentario || null;
    s.historialEstados = [...(s.historialEstados ?? []), filaHistorial(datos, anterior, nuevo, ahora, sesion.usuario, rolDe(sesion.perfil), texto)];
  }
  s.estado = nuevo;
  s.updatedAt = ahora;
  if (nuevo === 'VERIFICADO') s.fechaEvaluacion = ahora;
  if (nuevo === 'APROBADO') s.fechaAprobacion = ahora;

  // Al aprobar, la cuenta pasa a los registros.
  if (nuevo === 'APROBADO' && s.detalleCuentaBancaria && !datos.registros.some((r) => r.documentoId === s.id)) {
    const { documentoId: _documento, ...cuenta } = s.detalleCuentaBancaria;
    datos.correlativoRegistro += 1;
    datos.registros.push({
      id: nuevoId(datos, 'cb'),
      codigo: `CB-${String(datos.correlativoRegistro).padStart(4, '0')}`,
      estado: 'Activo',
      entidadSiglas: s.entidadCreadora?.siglas ?? '',
      documentoId: s.id,
      numeroDocumento: s.numero ?? '',
      fechaRegistro: ahora,
      ...cuenta,
    });
  }

  // Al aprobar saldos iniciales, cada saldo recibe su secuencia y pasa a los registros.
  if (nuevo === 'APROBADO') registrarSaldos(datos, s, ahora);
  // Al aprobar un ajuste de saldo inicial, la autorización de esa cuenta termina (queda Inactivo).
  if (nuevo === 'APROBADO' && s.catDocumento?.codigo === CODIGO_SALDOS) {
    for (const x of s.detalleSaldosIniciales?.saldos.filter((y) => y.ajuste) ?? []) {
      for (const r of datos.registrosAutorizacion) if (r.estado === 'Activo' && r.cuentaBancaria === x.cuentaBancaria) r.estado = 'Inactivo';
    }
  }
  // Al aprobar una autorización, se crea o se modifica su registro y, si queda activa, se avisa a quien hará el ajuste.
  if (nuevo === 'APROBADO') registrarAutorizacion(datos, s, ahora);
  if (nuevo === 'APROBADO' && esAutorizacion) avisarAutorizacionAjuste(datos, s, ahora);

  notificar(datos, s, nuevo, comentario || null);
  guardarDatos(datos);
  return ok({ message: 'Estado actualizado', numero: s.numero });
};

// ─── Proceso de ejemplo ────────────────────────────────────────────

const registrosCuentas: Manejador = ({ datos, sesion }) =>
  ok(datos.registros.filter((r) => !sesion || r.entidadSiglas === sesion.perfil.entidadSiglas));

const registrosSaldos: Manejador = ({ datos, sesion }) =>
  ok(datos.registrosSaldos.filter((r) => !sesion || r.entidadSiglas === sesion.perfil.entidadSiglas));

const registrosAutorizacion: Manejador = ({ datos, sesion }) =>
  ok(datos.registrosAutorizacion.filter((r) => !sesion || r.entidadSiglas === sesion.perfil.entidadSiglas));

/**
 * Autorizaciones vigentes para ajustar el saldo inicial: solo para el creador que hace el ajuste (Ana). Una por cuenta
 * con saldo inicial (la de mayor fecha hasta).
 */
const autorizacionesVigentes: Manejador = ({ datos, sesion }) => {
  if (sesion?.usuario.id !== USUARIO_AJUSTE_SALDO || sesion.perfil.rolCodigo !== 'CREADOR') return ok([]);
  const hoy = new Date().toISOString().slice(0, 10);
  const conSaldo = cuentasConSaldoInicial(datos);
  const porCuenta = new Map<string, AutorizacionVigente>();
  for (const r of datos.registrosAutorizacion) {
    if (!estaVigente(r, hoy) || !conSaldo.has(r.cuentaBancaria)) continue;
    const actual = porCuenta.get(r.cuentaBancaria);
    if (!actual || r.fechaHasta! > actual.fechaHasta) {
      porCuenta.set(r.cuentaBancaria, {
        registroId: r.id, cuentaBancaria: r.cuentaBancaria, fechaDesde: r.fechaDesde!, fechaHasta: r.fechaHasta!,
        documentoEnCurso: ajusteEnCurso(datos, r.cuentaBancaria)?.id ?? null,
      });
    }
  }
  return ok([...porCuenta.values()]);
};

// ─── Enrutador ─────────────────────────────────────────────────────

const RUTAS: [string, RegExp, Manejador][] = [
  ['POST', /^\/auth\/login$/, login],
  ['POST', /^\/auth\/logout$/, () => ok(null, 204)],
  ['POST', /^\/auth\/refresh$/, refresh],
  ['PATCH', /^\/auth\/cambiar-perfil$/, cambiarPerfil],
  ['POST', /^\/auth\/cambiar-password$/, () => ok(null, 204)],
  ['POST', /^\/auth\/solicitar-otp$/, solicitarOtp],
  ['POST', /^\/auth\/verificar-otp$/, verificarOtp],
  ['POST', /^\/auth\/reenviar-otp-whatsapp$/, () => ok(null, 204)],
  ['GET', /^\/tipos-documento$/, tiposDocumento],
  ['GET', /^\/notificaciones$/, notificaciones],
  ['GET', /^\/notificaciones\/historial$/, historialNotificaciones],
  ['GET', /^\/notificaciones\/contador$/, contadorNotificaciones],
  ['PATCH', /^\/notificaciones\/marcar-leidas$/, marcarLeidas],
  ['PATCH', /^\/notificaciones\/marcar-leida-documento\/([^/]+)$/, marcarLeidaDocumento],
  ['GET', /^\/solicitudes\/bandeja-creador$/, bandejaCreador],
  ['GET', /^\/solicitudes\/bandeja-aprobador$/, bandejaAprobador],
  ['POST', /^\/solicitudes$/, crearSolicitud],
  ['PATCH', /^\/solicitudes\/([^/]+)\/estado$/, cambiarEstado],
  ['POST', /^\/solicitudes\/([^/]+)\/cuenta-bancaria$/, guardarCuentaBancaria],
  ['POST', /^\/solicitudes\/([^/]+)\/saldos-iniciales$/, guardarSaldosIniciales],
  ['POST', /^\/solicitudes\/([^/]+)\/autorizacion$/, guardarAutorizacion],
  ['GET', /^\/autorizaciones\/vigentes$/, autorizacionesVigentes],
  ['GET', /^\/autorizaciones$/, registrosAutorizacion],
  ['POST', /^\/solicitudes\/([^/]+)\/sustentos$/, subirSustento],
  ['GET', /^\/solicitudes\/([^/]+)\/sustentos$/, listarSustentos],
  ['DELETE', /^\/solicitudes\/([^/]+)\/sustentos\/([^/]+)$/, eliminarSustento],
  ['GET', /^\/solicitudes\/([^/]+)$/, detalleSolicitud],
  ['PATCH', /^\/solicitudes\/([^/]+)$/, actualizarSolicitud],
  ['GET', /^\/cuentas-bancarias$/, registrosCuentas],
  ['GET', /^\/saldos-iniciales$/, registrosSaldos],
];

export const mockBackendInterceptor: HttpInterceptorFn = (req, next): Observable<HttpEvent<unknown>> => {
  const base = APP_CONFIG.api.baseUrl;
  const url = new URL(req.url, window.location.origin);
  if (!url.pathname.startsWith(base)) return next(req);

  const ruta = url.pathname.slice(base.length) || '/';
  // Los parámetros pueden venir en la URL o en HttpParams.
  const query = new URLSearchParams(url.search);
  req.params.keys().forEach((clave) => query.set(clave, req.params.get(clave) ?? ''));

  for (const [metodo, patron, manejador] of RUTAS) {
    const coincidencia = req.method === metodo ? patron.exec(ruta) : null;
    if (!coincidencia) continue;
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    const respuesta = manejador({ req, params: coincidencia.slice(1), query, sesion: sesionDelToken(token), datos: leerDatos() });
    return responder(req, respuesta);
  }

  console.warn(`[mock] Endpoint no simulado: ${req.method} ${ruta}`);
  return responder(req, error(404, `El backend simulado no responde ${req.method} ${ruta}.`));
};

function responder(req: HttpRequest<unknown>, respuesta: Respuesta): Observable<HttpEvent<unknown>> {
  if (respuesta.status < 400) {
    return of(new HttpResponse({ status: respuesta.status, body: respuesta.body ?? null, url: req.url })).pipe(delay(LATENCIA_MS));
  }
  return timer(LATENCIA_MS).pipe(
    mergeMap(() => throwError(() => new HttpErrorResponse({ status: respuesta.status, error: respuesta.body, url: req.url }))),
  );
}
