import { CUENTAS_BANCARIAS, CuentaBancaria, entidadPorCodigo } from '../../saldos-iniciales/models/saldo-inicial.model';

/**
 * Proceso «Documentos de autorización» (Figma 2.10.6.1.3, nodos 24416:105524, 24416:106177, 24415:135078 y
 * 24415:158502).
 *
 * Un documento RAUT («Registro de autorización excepcional») autoriza a UN responsable a ejecutar UN procedimiento
 * sobre UNA cuenta bancaria durante una vigencia (fecha desde / hasta). Solo lo crea un perfil con el permiso
 * `authorization.create` (creador autorizador): Grabar lo deja ELABORADO y Autorizar lo pasa directo a APROBADO.
 * - Creación: autorización nueva; al autorizarse pasa a Registros como Activo.
 * - Modificación (solo «Vigencia»): elige un registro Activo y trae sus datos y la justificación de la creación;
 *   solo cambia la vigencia: SÍ → nueva fecha hasta (la fecha desde es la de la creación); NO → Inactivo (conserva
 *   sus fechas).
 *
 * Responsables, procedimientos y cuentas son datos sintéticos del taller (las cuentas son las de saldos iniciales).
 */

export const CODIGO_DOCUMENTO = 'RAUT';
export const NOMBRE_DOCUMENTO = 'Registro de autorización excepcional';
/** Permiso que habilita crear y autorizar documentos RAUT. */
export const PERMISO_AUTORIZAR = 'authorization.create';
export const MAX_MOTIVO = 200;

export type TipoAccionAutorizacion = 'creacion' | 'modificacion';
export type EstadoAutorizacion = 'Activo' | 'Inactivo';

export interface Opcion {
  value: string;
  label: string;
}

export const TIPOS_MODIFICACION: Opcion[] = [{ value: 'vigencia', label: 'Vigencia' }];

/** Por ahora la autorización excepcional aplica a un solo procedimiento (el select viene preseleccionado). */
export const PROCEDIMIENTOS: Opcion[] = [
  { value: 'saldos-iniciales', label: 'Registro de saldos iniciales en libro bancos y libreta de cuentas de registro' },
];

export interface Responsable {
  usuario: string;
  tipoDocumento: 'DNI' | 'RUC';
  /** Número del documento (se mantiene el nombre del campo por compatibilidad). */
  dni: string;
  nombres: string;
  correo: string;
}

/** Responsables del Gestor de identidades (sintéticos, Figma 24415:156428). */
export const RESPONSABLES: Responsable[] = [
  { usuario: 'RU21568', tipoDocumento: 'DNI', dni: '71290045', nombres: 'RICARDO JOHN DOE BUSTAMANTE', correo: 'ricardo.doe@mef.gob.pe' },
  { usuario: 'RU15846', tipoDocumento: 'DNI', dni: '45827163', nombres: 'MARIA ELENA QUISPE TORRES', correo: 'mquispe@mef.gob.pe' },
  { usuario: 'RU22471', tipoDocumento: 'RUC', dni: '10483926751', nombres: 'CARLOS ALBERTO MENDOZA RÍOS', correo: 'cmendoza@mef.gob.pe' },
  { usuario: 'RU10538', tipoDocumento: 'DNI', dni: '71934528', nombres: 'ANA LUCÍA VARGAS PEÑA', correo: 'avargas@mef.gob.pe' },
  { usuario: 'RU38192', tipoDocumento: 'DNI', dni: '48261739', nombres: 'JORGE LUIS FERNÁNDEZ CASTRO', correo: 'jfernandez@mef.gob.pe' },
  { usuario: 'RU27654', tipoDocumento: 'RUC', dni: '10629384571', nombres: 'ROSA ISABEL HUAMÁN SALAZAR', correo: 'rhuaman@mef.gob.pe' },
  { usuario: 'RU41023', tipoDocumento: 'DNI', dni: '63718294', nombres: 'PEDRO MIGUEL ROJAS DÍAZ', correo: 'projas@mef.gob.pe' },
];

/** `DNI - 71290045`. */
export const documentoResponsable = (r: Responsable | undefined): string => (r ? `${r.tipoDocumento} - ${r.dni}` : '—');

/** Lo que el creador registra en el documento. */
export interface AutorizacionDatos {
  procedimiento: string;
  responsable: string;
  cuentaBancaria: string;
  /** Estado propuesto: en una creación siempre Activo; en una modificación puede pasar a Inactivo. */
  estado: EstadoAutorizacion;
  /** Vigencia: obligatorias si el estado es Activo (formato AAAA-MM-DD). */
  fechaDesde: string | null;
  fechaHasta: string | null;
  /** Solo en una modificación: la autorización registrada que se modifica y qué se modifica. */
  registroId?: string | null;
  tipoModificacion?: 'vigencia' | null;
}

/** Documento que creó o modificó una autorización (historial del registro). */
export interface DocumentoAutorizacion {
  documentoId: string;
  numero: string;
  tipoAccion: TipoAccionAutorizacion;
  fecha: string;
}

/** Una autorización aprobada: la pestaña Registros. */
export interface AutorizacionRegistro {
  id: string;
  procedimiento: string;
  responsable: string;
  cuentaBancaria: string;
  estado: EstadoAutorizacion;
  fechaDesde: string | null;
  fechaHasta: string | null;
  /** Justificación del documento de creación: la modificación la muestra en solo lectura. */
  motivo: string;
  entidadSiglas: string;
  /** Último documento aprobado sobre la autorización. */
  documentoId: string;
  numeroDocumento: string;
  fechaRegistro: string;
  /** Documentos de la autorización, del primero al último. */
  documentos: DocumentoAutorizacion[];
}

export const nombreProcedimiento = (valor: string): string => PROCEDIMIENTOS.find((p) => p.value === valor)?.label ?? valor;
export const responsablePorUsuario = (usuario: string | null | undefined): Responsable | undefined => RESPONSABLES.find((r) => r.usuario === usuario);
export const cuentaDeAutorizacion = (numero: string | null | undefined): CuentaBancaria | undefined => CUENTAS_BANCARIAS.find((c) => c.numero === numero);
export const nombreEntidadDeCuenta = (numero: string | null | undefined): string =>
  entidadPorCodigo(cuentaDeAutorizacion(numero)?.entidadCodigo)?.denominacion ?? '';
export const etiquetaTipoAccion = (valor: string | null | undefined): string => (valor === 'modificacion' ? 'Modificación' : 'Creación');

/** Opciones de cuenta bancaria para los selects: número, denominación y moneda. */
export const OPCIONES_CUENTA: Opcion[] = CUENTAS_BANCARIAS.map((c) => ({ value: c.numero, label: `${c.numero} · ${c.denominacion} (${c.moneda})` }));
export const OPCIONES_RESPONSABLE: Opcion[] = RESPONSABLES.map((r) => ({ value: r.usuario, label: `${r.usuario} · ${r.nombres}` }));

/**
 * Taller: el creador que recibe la notificación y puede ajustar el saldo inicial con una autorización vigente (Ana).
 * Los responsables de la autorización son usuarios sintéticos que no existen en el login.
 */
export const USUARIO_AJUSTE_SALDO = 'usr-ana';

/** Autorización vigente para ajustar el saldo inicial de una cuenta (una por cuenta, la de mayor fecha hasta). */
export interface AutorizacionVigente {
  registroId: string;
  cuentaBancaria: string;
  fechaDesde: string;
  fechaHasta: string;
  /** Documento de ajuste sin aprobar de esa cuenta: mientras exista, no se crea otro. */
  documentoEnCurso?: string | null;
}

/** Activa y con hoy dentro de su vigencia (fechas AAAA-MM-DD). */
export function estaVigente(r: Pick<AutorizacionRegistro, 'estado' | 'fechaDesde' | 'fechaHasta'>, hoy: string): boolean {
  return r.estado === 'Activo' && !!r.fechaDesde && !!r.fechaHasta && r.fechaDesde <= hoy && hoy <= r.fechaHasta;
}

/** Texto de la alerta y de la notificación. */
export const mensajeAutorizacionVigente = (cuenta: string, hasta: string | null): string =>
  `Tiene una autorización vigente para realizar ajustes al saldo inicial de la cuenta bancaria ${cuenta} hasta el ${fechaCorta(hasta)}.`;

/** `2026-03-01` → `01/03/2026`; vacío → `—`. */
export const fechaCorta = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${a}`;
};

/** Valida la vigencia: ambas fechas y hasta ≥ desde. Devuelve el mensaje de error o null. */
export function errorVigencia(desde: string | null | undefined, hasta: string | null | undefined): string | null {
  if (!desde || !hasta) return 'Ingrese la fecha desde y la fecha hasta.';
  if (hasta < desde) return 'La fecha hasta no puede ser anterior a la fecha desde.';
  if (hasta > sumarDias(desde, MAX_DIAS_VIGENCIA)) return `La vigencia no puede superar ${MAX_DIAS_VIGENCIA} días.`;
  return null;
}

/** Plazos cortos: la autorización dura hasta 3 días y una modificación la amplía hasta 2 días más. */
export const MAX_DIAS_VIGENCIA = 3;
export const MAX_DIAS_AMPLIACION = 2;

/** `2026-03-01` + 2 → `2026-03-03`. */
export function sumarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Modificación con vigencia SÍ: nueva fecha hasta, distinta y como máximo 2 días después de la registrada. */
export function errorAmpliacion(registrada: string | null | undefined, hasta: string | null | undefined): string | null {
  if (!hasta) return 'Ingrese la fecha hasta.';
  if (!registrada) return null;
  if (hasta === registrada) return 'Ingrese una fecha hasta distinta a la registrada.';
  if (hasta > sumarDias(registrada, MAX_DIAS_AMPLIACION)) return `La ampliación no puede superar ${MAX_DIAS_AMPLIACION} días desde la fecha hasta registrada.`;
  return null;
}
