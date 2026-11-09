import { cuentaPorNumero, cuentasRegistroDe, redondear, type MonedaSaldo } from '../../saldos-iniciales/models/saldo-inicial.model';

/**
 * «Traslado de recursos entre cuentas de registros» (MFD 2.10.6.6, en construcción).
 *
 * Mueve saldo de una o varias Cuentas de Registro (libretas) a otras de la MISMA cuenta bancaria. El dinero no sale
 * del banco: cambia la cuenta interna en la que está registrado. Cada origen es un débito y cada destino un crédito;
 * el total de débitos debe ser igual al de créditos.
 *
 * Las cuentas bancarias y las libretas son las de Saldos iniciales; el saldo disponible de una libreta es lo que dejó
 * Saldos iniciales más lo que le movieron los traslados ya procesados.
 */

/** Código del documento en el catálogo de documentos. */
export const CODIGO_DOCUMENTO = 'RTCR';
export const NOMBRE_DOCUMENTO = 'Solicitud de Reporte de Traslado de Recursos entre Cuentas de Registro';
/** Prefijo del número: TR-DTCR-<correlativo>-<año>-<entidad>-<unidad>. */
export const PREFIJO_NUMERO = 'TR-DTCR';
/** Límite de cuentas de registro por documento (el MFD da 3 800 como ejemplo; valor por definir). */
export const LIMITE_CUENTAS = 3800;

export type Naturaleza = 'Débito' | 'Crédito';
export type Modalidad = '1 a 1' | '1 a N' | 'N a 1' | 'N a N';
export const MODALIDADES: Modalidad[] = ['1 a 1', '1 a N', 'N a 1', 'N a N'];
/** Cómo arma el creador el traslado: elige orígenes y les asigna destinos, o al revés. */
export type FormaSeleccion = 'origen' | 'destino';

/** Una línea del traslado: una cuenta de registro que da (débito) o recibe (crédito). */
export interface MovimientoTraslado {
  idCorrelativo: string;
  naturaleza: Naturaleza;
  importe: number;
}

/** Un par del traslado: cuánto pasa de una cuenta de origen a una de destino. */
export interface AsignacionTraslado {
  origen: string;
  destino: string;
  importe: number;
}

/** Lo que el creador registra en el documento. `movimientos` es el resumen por cuenta (lo que mueve el saldo). */
export interface TrasladoDatos {
  cuentaBancaria: string;
  movimientos: MovimientoTraslado[];
  /** Pares origen → destino con su importe (los documentos antiguos no los traen: ver `asignacionesDe`). */
  asignaciones?: AsignacionTraslado[];
  forma?: FormaSeleccion;
}

/** Una cuenta de registro de la cuenta bancaria con su saldo disponible. */
export interface LibretaSaldo {
  idCorrelativo: string;
  numero: string;
  descripcion: string;
  saldoDisponible: number;
}

/** Un traslado procesado: la pestaña Registros y la consulta. */
export interface TrasladoRegistro extends TrasladoDatos {
  id: string;
  /** Secuencia del registro (000001). */
  secuencia: string;
  estado: 'Activo' | 'Inactivo';
  moneda: MonedaSaldo;
  modalidad: Modalidad;
  total: number;
  entidadSiglas: string;
  documentoId: string;
  numeroDocumento: string;
  /** Fecha en que quedó procesado (ISO). */
  fechaRegistro: string;
}

/** Un error de la verificación: el panel muestra el campo, el valor, el motivo y la regla. */
export interface ErrorTraslado {
  campo: string;
  valor: string;
  motivo: string;
  regla: string;
}

export const sumar = (movimientos: MovimientoTraslado[], naturaleza: Naturaleza): number =>
  redondear(movimientos.filter((m) => m.naturaleza === naturaleza).reduce((total, m) => total + m.importe, 0));

/** 1 a 1, 1 a N, N a 1 o N a N según cuántos orígenes y destinos tenga; sin origen o sin destino, ninguna. */
export function modalidad(movimientos: MovimientoTraslado[]): Modalidad | null {
  const origenes = movimientos.filter((m) => m.naturaleza === 'Débito').length;
  const destinos = movimientos.filter((m) => m.naturaleza === 'Crédito').length;
  if (origenes === 0 || destinos === 0) return null;
  if (origenes === 1 && destinos === 1) return '1 a 1';
  if (origenes === 1) return '1 a N';
  if (destinos === 1) return 'N a 1';
  return 'N a N';
}

/** Resumen por cuenta de los pares: cada origen debita la suma de lo que da y cada destino acredita lo que recibe. */
export function movimientosDe(asignaciones: AsignacionTraslado[]): MovimientoTraslado[] {
  const total = new Map<string, MovimientoTraslado>();
  const sumarA = (id: string, naturaleza: Naturaleza, importe: number) => {
    const actual = total.get(`${naturaleza}|${id}`);
    total.set(`${naturaleza}|${id}`, { idCorrelativo: id, naturaleza, importe: redondear((actual?.importe ?? 0) + importe) });
  };
  for (const a of asignaciones) {
    sumarA(a.origen, 'Débito', a.importe);
    sumarA(a.destino, 'Crédito', a.importe);
  }
  return [...total.values()];
}

/**
 * Los pares del documento. Si no los trae (documentos sembrados con solo movimientos), se deducen cuando hay un único
 * origen o un único destino; con varios a varios no se pueden deducir y se devuelve vacío.
 */
export function asignacionesDe(d: TrasladoDatos | null | undefined): AsignacionTraslado[] {
  if (!d) return [];
  if (d.asignaciones?.length) return d.asignaciones;
  const origenes = d.movimientos.filter((m) => m.naturaleza === 'Débito');
  const destinos = d.movimientos.filter((m) => m.naturaleza === 'Crédito');
  if (origenes.length === 1) return destinos.map((m) => ({ origen: origenes[0].idCorrelativo, destino: m.idCorrelativo, importe: m.importe }));
  if (destinos.length === 1) return origenes.map((m) => ({ origen: m.idCorrelativo, destino: destinos[0].idCorrelativo, importe: m.importe }));
  return [];
}

const formato = (valor: number): string => valor.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Reglas que revisa el sistema al verificar (y de nuevo al aprobar, con el saldo de ese momento). Devuelve todos los
 * errores a la vez; sin errores, la lista está vacía.
 */
export function validarTraslado(d: TrasladoDatos | null | undefined, libretas: LibretaSaldo[]): ErrorTraslado[] {
  const errores: ErrorTraslado[] = [];
  if (!d || !cuentaPorNumero(d.cuentaBancaria)) {
    return [{ campo: 'Cuenta bancaria', valor: d?.cuentaBancaria || '--', motivo: 'Seleccione una cuenta bancaria vigente.', regla: 'La cuenta bancaria está activa, vigente y admite cuentas de registro.' }];
  }
  const propias = new Set(cuentasRegistroDe(d.cuentaBancaria).map((c) => c.idCorrelativo));
  const saldo = new Map(libretas.map((l) => [l.idCorrelativo, l.saldoDisponible]));

  for (const m of d.movimientos) {
    if (!propias.has(m.idCorrelativo)) {
      errores.push({ campo: `Cuenta de registro ${m.idCorrelativo}`, valor: m.idCorrelativo, motivo: 'No pertenece a la cuenta bancaria.', regla: 'Las cuentas de registro pertenecen a la cuenta bancaria del documento.' });
    }
    if (!(m.importe > 0)) {
      errores.push({ campo: `Importe de ${m.idCorrelativo}`, valor: formato(m.importe || 0), motivo: 'El importe debe ser mayor que cero.', regla: 'Los importes son mayores que cero.' });
    }
    if (m.naturaleza === 'Débito' && m.importe > (saldo.get(m.idCorrelativo) ?? 0)) {
      errores.push({
        campo: `Débito de ${m.idCorrelativo}`,
        valor: formato(m.importe),
        motivo: `Supera el saldo disponible (${formato(saldo.get(m.idCorrelativo) ?? 0)}).`,
        regla: 'El débito de cada origen no supera su saldo disponible.',
      });
    }
  }
  const debitos = sumar(d.movimientos, 'Débito');
  const creditos = sumar(d.movimientos, 'Crédito');
  if (debitos !== creditos) {
    errores.push({ campo: 'Totales', valor: `${formato(debitos)} / ${formato(creditos)}`, motivo: 'El total de débitos no es igual al de créditos.', regla: 'El total de débitos es igual al total de créditos.' });
  }
  if (!modalidad(d.movimientos)) {
    errores.push({ campo: 'Modalidad', valor: `${d.movimientos.filter((m) => m.naturaleza === 'Débito').length} origen(es), ${d.movimientos.filter((m) => m.naturaleza === 'Crédito').length} destino(s)`, motivo: 'Elija al menos una cuenta de origen y una de destino.', regla: 'El traslado tiene al menos un origen y un destino.' });
  }
  const debitan = new Set(d.movimientos.filter((m) => m.naturaleza === 'Débito').map((m) => m.idCorrelativo));
  for (const m of d.movimientos) {
    if (m.naturaleza === 'Crédito' && debitan.has(m.idCorrelativo)) {
      errores.push({ campo: `Cuenta de registro ${m.idCorrelativo}`, valor: m.idCorrelativo, motivo: 'Es origen y destino a la vez.', regla: 'Una cuenta de registro es origen o destino, no las dos.' });
    }
  }
  if (d.movimientos.length > LIMITE_CUENTAS) {
    errores.push({ campo: 'Cuentas de registro', valor: String(d.movimientos.length), motivo: `Supera el límite de ${LIMITE_CUENTAS} cuentas por documento.`, regla: 'No supera el límite de cuentas por documento.' });
  }
  return errores;
}
