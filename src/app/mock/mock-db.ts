import type { NotificacionResponse } from '../core/api/notificaciones-api.service';
import type { HistorialItem, SolicitudResponse } from '../core/api/solicitudes-api.service';
import { borrarArchivos } from './archivos-demo';
import type { EstadoDocumento } from '../core/models/documento.model';
import {
  CODIGO_DOCUMENTO,
  LibretaSaldo,
  MovimientoTraslado,
  NOMBRE_DOCUMENTO,
  PREFIJO_NUMERO as PREFIJO_TRASLADO,
  TrasladoRegistro,
  modalidad,
  sumar,
} from '../modules/tesoreria/traspasos-cuentas-registros/models/traslado.model';
import {
  CODIGO_AUTOMATICO,
  CODIGO_DOCUMENTO as CODIGO_SALDOS,
  MOVIMIENTO_AJUSTE,
  MOVIMIENTO_APERTURA,
  MOVIMIENTO_SALDO_INICIAL,
  NaturalezaAjuste,
  NOMBRE_AUTOMATICO,
  NOMBRE_DOCUMENTO as NOMBRE_SALDOS,
  SaldoInicial,
  SaldoInicialRegistro,
  calcularSaldo,
  cuentaPorNumero,
  cuentasRegistroDe,
  importeFirmado,
  redondear,
} from '../modules/tesoreria/saldos-iniciales/models/saldo-inicial.model';
import {
  AutorizacionDatos,
  AutorizacionRegistro,
  CODIGO_DOCUMENTO as CODIGO_AUTORIZACION,
  NOMBRE_DOCUMENTO as NOMBRE_AUTORIZACION,
  TipoAccionAutorizacion,
  USUARIO_AJUSTE_SALDO,
  mensajeAutorizacionVigente,
} from '../modules/tesoreria/autorizaciones/models/autorizacion.model';
import { NOMBRES_ANTERIORES, USUARIOS_DEMO, UsuarioDemo } from './usuarios-demo';

/**
 * «Base de datos» del backend simulado: vive en el `localStorage` del navegador, así lo que hace un usuario lo ve
 * otro al iniciar sesión (en el mismo navegador). `reiniciarDatosDemo()` vuelve a los datos iniciales.
 */

const CLAVE = 'taller-siaf-rp:datos';
const VERSION = 19;

export interface NotificacionMock extends NotificacionResponse {
  /** Destinatario: un usuario puntual o, si no hay, todos los perfiles con este rol. */
  paraUsuarioId?: string;
  paraRolCodigo?: 'CREADOR' | 'APROBADOR';
}

export interface DatosTaller {
  version: number;
  solicitudes: SolicitudResponse[];
  /** Traslados entre cuentas de registros procesados (documentos RTCR). */
  registrosTraslado: TrasladoRegistro[];
  /** Saldos iniciales aprobados (documentos RSIN). */
  registrosSaldos: SaldoInicialRegistro[];
  /** Autorizaciones aprobadas (documentos RAUT). */
  registrosAutorizacion: AutorizacionRegistro[];
  notificaciones: NotificacionMock[];
  /** Correlativo del número de documento, por código de documento (RTCR, RSIN). */
  correlativos: Record<string, number>;
  /** Secuencia que se asigna a cada saldo inicial al aprobarse. */
  secuenciaSaldo: number;
  /** Secuencia que se asigna a cada traslado al procesarse. */
  secuenciaTraslado: number;
  secuencia: number;
}

export const TIPO_DOCUMENTO = { id: 'td-rtcr', codigo: CODIGO_DOCUMENTO, nombre: NOMBRE_DOCUMENTO };
export const TIPO_SALDOS = { id: 'td-rsin', codigo: CODIGO_SALDOS, nombre: NOMBRE_SALDOS };
/** Registro automático de saldos de apertura: lo crea el sistema; no aparece en «Crear documento». */
export const TIPO_AUTOMATICO = { id: 'td-rasa', codigo: CODIGO_AUTOMATICO, nombre: NOMBRE_AUTOMATICO };
export const TIPO_AUTORIZACION = { id: 'td-raut', codigo: CODIGO_AUTORIZACION, nombre: NOMBRE_AUTORIZACION };
export const TIPOS_DOCUMENTO = [TIPO_DOCUMENTO, TIPO_SALDOS, TIPO_AUTOMATICO, TIPO_AUTORIZACION];
export const ENTIDAD_CREADORA = { id: 'ent-mef', codMef: '0001', siglas: 'MEF', nombre: 'Ministerio de Economía y Finanzas' };
export const UNIDAD_CREADORA = { id: 'uo-oga', sigla: 'OGA', nombre: 'Oficina General de Administración' };

/** Cambios de nombre de un usuario: el anterior y el actual, completos y por partes. */
const RENOMBRES = Object.entries(NOMBRES_ANTERIORES).flatMap(([id, antes]) => {
  const ahora = USUARIOS_DEMO.find((u) => u.id === id);
  if (!ahora) return [];
  const completo = (n: typeof antes) => [n.nombres, n.apellidoPaterno, n.apellidoMaterno].join(' ');
  return [{ antes, ahora, textoAntes: completo(antes), textoAhora: completo(ahora) }];
});

/**
 * Cambia los nombres anteriores de los usuarios por los actuales en los datos guardados (firmas, historial, avisos,
 * textos), sin tocar lo demás. Si no hay nombres anteriores, devuelve lo mismo.
 */
export function renombrarUsuarios<T>(valor: T): T {
  if (typeof valor === 'string') {
    let texto: string = valor;
    for (const r of RENOMBRES) {
      texto = texto.split(r.textoAntes).join(r.textoAhora).split(r.textoAntes.toUpperCase()).join(r.textoAhora.toUpperCase());
    }
    return texto as T;
  }
  if (Array.isArray(valor)) return valor.map((v) => renombrarUsuarios(v)) as T;
  if (valor && typeof valor === 'object') {
    const objeto = valor as Record<string, unknown>;
    const r = RENOMBRES.find(
      (x) => objeto['nombres'] === x.antes.nombres && objeto['apellidoPaterno'] === x.antes.apellidoPaterno,
    );
    const copia: Record<string, unknown> = {};
    for (const [clave, v] of Object.entries(objeto)) copia[clave] = renombrarUsuarios(v);
    if (r) {
      copia['nombres'] = r.ahora.nombres;
      copia['apellidoPaterno'] = r.ahora.apellidoPaterno;
      copia['apellidoMaterno'] = r.ahora.apellidoMaterno;
      if ('email' in copia) copia['email'] = r.ahora.email;
    }
    return copia as T;
  }
  return valor;
}

export function leerDatos(): DatosTaller {
  try {
    const guardados = localStorage.getItem(CLAVE);
    if (guardados) {
      const datos = renombrarUsuarios(JSON.parse(guardados)) as DatosTaller;
      if (datos.version === VERSION) {
        guardarDatos(datos);
        return datos;
      }
    }
  } catch {
    // Datos corruptos o sin acceso al almacenamiento: se empieza de nuevo.
  }
  const iniciales = crearDatosIniciales();
  guardarDatos(iniciales);
  return iniciales;
}

export function guardarDatos(datos: DatosTaller): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {
    // Sin almacenamiento (modo privado estricto): los cambios duran lo que dure la pestaña.
  }
}

/** Vuelve a los datos iniciales de la demo. */
export function reiniciarDatosDemo(): void {
  guardarDatos(crearDatosIniciales());
  void borrarArchivos();
}

export function nuevoId(datos: DatosTaller, prefijo: string): string {
  datos.secuencia += 1;
  return `${prefijo}-${datos.secuencia}`;
}

/** Saldos iniciales, ajustes y saldos de apertura comparten numeración: SI-DRSI-<correlativo>-<año>-<entidad>-<unidad>. */
export const PREFIJO_SALDOS = 'SI-DRSI';

/**
 * Siguiente número de documento: PCB-<código>-<correlativo>-<año>-<entidad>-<unidad>. Los de saldos (RSIN y RASA)
 * usan el prefijo SI-DRSI y un solo correlativo; los traslados (RTCR), TR-DTCR con su propio correlativo.
 */
export function numeroDocumento(datos: DatosTaller, codigo: string, fecha: Date, entidad = ENTIDAD_CREADORA.siglas, unidad = UNIDAD_CREADORA.sigla): string {
  const prefijo = codigo === CODIGO_SALDOS || codigo === CODIGO_AUTOMATICO ? PREFIJO_SALDOS : codigo === CODIGO_DOCUMENTO ? PREFIJO_TRASLADO : `PCB-${codigo}`;
  const correlativo = (datos.correlativos[prefijo] ?? 0) + 1;
  datos.correlativos[prefijo] = correlativo;
  return `${prefijo}-${String(correlativo).padStart(5, '0')}-${fecha.getFullYear()}-${entidad}-${unidad}`;
}

/** Al aprobar un RSIN (o al procesarse un RASA): cada saldo recibe su secuencia y pasa a los registros. */
export function registrarSaldos(datos: DatosTaller, s: SolicitudResponse, fecha: string): void {
  const detalle = s.detalleSaldosIniciales;
  if (!detalle || datos.registrosSaldos.some((r) => r.documentoId === s.id)) return;
  const automatico = s.catDocumento?.codigo === CODIGO_AUTOMATICO;
  for (const saldo of detalle.saldos) {
    datos.secuenciaSaldo += 1;
    saldo.secuencia = String(datos.secuenciaSaldo).padStart(6, '0');
    datos.registrosSaldos.push({
      ...saldo,
      registroId: nuevoId(datos, 'si'),
      estado: 'Activo',
      movimiento: saldo.ajuste ? MOVIMIENTO_AJUSTE : automatico ? MOVIMIENTO_APERTURA : MOVIMIENTO_SALDO_INICIAL,
      entidadFinanciera: detalle.entidadFinanciera,
      entidadSiglas: s.entidadCreadora?.siglas ?? '',
      documentoId: s.id,
      numeroDocumento: s.numero ?? '',
      fechaRegistro: fecha,
      automatico,
    });
  }
}

/**
 * Al aprobar un RAUT: la creación agrega la autorización a los registros; la modificación cambia el responsable o el
 * estado de la autorización elegida. En los dos casos el documento se suma al historial del registro.
 */
export function registrarAutorizacion(datos: DatosTaller, s: SolicitudResponse, fecha: string): void {
  const d = s.detalleAutorizacion;
  if (!d || datos.registrosAutorizacion.some((r) => r.documentos.some((x) => x.documentoId === s.id))) return;
  const documento = { documentoId: s.id, numero: s.numero ?? '', tipoAccion: (s.tipoAccion === 'modificacion' ? 'modificacion' : 'creacion') as TipoAccionAutorizacion, fecha };
  const existente = d.registroId ? datos.registrosAutorizacion.find((r) => r.id === d.registroId) : undefined;
  if (documento.tipoAccion === 'modificacion' && existente) {
    // La modificación es de vigencia: SÍ cambia la fecha hasta; NO da de baja (Inactivo) y conserva las fechas.
    existente.estado = d.estado;
    if (d.estado === 'Activo') existente.fechaHasta = d.fechaHasta;
    existente.documentoId = s.id;
    existente.numeroDocumento = documento.numero;
    existente.fechaRegistro = fecha;
    existente.documentos.push(documento);
    return;
  }
  datos.registrosAutorizacion.push({
    id: nuevoId(datos, 'aut'),
    procedimiento: d.procedimiento,
    responsable: d.responsable,
    cuentaBancaria: d.cuentaBancaria,
    estado: 'Activo',
    fechaDesde: d.fechaDesde,
    fechaHasta: d.fechaHasta,
    motivo: (s.asuntoMotivo ?? '').replace(/^\[[^\]]*\]\s*/, ''),
    entidadSiglas: s.entidadCreadora?.siglas ?? '',
    documentoId: s.id,
    numeroDocumento: documento.numero,
    fechaRegistro: fecha,
    documentos: [documento],
  });
}

/**
 * Al aprobarse una autorización excepcional activa, se avisa al creador que hará el ajuste del saldo inicial (Victoria):
 * la notificación abre el documento de autorización.
 */
export function avisarAutorizacionAjuste(datos: DatosTaller, s: SolicitudResponse, fecha: string, leida = false): void {
  const d = s.detalleAutorizacion;
  if (!d || d.estado !== 'Activo') return;
  datos.notificaciones.push({
    id: nuevoId(datos, 'not'),
    tipo: 'AUTORIZACION_AJUSTE_SALDO',
    titulo: 'Autorización para ajustar el saldo inicial',
    mensaje: mensajeAutorizacionVigente(d.cuentaBancaria, d.fechaHasta),
    leida,
    leidaEn: leida ? fecha : null,
    createdAt: fecha,
    documento: { id: s.id, numero: s.numero, catDocumento: TIPO_AUTORIZACION },
    paraUsuarioId: USUARIO_AJUSTE_SALDO,
  });
}

/** Cuentas bancarias con saldo inicial registrado: las únicas que se pueden autorizar para ajuste. */
export function cuentasConSaldoInicial(datos: DatosTaller): Set<string> {
  return new Set(datos.registrosSaldos.filter((r) => r.estado === 'Activo').map((r) => r.cuentaBancaria));
}

export function filaHistorial(
  datos: DatosTaller,
  anterior: EstadoDocumento | null,
  nuevo: EstadoDocumento,
  fecha: string,
  usuario: UsuarioDemo,
  rol: { codigo: string; nombre: string },
  comentario: string | null = null,
): HistorialItem {
  return {
    id: nuevoId(datos, 'hist'),
    estadoAnterior: anterior,
    estadoNuevo: nuevo,
    comentario,
    createdAt: fecha,
    creador: { nombres: usuario.nombres, apellidoPaterno: usuario.apellidoPaterno, apellidoMaterno: usuario.apellidoMaterno },
    perfil: { cfgPerfil: { rol } },
  };
}

/** El sistema «SIAF RP»: registra y procesa los documentos automáticos y verifica las autorizaciones excepcionales. */
export const USUARIO_SISTEMA: UsuarioDemo = { ...USUARIOS_DEMO[0], id: 'sistema', nombres: 'SIAF RP', apellidoPaterno: '', apellidoMaterno: '' };
export const ROL_SISTEMA = { codigo: 'SISTEMA', nombre: 'Sistema' };

// ─── Datos iniciales ───────────────────────────────────────────────

const ROL_CREADOR = { codigo: 'CREADOR', nombre: 'Creador' };
const ROL_APROBADOR = { codigo: 'APROBADOR', nombre: 'Aprobador' };

function enFecha(dia: string, horas: number, dias = 0): string {
  const fecha = new Date(`${dia}T00:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  fecha.setHours(horas, 15 + dias * 7, 0, 0);
  return fecha.toISOString();
}

function crearDatosIniciales(): DatosTaller {
  const datos: DatosTaller = {
    version: VERSION,
    solicitudes: [],
    registrosTraslado: [],
    registrosSaldos: [],
    registrosAutorizacion: [],
    notificaciones: [],
    correlativos: {},
    secuenciaSaldo: 0,
    secuenciaTraslado: 0,
    secuencia: 0,
  };
  const ana = USUARIOS_DEMO[0];
  const luis = USUARIOS_DEMO[1];

  crearSaldosIniciales(datos);
  crearAjustesSaldo(datos);
  crearAutorizaciones(datos);
  crearSaldosApertura(datos);
  crearTraslados(datos);

  // Notificaciones: el aprobador tiene una solicitud por aprobar; el creador, una observada y otras ya leídas.
  const aviso = (s: SolicitudResponse, tipo: string, titulo: string, mensaje: string, leida: boolean, destino: Pick<NotificacionMock, 'paraUsuarioId' | 'paraRolCodigo'>): NotificacionMock => ({
    id: nuevoId(datos, 'not'),
    tipo,
    titulo,
    mensaje,
    leida,
    leidaEn: leida ? s.updatedAt ?? null : null,
    createdAt: s.updatedAt ?? s.createdAt,
    documento: { id: s.id, numero: s.numero, catDocumento: TIPOS_DOCUMENTO.find((t) => t.codigo === s.catDocumento?.codigo) ?? TIPO_DOCUMENTO },
    ...destino,
  });
  const porEstado = (estado: string) => datos.solicitudes.filter((s) => s.estado === estado);
  for (const s of porEstado('VERIFICADO')) {
    datos.notificaciones.push(aviso(s, 'DOCUMENTO_VERIFICADO', 'Solicitud por aprobar', `La solicitud ${s.numero} fue verificada y espera su aprobación.`, false, { paraRolCodigo: 'APROBADOR' }));
  }
  for (const s of porEstado('OBSERVADO')) {
    datos.notificaciones.push(aviso(s, 'DOCUMENTO_OBSERVADO', 'Solicitud observada', `La solicitud ${s.numero} fue observada: revise el comentario y subsane.`, false, { paraUsuarioId: ana.id }));
  }
  for (const s of porEstado('RECHAZADO')) {
    datos.notificaciones.push(aviso(s, 'DOCUMENTO_RECHAZADO', 'Solicitud rechazada', `La solicitud ${s.numero} fue rechazada.`, true, { paraUsuarioId: ana.id }));
  }
  const ultimaAprobada = porEstado('APROBADO').at(-1);
  if (ultimaAprobada) {
    datos.notificaciones.push(aviso(ultimaAprobada, 'DOCUMENTO_APROBADO', 'Solicitud aprobada', `La solicitud ${ultimaAprobada.numero} fue aprobada.`, true, { paraUsuarioId: ana.id }));
  }

  return datos;
}

// ─── Saldos iniciales (RSIN) ───────────────────────────────────────

interface SemillaSaldos {
  creada: string;
  estado: 'ELABORADO' | 'VERIFICADO' | 'APROBADO';
  entidad: string;
  /** Cuenta bancaria, fecha de operación y el total, que se reparte entre sus libretas. */
  saldos: { cuenta: string; fecha: string; total: number }[];
}

const SEMILLAS_SALDOS: SemillaSaldos[] = [
  { creada: '2026-01-08', estado: 'APROBADO', entidad: '0001', saldos: [
    { cuenta: '12073303572000000003', fecha: '2026-01-02', total: 100000 },
    { cuenta: '11040103570200000000', fecha: '2026-01-02', total: 100000 },
  ] },
  { creada: '2026-02-11', estado: 'APROBADO', entidad: '0018', saldos: [{ cuenta: '00000281794000000005', fecha: '2026-02-02', total: 2500000 }] },
  { creada: '2026-07-14', estado: 'VERIFICADO', entidad: '0002', saldos: [{ cuenta: '19300456712000000002', fecha: '2026-07-13', total: 380000 }] },
  { creada: '2026-09-10', estado: 'ELABORADO', entidad: '0011', saldos: [{ cuenta: '01100586230200000007', fecha: '2026-09-09', total: 75000 }] },
];

/** Reparte el total entre las libretas de la cuenta (la última se lleva el resto). */
function saldoSemilla(datos: DatosTaller, cuenta: string, fecha: string, total: number): SaldoInicial {
  const libretas = cuentasRegistroDe(cuenta);
  const parte = Math.floor(total / libretas.length);
  const importes = Object.fromEntries(libretas.map((l, i) => [l.idCorrelativo, i === libretas.length - 1 ? total - parte * (libretas.length - 1) : parte]));
  return calcularSaldo(nuevoId(datos, 'sal'), fecha, cuenta, importes);
}

function crearSaldosIniciales(datos: DatosTaller): void {
  const ana = USUARIOS_DEMO[0];
  const luis = USUARIOS_DEMO[1];
  for (const semilla of SEMILLAS_SALDOS) {
    const id = nuevoId(datos, 'sol');
    const creada = enFecha(semilla.creada, 9);
    const historial: HistorialItem[] = [
      filaHistorial(datos, null, 'NUEVO', creada, ana, ROL_CREADOR),
      filaHistorial(datos, 'NUEVO', 'ELABORADO', creada, ana, ROL_CREADOR),
    ];
    if (semilla.estado !== 'ELABORADO') historial.push(filaHistorial(datos, 'ELABORADO', 'VERIFICADO', enFecha(semilla.creada, 10, 1), ana, ROL_CREADOR));
    if (semilla.estado === 'APROBADO') historial.push(filaHistorial(datos, 'VERIFICADO', 'APROBADO', enFecha(semilla.creada, 11, 2), luis, ROL_APROBADOR));
    const ultima = historial[historial.length - 1].createdAt;
    const solicitud: SolicitudResponse = {
      id,
      numero: numeroDocumento(datos, CODIGO_SALDOS, new Date(creada)),
      catDocumento: TIPO_SALDOS,
      tipoAccion: 'creacion',
      estado: semilla.estado,
      asuntoMotivo: '[OFICINA GENERAL DE ADMINISTRACIÓN] Registro de saldos iniciales en libro bancos.',
      entidadCreadora: ENTIDAD_CREADORA,
      unidadCreadora: UNIDAD_CREADORA,
      creador: { id: ana.id, nombres: ana.nombres, apellidoPaterno: ana.apellidoPaterno, apellidoMaterno: ana.apellidoMaterno },
      fechaRegistro: creada,
      createdAt: creada,
      updatedAt: ultima,
      itemsCuenta: [],
      detalleSaldosIniciales: {
        documentoId: id,
        entidadFinanciera: semilla.entidad,
        saldos: semilla.saldos.map((s) => saldoSemilla(datos, s.cuenta, s.fecha, s.total)),
      },
      sustentos: [],
      historialEstados: historial,
    };
    datos.solicitudes.push(solicitud);
    if (semilla.estado === 'APROBADO') registrarSaldos(datos, solicitud, ultima);
  }
}

// ─── Ajustes de saldo inicial (RSIN, tipo de operación 2) ──────────

interface SemillaAjuste {
  creada: string;
  estado: 'VERIFICADO' | 'APROBADO';
  /** Cuenta del saldo inicial registrado que se ajusta. */
  cuenta: string;
  fecha: string;
  naturaleza: NaturalezaAjuste;
  total: number;
  sustento: string;
}

const SEMILLAS_AJUSTE: SemillaAjuste[] = [
  { creada: '2026-03-17', estado: 'APROBADO', cuenta: '12073303572000000003', fecha: '2026-03-16', naturaleza: 'Crédito', total: 5000, sustento: 'Autorización de ajuste 001-2026.pdf' },
  { creada: '2026-05-06', estado: 'APROBADO', cuenta: '00000281794000000005', fecha: '2026-05-05', naturaleza: 'Débito', total: 150000, sustento: 'Autorización de ajuste 002-2026.pdf' },
  { creada: '2026-10-20', estado: 'APROBADO', cuenta: '11040103570200000000', fecha: '2026-10-19', naturaleza: 'Crédito', total: 20000, sustento: 'Autorización de ajuste 003-2026.pdf' },
];

/** Ajustes sobre saldos ya registrados: cada uno ajusta una sola cuenta bancaria; el saldo original no cambia. */
function crearAjustesSaldo(datos: DatosTaller): void {
  const ana = USUARIOS_DEMO[0];
  const luis = USUARIOS_DEMO[1];
  for (const semilla of SEMILLAS_AJUSTE) {
    const original = datos.registrosSaldos.find((r) => r.cuentaBancaria === semilla.cuenta && !r.ajuste);
    if (!original) continue;
    const id = nuevoId(datos, 'sol');
    const creada = enFecha(semilla.creada, 9);
    const historial: HistorialItem[] = [
      filaHistorial(datos, null, 'NUEVO', creada, ana, ROL_CREADOR),
      filaHistorial(datos, 'NUEVO', 'ELABORADO', creada, ana, ROL_CREADOR),
      filaHistorial(datos, 'ELABORADO', 'VERIFICADO', enFecha(semilla.creada, 10, 1), ana, ROL_CREADOR),
    ];
    if (semilla.estado === 'APROBADO') historial.push(filaHistorial(datos, 'VERIFICADO', 'APROBADO', enFecha(semilla.creada, 11, 2), luis, ROL_APROBADOR));
    const ultima = historial[historial.length - 1].createdAt;
    const saldo: SaldoInicial = {
      ...saldoSemilla(datos, semilla.cuenta, semilla.fecha, semilla.total),
      sustento: semilla.sustento,
      ajuste: {
        naturaleza: semilla.naturaleza,
        secuenciaReferencia: original.secuencia ?? '',
        saldoInicial: redondear(original.importeCuenta),
        libretasIniciales: original.libretas.map((l) => ({ ...l })),
      },
    };
    const solicitud: SolicitudResponse = {
      id,
      numero: numeroDocumento(datos, CODIGO_SALDOS, new Date(creada)),
      catDocumento: TIPO_SALDOS,
      tipoAccion: 'creacion',
      estado: semilla.estado,
      asuntoMotivo: `[OFICINA GENERAL DE ADMINISTRACIÓN] Ajuste de saldo inicial (${semilla.naturaleza.toLowerCase()}) autorizado.`,
      entidadCreadora: ENTIDAD_CREADORA,
      unidadCreadora: UNIDAD_CREADORA,
      creador: { id: ana.id, nombres: ana.nombres, apellidoPaterno: ana.apellidoPaterno, apellidoMaterno: ana.apellidoMaterno },
      fechaRegistro: creada,
      createdAt: creada,
      updatedAt: ultima,
      itemsCuenta: [],
      detalleSaldosIniciales: { documentoId: id, entidadFinanciera: original.entidadFinanciera, saldos: [saldo] },
      sustentos: [],
      historialEstados: historial,
    };
    datos.solicitudes.push(solicitud);
    if (semilla.estado === 'APROBADO') registrarSaldos(datos, solicitud, ultima);
  }
}

// ─── Documentos de autorización (RAUT) ─────────────────────────────

interface SemillaAutorizacion {
  creada: string;
  /** Grabado (ELABORADO) o autorizado: elaborado y aprobado por el creador autorizador, verificado por el sistema. */
  estado: 'ELABORADO' | 'APROBADO';
  tipoAccion: TipoAccionAutorizacion;
  /** En una creación, la autorización; en una modificación, el procedimiento y la cuenta del registro y la vigencia nueva. */
  datos: Omit<AutorizacionDatos, 'registroId' | 'tipoModificacion'>;
  justificacion: string;
}

const SEMILLAS_AUTORIZACION: SemillaAutorizacion[] = [
  { creada: '2026-02-03', estado: 'APROBADO', tipoAccion: 'creacion', justificacion: 'Autorización para registrar los saldos iniciales de la cuenta en dólares del BCRP.',
    datos: { procedimiento: 'saldos-iniciales', responsable: 'RU21568', cuentaBancaria: '12073303572000000003', estado: 'Activo', fechaDesde: '2026-02-03', fechaHasta: '2026-12-31' } },
  { creada: '2026-02-05', estado: 'APROBADO', tipoAccion: 'creacion', justificacion: 'Autorización para registrar los saldos iniciales de recursos ordinarios.',
    datos: { procedimiento: 'saldos-iniciales', responsable: 'RU15846', cuentaBancaria: '11040103570200000000', estado: 'Activo', fechaDesde: '2026-02-05', fechaHasta: '2026-06-30' } },
  { creada: '2026-03-02', estado: 'APROBADO', tipoAccion: 'creacion', justificacion: 'Autorización para registrar los saldos iniciales de la cuenta en dólares del BCRP.',
    datos: { procedimiento: 'saldos-iniciales', responsable: 'RU22471', cuentaBancaria: '12073303572000000003', estado: 'Activo', fechaDesde: '2026-03-02', fechaHasta: '2026-12-31' } },
  { creada: '2026-04-14', estado: 'APROBADO', tipoAccion: 'creacion', justificacion: 'Autorización para registrar los saldos iniciales de la Cuenta Única del Tesoro.',
    datos: { procedimiento: 'saldos-iniciales', responsable: 'RU10538', cuentaBancaria: '00000281794000000005', estado: 'Activo', fechaDesde: '2026-04-14', fechaHasta: '2026-12-31' } },
  { creada: '2026-04-20', estado: 'APROBADO', tipoAccion: 'creacion', justificacion: 'Autorización para registrar los saldos iniciales de la Cuenta Única del Tesoro.',
    datos: { procedimiento: 'saldos-iniciales', responsable: 'RU38192', cuentaBancaria: '00000281794000000005', estado: 'Activo', fechaDesde: '2026-04-20', fechaHasta: '2026-09-30' } },
  { creada: '2026-06-29', estado: 'APROBADO', tipoAccion: 'modificacion', justificacion: 'Se amplía la vigencia hasta el cierre del ejercicio.',
    datos: { procedimiento: 'saldos-iniciales', responsable: 'RU15846', cuentaBancaria: '11040103570200000000', estado: 'Activo', fechaDesde: '2026-02-05', fechaHasta: '2026-12-31' } },
  { creada: '2026-08-18', estado: 'APROBADO', tipoAccion: 'modificacion', justificacion: 'Se desactiva la autorización: la cuenta pasó a otra unidad ejecutora.',
    datos: { procedimiento: 'saldos-iniciales', responsable: 'RU38192', cuentaBancaria: '00000281794000000005', estado: 'Inactivo', fechaDesde: '2026-04-20', fechaHasta: '2026-09-30' } },
  { creada: '2026-09-22', estado: 'APROBADO', tipoAccion: 'creacion', justificacion: 'Autorización para registrar los saldos iniciales de la cuenta de recaudación del BCP.',
    datos: { procedimiento: 'saldos-iniciales', responsable: 'RU27654', cuentaBancaria: '11040103570200000000', estado: 'Activo', fechaDesde: '2026-09-22', fechaHasta: '2027-03-31' } },
  { creada: '2026-10-06', estado: 'ELABORADO', tipoAccion: 'modificacion', justificacion: 'Se acorta la vigencia de la autorización.',
    datos: { procedimiento: 'saldos-iniciales', responsable: 'RU22471', cuentaBancaria: '12073303572000000003', estado: 'Activo', fechaDesde: '2026-03-02', fechaHasta: '2026-11-30' } },
  { creada: '2026-10-21', estado: 'ELABORADO', tipoAccion: 'creacion', justificacion: 'Autorización para registrar los saldos iniciales de la cuenta de garantías.',
    datos: { procedimiento: 'saldos-iniciales', responsable: 'RU21568', cuentaBancaria: '00000281794000000005', estado: 'Activo', fechaDesde: '2026-11-01', fechaHasta: '2026-12-31' } },
];

function crearAutorizaciones(datos: DatosTaller): void {
  const rosa = USUARIOS_DEMO.find((u) => u.id === 'usr-rosa') ?? USUARIOS_DEMO[0];
  for (const semilla of SEMILLAS_AUTORIZACION) {
    const id = nuevoId(datos, 'sol');
    const creada = enFecha(semilla.creada, 9);
    const historial: HistorialItem[] = [
      filaHistorial(datos, null, 'NUEVO', creada, rosa, ROL_CREADOR),
      filaHistorial(datos, 'NUEVO', 'ELABORADO', enFecha(semilla.creada, 10), rosa, ROL_CREADOR),
    ];
    if (semilla.estado === 'APROBADO') {
      historial.push(filaHistorial(datos, 'ELABORADO', 'VERIFICADO', enFecha(semilla.creada, 10), USUARIO_SISTEMA, ROL_SISTEMA));
      historial.push(filaHistorial(datos, 'VERIFICADO', 'APROBADO', enFecha(semilla.creada, 10), rosa, ROL_CREADOR));
    }
    const ultima = historial[historial.length - 1].createdAt;
    // La modificación apunta a la autorización registrada del mismo procedimiento, cuenta y responsable.
    const registro = semilla.tipoAccion === 'modificacion'
      ? datos.registrosAutorizacion.find((r) => r.procedimiento === semilla.datos.procedimiento && r.cuentaBancaria === semilla.datos.cuentaBancaria && r.responsable === semilla.datos.responsable)
      : undefined;
    const solicitud: SolicitudResponse = {
      id,
      numero: numeroDocumento(datos, CODIGO_AUTORIZACION, new Date(creada)),
      catDocumento: TIPO_AUTORIZACION,
      tipoAccion: semilla.tipoAccion,
      estado: semilla.estado,
      // La modificación lleva la justificación de la creación.
      asuntoMotivo: `[OFICINA GENERAL DE ADMINISTRACIÓN] ${registro?.motivo || semilla.justificacion}`,
      entidadCreadora: ENTIDAD_CREADORA,
      unidadCreadora: UNIDAD_CREADORA,
      creador: { id: rosa.id, nombres: rosa.nombres, apellidoPaterno: rosa.apellidoPaterno, apellidoMaterno: rosa.apellidoMaterno },
      fechaRegistro: creada,
      createdAt: creada,
      updatedAt: ultima,
      itemsCuenta: [],
      detalleAutorizacion: {
        documentoId: id,
        ...semilla.datos,
        responsable: registro?.responsable ?? semilla.datos.responsable,
        registroId: registro?.id ?? null,
        tipoModificacion: semilla.tipoAccion === 'modificacion' ? 'vigencia' : null,
      },
      sustentos: [],
      historialEstados: historial,
    };
    datos.solicitudes.push(solicitud);
    if (semilla.estado === 'APROBADO') registrarAutorizacion(datos, solicitud, ultima);
  }
  // Demo: los registros de ejemplo quedan inactivos, sin alertas de ajuste al empezar. La autorización que se crea en
  // la clase es la única activa (y la que se puede modificar).
  for (const r of datos.registrosAutorizacion) r.estado = 'Inactivo';
}

// ─── Registro automático de saldos de apertura (RASA) ──────────────

const SISTEMA = USUARIO_SISTEMA;

interface SemillaApertura {
  /** Día del registro (yyyy-mm-dd), a las 00:00:00. */
  dia: string;
  estado: 'REGISTRADO' | 'PROCESADO';
  entidad: string;
  saldos: { cuenta: string; total: number }[];
}

const SEMILLAS_APERTURA: SemillaApertura[] = [
  { dia: '2026-01-01', estado: 'PROCESADO', entidad: '0001', saldos: [{ cuenta: '11040103570200000000', total: 100000 }] },
  { dia: '2026-01-01', estado: 'PROCESADO', entidad: '0018', saldos: [{ cuenta: '00000281794000000005', total: 1250000 }] },
  { dia: '2026-10-27', estado: 'REGISTRADO', entidad: '0002', saldos: [{ cuenta: '19300456712000000002', total: 420000 }] },
];

function crearSaldosApertura(datos: DatosTaller): void {
  for (const semilla of SEMILLAS_APERTURA) {
    const id = nuevoId(datos, 'sol');
    const registrado = new Date(`${semilla.dia}T00:00:00`).toISOString();
    const procesado = new Date(`${semilla.dia}T00:00:02`).toISOString();
    const historial: HistorialItem[] = [filaHistorial(datos, null, 'REGISTRADO', registrado, SISTEMA, ROL_SISTEMA)];
    if (semilla.estado === 'PROCESADO') historial.push(filaHistorial(datos, 'REGISTRADO', 'PROCESADO', procesado, SISTEMA, ROL_SISTEMA));
    const ultima = historial[historial.length - 1].createdAt;
    const solicitud: SolicitudResponse = {
      id,
      numero: numeroDocumento(datos, CODIGO_AUTOMATICO, new Date(registrado)),
      catDocumento: TIPO_AUTOMATICO,
      tipoAccion: 'creacion',
      estado: semilla.estado,
      asuntoMotivo: 'Registro automático de saldos de apertura.',
      entidadCreadora: ENTIDAD_CREADORA,
      unidadCreadora: UNIDAD_CREADORA,
      creador: { id: SISTEMA.id, nombres: SISTEMA.nombres, apellidoPaterno: '', apellidoMaterno: '' },
      fechaRegistro: registrado,
      createdAt: registrado,
      updatedAt: ultima,
      itemsCuenta: [],
      detalleSaldosIniciales: {
        documentoId: id,
        entidadFinanciera: semilla.entidad,
        saldos: semilla.saldos.map((s) => saldoSemilla(datos, s.cuenta, semilla.dia, s.total)),
      },
      sustentos: [],
      historialEstados: historial,
    };
    datos.solicitudes.push(solicitud);
    if (semilla.estado === 'PROCESADO') registrarSaldos(datos, solicitud, ultima);
  }
}

// ─── Traslados entre cuentas de registros (RTCR) ───────────────────

/**
 * Cuentas de registro de una cuenta bancaria con su saldo disponible: lo que dejaron los saldos iniciales activos
 * (los ajustes con su signo) más lo que movieron los traslados procesados (el crédito suma y el débito resta).
 */
export function libretasConSaldo(datos: DatosTaller, cuentaBancaria: string): LibretaSaldo[] {
  const saldo = new Map<string, number>();
  const sumarA = (id: string, importe: number) => saldo.set(id, (saldo.get(id) ?? 0) + importe);
  for (const r of datos.registrosSaldos) {
    if (r.estado !== 'Activo' || r.cuentaBancaria !== cuentaBancaria) continue;
    for (const l of r.libretas) sumarA(l.idCorrelativo, importeFirmado(l));
  }
  for (const t of datos.registrosTraslado) {
    if (t.estado !== 'Activo' || t.cuentaBancaria !== cuentaBancaria) continue;
    for (const m of t.movimientos) sumarA(m.idCorrelativo, m.naturaleza === 'Débito' ? -m.importe : m.importe);
  }
  return cuentasRegistroDe(cuentaBancaria).map((c) => ({
    idCorrelativo: c.idCorrelativo,
    numero: c.numero,
    descripcion: c.descripcion,
    saldoDisponible: redondear(saldo.get(c.idCorrelativo) ?? 0),
  }));
}

/** Al procesarse un RTCR: el traslado pasa a los registros con su secuencia y mueve el saldo de las libretas. */
export function registrarTraslado(datos: DatosTaller, s: SolicitudResponse, fecha: string): void {
  const d = s.detalleTraslado;
  if (!d || datos.registrosTraslado.some((r) => r.documentoId === s.id)) return;
  datos.secuenciaTraslado += 1;
  datos.registrosTraslado.push({
    id: nuevoId(datos, 'tr'),
    secuencia: String(datos.secuenciaTraslado).padStart(6, '0'),
    estado: 'Activo',
    cuentaBancaria: d.cuentaBancaria,
    movimientos: d.movimientos,
    moneda: cuentaPorNumero(d.cuentaBancaria)?.moneda ?? 'PEN',
    modalidad: modalidad(d.movimientos) ?? '1 a 1',
    total: sumar(d.movimientos, 'Débito'),
    entidadSiglas: s.entidadCreadora?.siglas ?? '',
    documentoId: s.id,
    numeroDocumento: s.numero ?? '',
    fechaRegistro: fecha,
  });
}

/** Traslado procesado: avisa al creador y a los aprobadores que las libretas quedaron actualizadas. */
export function notificarProcesado(datos: DatosTaller, s: SolicitudResponse, fecha: string, leida = false): void {
  const base = {
    tipo: 'DOCUMENTO_PROCESADO',
    titulo: 'Traslado procesado',
    mensaje: `El documento ${s.numero} se registró en las libretas de las cuentas de registro.`,
    leida,
    leidaEn: leida ? fecha : null,
    createdAt: fecha,
    documento: { id: s.id, numero: s.numero, catDocumento: TIPO_DOCUMENTO },
  };
  datos.notificaciones.push({ id: nuevoId(datos, 'not'), ...base, paraUsuarioId: s.creador?.id });
  datos.notificaciones.push({ id: nuevoId(datos, 'not'), ...base, paraRolCodigo: 'APROBADOR' });
}

interface SemillaTraslado {
  creada: string;
  estado: 'ELABORADO' | 'VERIFICADO' | 'OBSERVADO' | 'RECHAZADO' | 'PROCESADO';
  cuenta: string;
  /** [idCorrelativo, naturaleza, importe] */
  movimientos: [string, 'Débito' | 'Crédito', number][];
  justificacion: string;
  comentario?: string;
}

/** Cuenta Única del Tesoro (6 libretas) y Recursos Ordinarios (5 libretas): las que tienen saldo inicial aprobado. */
const CUT = '00000281794000000005';
const RO = '11040103570200000000';

const SEMILLAS_TRASLADO: SemillaTraslado[] = [
  { creada: '2026-09-14', estado: 'PROCESADO', cuenta: CUT, justificacion: 'Consolidar lo recaudado por IPM e Impuesto al Rodaje en FONCOMUN.',
    movimientos: [['000032', 'Débito', 100000], ['000033', 'Débito', 50000], ['000034', 'Crédito', 150000]] },
  { creada: '2026-09-22', estado: 'PROCESADO', cuenta: RO, justificacion: 'Distribuir recursos ordinarios entre dos cuentas de registro.',
    movimientos: [['000012', 'Débito', 10000], ['000013', 'Crédito', 6000], ['000014', 'Crédito', 4000]] },
  { creada: '2026-10-06', estado: 'RECHAZADO', cuenta: CUT, justificacion: 'Trasladar el saldo de la cuenta de registro 5 a la 6.',
    movimientos: [['000036', 'Débito', 30000], ['000037', 'Crédito', 30000]], comentario: '[Información incorrecta] La cuenta de destino no corresponde al recurso.' },
  { creada: '2026-10-20', estado: 'OBSERVADO', cuenta: RO, justificacion: 'Reasignar recursos ordinarios a la cuenta de registro 5.',
    movimientos: [['000015', 'Débito', 3000], ['000016', 'Crédito', 3000]], comentario: 'Indique en la justificación el recurso de destino.' },
  { creada: '2026-10-28', estado: 'VERIFICADO', cuenta: CUT, justificacion: 'Trasladar recursos de la cuenta de registro 4 a la 5.',
    movimientos: [['000035', 'Débito', 80000], ['000036', 'Crédito', 80000]] },
  { creada: '2026-11-03', estado: 'ELABORADO', cuenta: CUT, justificacion: 'Repartir el saldo de la cuenta de registro 6 entre las cuentas 1 y 2.',
    movimientos: [['000037', 'Débito', 20000], ['000032', 'Crédito', 12000], ['000033', 'Crédito', 8000]] },
];

function crearTraslados(datos: DatosTaller): void {
  const ana = USUARIOS_DEMO[0];
  const luis = USUARIOS_DEMO[1];
  for (const semilla of SEMILLAS_TRASLADO) {
    const id = nuevoId(datos, 'sol');
    const creada = enFecha(semilla.creada, 9);
    const historial: HistorialItem[] = [
      filaHistorial(datos, null, 'NUEVO', creada, ana, ROL_CREADOR),
      filaHistorial(datos, 'NUEVO', 'ELABORADO', creada, ana, ROL_CREADOR),
    ];
    if (semilla.estado !== 'ELABORADO') historial.push(filaHistorial(datos, 'ELABORADO', 'VERIFICADO', enFecha(semilla.creada, 10, 1), ana, ROL_CREADOR));
    if (semilla.estado === 'OBSERVADO' || semilla.estado === 'RECHAZADO') {
      historial.push(filaHistorial(datos, 'VERIFICADO', semilla.estado, enFecha(semilla.creada, 11, 2), luis, ROL_APROBADOR, semilla.comentario ?? null));
    }
    if (semilla.estado === 'PROCESADO') {
      const aprobado = enFecha(semilla.creada, 11, 2);
      historial.push(filaHistorial(datos, 'VERIFICADO', 'APROBADO', aprobado, luis, ROL_APROBADOR));
      historial.push(filaHistorial(datos, 'APROBADO', 'PROCESADO', aprobado, SISTEMA, ROL_SISTEMA));
    }
    const ultima = historial[historial.length - 1].createdAt;
    const movimientos: MovimientoTraslado[] = semilla.movimientos.map(([idCorrelativo, naturaleza, importe]) => ({ idCorrelativo, naturaleza, importe }));
    const solicitud: SolicitudResponse = {
      id,
      numero: numeroDocumento(datos, CODIGO_DOCUMENTO, new Date(creada)),
      catDocumento: TIPO_DOCUMENTO,
      tipoAccion: 'creacion',
      estado: semilla.estado,
      asuntoMotivo: `[OFICINA GENERAL DE ADMINISTRACIÓN] ${semilla.justificacion}`,
      entidadCreadora: ENTIDAD_CREADORA,
      unidadCreadora: UNIDAD_CREADORA,
      creador: { id: ana.id, nombres: ana.nombres, apellidoPaterno: ana.apellidoPaterno, apellidoMaterno: ana.apellidoMaterno },
      fechaRegistro: creada,
      createdAt: creada,
      updatedAt: ultima,
      itemsCuenta: [],
      detalleTraslado: { documentoId: id, cuentaBancaria: semilla.cuenta, movimientos },
      sustentos: [],
      historialEstados: historial,
    };
    if (semilla.estado === 'PROCESADO') solicitud.fechaAprobacion = ultima;
    datos.solicitudes.push(solicitud);
    if (semilla.estado === 'PROCESADO') registrarTraslado(datos, solicitud, ultima);
  }
}
