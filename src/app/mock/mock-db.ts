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
  CODIGO_DOCUMENTO as CODIGO_SALDOS,
  NOMBRE_DOCUMENTO as NOMBRE_SALDOS,
  SaldoInicial,
  SaldoInicialRegistro,
  calcularSaldo,
  cuentasRegistroDe,
} from '../modules/tesoreria/saldos-iniciales/models/saldo-inicial.model';
import { USUARIOS_DEMO, UsuarioDemo } from './usuarios-demo';

/**
 * «Base de datos» del backend simulado: vive en el `localStorage` del navegador, así lo que hace un usuario lo ve
 * otro al iniciar sesión (en el mismo navegador). `reiniciarDatosDemo()` vuelve a los datos iniciales.
 */

const CLAVE = 'taller-siaf-rp:datos';
const VERSION = 4;

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
export const TIPOS_DOCUMENTO = [TIPO_DOCUMENTO, TIPO_SALDOS];
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

/** Al aprobar un RSIN: cada saldo recibe su secuencia y pasa a los registros. */
export function registrarSaldos(datos: DatosTaller, s: SolicitudResponse, fecha: string): void {
  const detalle = s.detalleSaldosIniciales;
  if (!detalle || datos.registrosSaldos.some((r) => r.documentoId === s.id)) return;
  for (const saldo of detalle.saldos) {
    datos.secuenciaSaldo += 1;
    saldo.secuencia = String(datos.secuenciaSaldo).padStart(6, '0');
    datos.registrosSaldos.push({
      ...saldo,
      registroId: nuevoId(datos, 'si'),
      estado: 'Activo',
      entidadFinanciera: detalle.entidadFinanciera,
      entidadSiglas: s.entidadCreadora?.siglas ?? '',
      documentoId: s.id,
      numeroDocumento: s.numero ?? '',
      fechaRegistro: fecha,
    });
  }
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
