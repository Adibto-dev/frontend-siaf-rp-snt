import { CUENTAS_BANCARIAS, CuentaBancaria, entidadPorCodigo } from '../../saldos-iniciales/models/saldo-inicial.model';

/**
 * Proceso «Documentos de autorización» (Figma 2.10.6.1.3, nodos 24416:105524, 24416:106177, 24415:135078 y
 * 24415:158502).
 *
 * Un documento RAUT («Registro de autorización excepcional») autoriza a UN responsable a ejecutar UN procedimiento
 * sobre UNA cuenta bancaria durante una vigencia (fecha desde / hasta). Solo lo crea un perfil con el permiso
 * `authorization.create` (creador autorizador): Grabar lo deja ELABORADO y Autorizar lo pasa directo a APROBADO.
 * - Creación: autorización nueva; al autorizarse pasa a Registros como Activo.
 * - Modificación (solo «Vigencia»): elige un registro; vigente SÍ → Activo con fechas nuevas; NO → Inactivo.
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

export const PROCEDIMIENTOS: Opcion[] = [
  { value: 'saldos-iniciales', label: 'Registro de saldos iniciales en libro bancos y libreta de cuentas de registro' },
  { value: 'ajuste-saldo', label: 'Ajuste de saldo inicial en libro bancos y libretas de cuentas de registro' },
];

export interface Responsable {
  usuario: string;
  dni: string;
  nombres: string;
}

/** Responsables sintéticos: usuario del sistema, N° de documento y nombres. */
export const RESPONSABLES: Responsable[] = [
  { usuario: 'RU21568', dni: '47129045', nombres: 'RICARDO JOHN DOE BUSTAMANTE' },
  { usuario: 'RU21574', dni: '45321786', nombres: 'JUAN ALBERTO MENDOZA CASTRO' },
  { usuario: 'RU21603', dni: '40532178', nombres: 'MARIA ELENA CASTRO RODRIGUEZ' },
  { usuario: 'RU21619', dni: '48916234', nombres: 'CARLOS ANDRES LOPEZ MENDOZA' },
  { usuario: 'RU21642', dni: '43278451', nombres: 'ANA LUCIA FERNANDEZ PAREDES' },
  { usuario: 'RU21657', dni: '46081932', nombres: 'JORGE LUIS QUISPE HUAMAN' },
];

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
  return null;
}
