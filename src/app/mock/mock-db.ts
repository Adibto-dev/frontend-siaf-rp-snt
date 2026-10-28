import type { NotificacionResponse } from '../core/api/notificaciones-api.service';
import type { HistorialItem, SolicitudResponse } from '../core/api/solicitudes-api.service';
import type { EstadoDocumento } from '../core/models/documento.model';
import {
  CODIGO_DOCUMENTO,
  CuentaBancariaDatos,
  CuentaBancariaRegistro,
  NOMBRE_DOCUMENTO,
} from '../modules/tesoreria/cuentas-bancarias/models/cuenta-bancaria.model';
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
  cuentasRegistroDe,
  redondear,
} from '../modules/tesoreria/saldos-iniciales/models/saldo-inicial.model';
import {
  AutorizacionDatos,
  AutorizacionRegistro,
  CODIGO_DOCUMENTO as CODIGO_AUTORIZACION,
  NOMBRE_DOCUMENTO as NOMBRE_AUTORIZACION,
  TipoAccionAutorizacion,
} from '../modules/tesoreria/autorizaciones/models/autorizacion.model';
import { USUARIOS_DEMO, UsuarioDemo } from './usuarios-demo';

/**
 * «Base de datos» del backend simulado: vive en el `localStorage` del navegador, así lo que hace un usuario lo ve
 * otro al iniciar sesión (en el mismo navegador). `reiniciarDatosDemo()` vuelve a los datos iniciales.
 */

const CLAVE = 'taller-siaf-rp:datos';
const VERSION = 10;

export interface NotificacionMock extends NotificacionResponse {
  /** Destinatario: un usuario puntual o, si no hay, todos los perfiles con este rol. */
  paraUsuarioId?: string;
  paraRolCodigo?: 'CREADOR' | 'APROBADOR';
}

export interface DatosTaller {
  version: number;
  solicitudes: SolicitudResponse[];
  registros: CuentaBancariaRegistro[];
  /** Saldos iniciales aprobados (documentos RSIN). */
  registrosSaldos: SaldoInicialRegistro[];
  /** Autorizaciones aprobadas (documentos RAUT). */
  registrosAutorizacion: AutorizacionRegistro[];
  notificaciones: NotificacionMock[];
  /** Correlativo del número de documento, por código de documento (RTCR, RSIN). */
  correlativos: Record<string, number>;
  /** Secuencia que se asigna a cada saldo inicial al aprobarse. */
  secuenciaSaldo: number;
  correlativoRegistro: number;
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

export function leerDatos(): DatosTaller {
  try {
    const guardados = localStorage.getItem(CLAVE);
    if (guardados) {
      const datos = JSON.parse(guardados) as DatosTaller;
      if (datos.version === VERSION) return datos;
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
}

export function nuevoId(datos: DatosTaller, prefijo: string): string {
  datos.secuencia += 1;
  return `${prefijo}-${datos.secuencia}`;
}

/** Siguiente número de documento para su tipo: PCB-<código>-<correlativo>-<año>-MEF-OGA. */
export function numeroDocumento(datos: DatosTaller, codigo: string, fecha: Date): string {
  const correlativo = (datos.correlativos[codigo] ?? 0) + 1;
  datos.correlativos[codigo] = correlativo;
  return `PCB-${codigo}-${String(correlativo).padStart(5, '0')}-${fecha.getFullYear()}-MEF-OGA`;
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
    // La modificación es de vigencia: cambia el estado y las fechas.
    existente.estado = d.estado;
    existente.fechaDesde = d.estado === 'Activo' ? d.fechaDesde : null;
    existente.fechaHasta = d.estado === 'Activo' ? d.fechaHasta : null;
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
    entidadSiglas: s.entidadCreadora?.siglas ?? '',
    documentoId: s.id,
    numeroDocumento: documento.numero,
    fechaRegistro: fecha,
    documentos: [documento],
  });
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

// ─── Datos iniciales ───────────────────────────────────────────────

const ROL_CREADOR = { codigo: 'CREADOR', nombre: 'Creador' };
const ROL_APROBADOR = { codigo: 'APROBADOR', nombre: 'Aprobador' };

interface Semilla {
  datos: CuentaBancariaDatos;
  /** Día en que se creó la solicitud (yyyy-mm-dd). */
  creada: string;
  estado: 'ELABORADO' | 'VERIFICADO' | 'APROBADO' | 'OBSERVADO' | 'RECHAZADO';
  justificacion: string;
  comentario?: string;
  registroInactivo?: boolean;
}

function cuenta(banco: string, tipo: 'CORRIENTE' | 'AHORROS', moneda: 'PEN' | 'USD', n: number, denominacion: string, apertura: string, recaudadora: boolean): CuentaBancariaDatos {
  return {
    bancoCodigo: banco,
    tipoCuenta: tipo,
    moneda,
    numeroCuenta: `${banco}100${String(58213400000000 + n * 7919).slice(-14)}`,
    denominacion,
    fechaApertura: apertura,
    esRecaudadora: recaudadora,
  };
}

const SEMILLAS: Semilla[] = [
  { creada: '2026-01-16', estado: 'APROBADO', justificacion: 'Cuenta para la recaudación de tasas por procedimientos administrativos.', datos: cuenta('018', 'CORRIENTE', 'PEN', 1, 'Recaudación de tasas administrativas', '2026-01-15', true) },
  { creada: '2026-02-04', estado: 'APROBADO', justificacion: 'Cuenta para pagos a proveedores del exterior en dólares.', datos: cuenta('002', 'CORRIENTE', 'USD', 2, 'Pagos a proveedores del exterior', '2026-02-03', false) },
  { creada: '2026-02-23', estado: 'APROBADO', justificacion: 'Cuenta de ahorros para el fondo de caja chica de la oficina.', datos: cuenta('003', 'AHORROS', 'PEN', 3, 'Fondo de caja chica', '2026-02-20', false) },
  { creada: '2026-03-12', estado: 'APROBADO', justificacion: 'Cuenta para la recaudación de multas administrativas.', datos: cuenta('011', 'CORRIENTE', 'PEN', 4, 'Recaudación de multas', '2026-03-11', true) },
  { creada: '2026-04-09', estado: 'APROBADO', justificacion: 'Cuenta para las transferencias a unidades ejecutoras.', datos: cuenta('018', 'CORRIENTE', 'PEN', 5, 'Transferencias a unidades ejecutoras', '2026-04-08', false) },
  { creada: '2026-05-20', estado: 'APROBADO', justificacion: 'Cuenta para garantías recibidas en moneda extranjera.', datos: cuenta('009', 'AHORROS', 'USD', 6, 'Garantías en moneda extranjera', '2026-05-19', false), registroInactivo: true },
  { creada: '2026-06-03', estado: 'APROBADO', justificacion: 'Cuenta para la recaudación de servicios no exclusivos.', datos: cuenta('018', 'CORRIENTE', 'PEN', 7, 'Recaudación de servicios no exclusivos', '2026-06-02', true) },
  { creada: '2026-07-15', estado: 'APROBADO', justificacion: 'Cuenta de ahorros para encargos a las oficinas desconcentradas.', datos: cuenta('002', 'AHORROS', 'PEN', 8, 'Encargos a oficinas desconcentradas', '2026-07-14', false) },
  { creada: '2026-08-06', estado: 'RECHAZADO', justificacion: 'Cuenta para la recaudación de derechos de trámite.', datos: cuenta('009', 'CORRIENTE', 'PEN', 9, 'Recaudación de derechos de trámite', '2026-08-05', true), comentario: '[Información incorrecta] La cuenta ya está registrada con el código CB-0004.' },
  { creada: '2026-08-24', estado: 'VERIFICADO', justificacion: 'Cuenta en dólares para los fondos de cooperación internacional.', datos: cuenta('003', 'CORRIENTE', 'USD', 10, 'Fondos de cooperación internacional', '2026-08-21', false) },
  { creada: '2026-09-02', estado: 'OBSERVADO', justificacion: 'Cuenta para la recaudación por alquiler de ambientes.', datos: cuenta('011', 'CORRIENTE', 'PEN', 11, 'Recaudación de alquileres', '2026-09-01', true), comentario: 'Adjunte la constancia de apertura emitida por el banco.' },
  { creada: '2026-09-09', estado: 'ELABORADO', justificacion: 'Cuenta de ahorros para el fondo de viáticos.', datos: cuenta('018', 'AHORROS', 'PEN', 12, 'Fondo de viáticos', '2026-09-08', false) },
];

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
    registros: [],
    registrosSaldos: [],
    registrosAutorizacion: [],
    notificaciones: [],
    correlativos: {},
    secuenciaSaldo: 0,
    correlativoRegistro: 0,
    secuencia: 0,
  };
  const ana = USUARIOS_DEMO[0];
  const luis = USUARIOS_DEMO[1];

  for (const semilla of SEMILLAS) {
    const id = nuevoId(datos, 'sol');
    const creada = enFecha(semilla.creada, 9);
    const numero = numeroDocumento(datos, CODIGO_DOCUMENTO, new Date(creada));
    const historial: HistorialItem[] = [
      filaHistorial(datos, null, 'NUEVO', creada, ana, ROL_CREADOR),
      filaHistorial(datos, 'NUEVO', 'ELABORADO', enFecha(semilla.creada, 9, 0), ana, ROL_CREADOR),
    ];
    if (semilla.estado !== 'ELABORADO') {
      historial.push(filaHistorial(datos, 'ELABORADO', 'VERIFICADO', enFecha(semilla.creada, 10, 1), ana, ROL_CREADOR));
    }
    if (['APROBADO', 'OBSERVADO', 'RECHAZADO'].includes(semilla.estado)) {
      historial.push(filaHistorial(datos, 'VERIFICADO', semilla.estado, enFecha(semilla.creada, 11, 2), luis, ROL_APROBADOR, semilla.comentario ?? null));
    }
    const ultima = historial[historial.length - 1].createdAt;

    const solicitud: SolicitudResponse = {
      id,
      numero,
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
      detalleCuentaBancaria: { documentoId: id, ...semilla.datos },
      sustentos: [
        {
          id: nuevoId(datos, 'sus'),
          tipoSustento: 'sustento',
          archivo: { nombreOriginal: `Constancia de apertura ${String(datos.correlativos[CODIGO_DOCUMENTO]).padStart(2, '0')}.pdf`, storagePath: 'taller' },
        },
      ],
      historialEstados: historial,
    };
    datos.solicitudes.push(solicitud);

    if (semilla.estado === 'APROBADO') {
      datos.correlativoRegistro += 1;
      datos.registros.push({
        id: nuevoId(datos, 'cb'),
        codigo: `CB-${String(datos.correlativoRegistro).padStart(4, '0')}`,
        estado: semilla.registroInactivo ? 'Inactivo' : 'Activo',
        entidadSiglas: 'MEF',
        documentoId: id,
        numeroDocumento: numero,
        fechaRegistro: ultima,
        ...semilla.datos,
      });
    }
  }

  crearSaldosIniciales(datos);
  crearAjustesSaldo(datos);
  crearAutorizaciones(datos);
  crearSaldosApertura(datos);

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
  { creada: '2026-10-20', estado: 'VERIFICADO', cuenta: '11040103570200000000', fecha: '2026-10-19', naturaleza: 'Crédito', total: 20000, sustento: 'Autorización de ajuste 003-2026.pdf' },
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
  /** El creador autorizador graba (ELABORADO) o autoriza (APROBADO): no hay verificación ni aprobador. */
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
    datos: { procedimiento: 'saldos-iniciales', responsable: 'RU21574', cuentaBancaria: '11040103570200000000', estado: 'Activo', fechaDesde: '2026-02-05', fechaHasta: '2026-06-30' } },
  { creada: '2026-03-02', estado: 'APROBADO', tipoAccion: 'creacion', justificacion: 'Autorización para ajustar el saldo inicial de la cuenta en dólares del BCRP.',
    datos: { procedimiento: 'ajuste-saldo', responsable: 'RU21603', cuentaBancaria: '12073303572000000003', estado: 'Activo', fechaDesde: '2026-03-02', fechaHasta: '2026-12-31' } },
  { creada: '2026-04-14', estado: 'APROBADO', tipoAccion: 'creacion', justificacion: 'Autorización para registrar los saldos iniciales de la Cuenta Única del Tesoro.',
    datos: { procedimiento: 'saldos-iniciales', responsable: 'RU21619', cuentaBancaria: '00000281794000000005', estado: 'Activo', fechaDesde: '2026-04-14', fechaHasta: '2026-12-31' } },
  { creada: '2026-04-20', estado: 'APROBADO', tipoAccion: 'creacion', justificacion: 'Autorización para ajustar el saldo inicial de la Cuenta Única del Tesoro.',
    datos: { procedimiento: 'ajuste-saldo', responsable: 'RU21642', cuentaBancaria: '00000281794000000005', estado: 'Activo', fechaDesde: '2026-04-20', fechaHasta: '2026-09-30' } },
  { creada: '2026-06-29', estado: 'APROBADO', tipoAccion: 'modificacion', justificacion: 'Se amplía la vigencia hasta el cierre del ejercicio.',
    datos: { procedimiento: 'saldos-iniciales', responsable: 'RU21574', cuentaBancaria: '11040103570200000000', estado: 'Activo', fechaDesde: '2026-07-01', fechaHasta: '2026-12-31' } },
  { creada: '2026-08-18', estado: 'APROBADO', tipoAccion: 'modificacion', justificacion: 'Se desactiva la autorización: la cuenta pasó a otra unidad ejecutora.',
    datos: { procedimiento: 'ajuste-saldo', responsable: 'RU21642', cuentaBancaria: '00000281794000000005', estado: 'Inactivo', fechaDesde: null, fechaHasta: null } },
  { creada: '2026-09-22', estado: 'APROBADO', tipoAccion: 'creacion', justificacion: 'Autorización para registrar los saldos iniciales de la cuenta de recaudación del BCP.',
    datos: { procedimiento: 'saldos-iniciales', responsable: 'RU21657', cuentaBancaria: '19300456712000000002', estado: 'Activo', fechaDesde: '2026-09-22', fechaHasta: '2027-03-31' } },
  { creada: '2026-10-06', estado: 'ELABORADO', tipoAccion: 'modificacion', justificacion: 'Se acorta la vigencia del ajuste de saldo inicial.',
    datos: { procedimiento: 'ajuste-saldo', responsable: 'RU21603', cuentaBancaria: '12073303572000000003', estado: 'Activo', fechaDesde: '2026-10-06', fechaHasta: '2026-11-30' } },
  { creada: '2026-10-21', estado: 'ELABORADO', tipoAccion: 'creacion', justificacion: 'Autorización para registrar los saldos iniciales de la cuenta de garantías.',
    datos: { procedimiento: 'saldos-iniciales', responsable: 'RU21568', cuentaBancaria: '01100586230200000007', estado: 'Activo', fechaDesde: '2026-11-01', fechaHasta: '2026-12-31' } },
];

function crearAutorizaciones(datos: DatosTaller): void {
  const rosa = USUARIOS_DEMO.find((u) => u.id === 'usr-rosa') ?? USUARIOS_DEMO[0];
  for (const semilla of SEMILLAS_AUTORIZACION) {
    const id = nuevoId(datos, 'sol');
    const creada = enFecha(semilla.creada, 9);
    const historial: HistorialItem[] = [
      filaHistorial(datos, null, 'NUEVO', creada, rosa, ROL_CREADOR),
      filaHistorial(datos, 'NUEVO', semilla.estado, enFecha(semilla.creada, 10), rosa, ROL_CREADOR),
    ];
    const ultima = historial[historial.length - 1].createdAt;
    // La modificación apunta a la autorización registrada del mismo procedimiento y cuenta.
    const registro = semilla.tipoAccion === 'modificacion'
      ? datos.registrosAutorizacion.find((r) => r.procedimiento === semilla.datos.procedimiento && r.cuentaBancaria === semilla.datos.cuentaBancaria)
      : undefined;
    const solicitud: SolicitudResponse = {
      id,
      numero: numeroDocumento(datos, CODIGO_AUTORIZACION, new Date(creada)),
      catDocumento: TIPO_AUTORIZACION,
      tipoAccion: semilla.tipoAccion,
      estado: semilla.estado,
      asuntoMotivo: `[OFICINA GENERAL DE ADMINISTRACIÓN] ${semilla.justificacion}`,
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
}

// ─── Registro automático de saldos de apertura (RASA) ──────────────

/** El sistema: registra y procesa los documentos automáticos. */
const SISTEMA: UsuarioDemo = { ...USUARIOS_DEMO[0], id: 'sistema', nombres: 'SIAF RP', apellidoPaterno: '', apellidoMaterno: '' };
const ROL_SISTEMA = { codigo: 'SISTEMA', nombre: 'Sistema' };

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
