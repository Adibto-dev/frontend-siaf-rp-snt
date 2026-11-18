import { redondear, type MonedaSaldo } from '../../saldos-iniciales/models/saldo-inicial.model';
import {
  AsignacionTraslado,
  ErrorTraslado,
  LibretaSaldo,
  MovimientoTraslado,
  validarTraslado,
} from '../../traspasos-cuentas-registros/models/traslado.model';

/**
 * «Asignación financiera» (Figma 2.10.6.6, Traspasos entre cuentas de registros).
 *
 * Reparte el saldo de UNA cuenta de registro de origen (débito) entre varias de destino (crédito) de la misma cuenta
 * bancaria, para una periodicidad y un mes de asignación. Usa las cuentas bancarias y las libretas
 * de Saldos iniciales; al aprobarse mueve su saldo igual que un traslado.
 */

/** Código del documento en el catálogo de documentos. */
export const CODIGO_DOCUMENTO = 'RAFI';
export const NOMBRE_DOCUMENTO = 'Solicitud de Asignación Financiera';
/** Prefijo del número: AF-DAF-<correlativo>-<año>-<entidad>-<unidad>. */
export const PREFIJO_NUMERO = 'AF-DAF';

export type TipoPeriodicidad = 'mensual' | 'semestral' | 'anual';

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
] as const;

export const NOMBRE_PERIODICIDAD: Record<TipoPeriodicidad, string> = { mensual: 'Mensual', semestral: 'Semestral', anual: 'Anual' };

/** Periodicidad, año y mes de asignación (Figma 814:27120). */
export interface Periodicidad {
  tipo: TipoPeriodicidad;
  anio: number;
  /** Mes de asignación (1-12). */
  mesAsignacion?: number;
}

/** Texto corto del periodo: «Mensual · 2026 · Noviembre». */
export function textoPeriodo(p: Periodicidad | null | undefined): string {
  if (!p) return '--';
  return `${NOMBRE_PERIODICIDAD[p.tipo]} · ${p.anio} · ${p.mesAsignacion ? MESES[p.mesAsignacion - 1] : '--'}`;
}

/** Lo que el creador registra en el documento. */
export interface AsignacionDatos {
  cuentaBancaria: string;
  periodicidad: Periodicidad | null;
  /** Resumen por cuenta: un débito (el origen) y un crédito por destino. */
  movimientos: MovimientoTraslado[];
  /** Pares origen → destino con su importe. */
  asignaciones: AsignacionTraslado[];
}

/** Una asignación aprobada: la pestaña Registros. */
export interface AsignacionRegistro {
  id: string;
  secuencia: string;
  estado: 'Activo' | 'Inactivo';
  cuentaBancaria: string;
  periodicidad: Periodicidad | null;
  movimientos: MovimientoTraslado[];
  moneda: MonedaSaldo;
  total: number;
  entidadSiglas: string;
  documentoId: string;
  numeroDocumento: string;
  fechaRegistro: string;
}

/** Un par por destino, todos desde el mismo origen. */
export function movimientosAsignacion(origen: string, asignaciones: AsignacionTraslado[]): MovimientoTraslado[] {
  const con = asignaciones.filter((a) => a.importe > 0);
  if (!origen || !con.length) return [];
  return [
    { idCorrelativo: origen, naturaleza: 'Débito', importe: redondear(con.reduce((t, a) => t + a.importe, 0)) },
    ...con.map((a): MovimientoTraslado => ({ idCorrelativo: a.destino, naturaleza: 'Crédito', importe: a.importe })),
  ];
}

/**
 * Reglas al verificar (y de nuevo al aprobar): las del traslado (cuenta, saldo, totales, origen ≠ destino) más una
 * sola cuenta de origen y la periodicidad completa (tipo, año y mes de asignación).
 */
export function validarAsignacion(d: AsignacionDatos | null | undefined, libretas: LibretaSaldo[]): ErrorTraslado[] {
  const errores = validarTraslado(d, libretas).map((e) =>
    e.campo === 'Modalidad'
      ? { ...e, motivo: 'Elija la cuenta de origen y al menos una de destino.', regla: 'La asignación tiene un origen y al menos un destino.' }
      : e,
  );
  if (!d) return errores;
  const origenes = d.movimientos.filter((m) => m.naturaleza === 'Débito').length;
  if (origenes > 1) {
    errores.push({ campo: 'Cuenta de origen', valor: String(origenes), motivo: 'Solo se admite una cuenta de origen.', regla: 'La asignación tiene una sola cuenta de origen.' });
  }
  const p = d.periodicidad;
  const completo = !!p && !!p.anio && !!p.mesAsignacion;
  if (!completo) {
    errores.push({ campo: 'Periodicidad', valor: textoPeriodo(p), motivo: 'Complete la periodicidad, el año y el mes de asignación.', regla: 'La asignación indica su periodicidad, año y mes de asignación.' });
  }
  return errores;
}
