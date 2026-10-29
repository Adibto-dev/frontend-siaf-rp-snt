/**
 * Proceso «Registro de saldos iniciales en libro bancos y libretas de cuentas de registro» (Figma 2.10.6.1.3).
 *
 * Un documento RSIN elige UNA entidad financiera y registra uno o varios saldos iniciales en libro bancos: cada saldo
 * es una cuenta bancaria de esa entidad con los importes de sus cuentas de registro (libretas). El importe en moneda
 * de la cuenta es la suma de las libretas; el nacional, esa suma por el tipo de cambio de la fecha de operación.
 * Al aprobarse, cada saldo recibe su secuencia y pasa a los registros.
 *
 * Los catálogos (entidades, cuentas bancarias, cuentas de registro y tipo de cambio) son datos sintéticos del taller.
 */

export type MonedaSaldo = 'PEN' | 'USD';

/** Código del documento en el catálogo de documentos. */
export const CODIGO_DOCUMENTO = 'RSIN';
export const NOMBRE_DOCUMENTO = 'Registro de saldos iniciales';

/** Movimiento de cada registro según su origen: RSIN, registro automático (RASA) o ajuste. */
export const MOVIMIENTO_SALDO_INICIAL = 'SI0001 - Saldo Inicial';
export const MOVIMIENTO_APERTURA = 'SIA001 - Saldo de Apertura';

/** Datos fijos de la cabecera y de «Tipo de operación del saldo». */
export const ENTE_RECTOR = 'Dirección General del Tesoro Público';
export const TIPO_OPERACION = '1 - Saldos iniciales';
export const PERIODO = '2026';
export const TIPO_COTIZACION = '01 - Compra / Venta';

export const MOVIMIENTO_INTERNO = { codigo: 'SI0001', denominacion: 'SALDO INICIAL', naturaleza: 'Crédito', sigla: 'SI' };

/** Documento automático: lo crea y procesa el sistema (estados Registrado y Procesado), sin intervención de usuarios. */
export const CODIGO_AUTOMATICO = 'RASA';
export const NOMBRE_AUTOMATICO = 'Registro automático de saldos de apertura';
export const TIPO_OPERACION_APERTURA = '3 - Saldo de apertura';
export const MOVIMIENTO_INTERNO_APERTURA = { codigo: 'SIA001', denominacion: 'SALDO DE APERTURA', naturaleza: 'Crédito', sigla: 'SIA' };

/**
 * Ajuste de saldo inicial: un RSIN con tipo de operación 2. Se autoriza en otro módulo (el flujo llega después) y
 * ajusta UNA cuenta bancaria ya registrada: suma (Crédito) o resta (Débito) al saldo de referencia.
 */
export const TIPO_OPERACION_AJUSTE = '2 - Ajuste de saldo inicial';
export const MOVIMIENTO_INTERNO_AJUSTE = { codigo: 'ASC002', denominacion: 'AJUSTE DEL SALDO INICIAL', naturaleza: 'Crédito / Débito', sigla: 'ASC' };
export const MOVIMIENTO_AJUSTE = 'ASC002 - Ajuste del Saldo Inicial';

export type NaturalezaAjuste = 'Crédito' | 'Débito';

/** Datos del ajuste dentro de un saldo: el registro que ajusta y su saldo antes del ajuste. */
export interface AjusteSaldo {
  naturaleza: NaturalezaAjuste;
  /** Secuencia del saldo inicial que se ajusta. */
  secuenciaReferencia: string;
  /** Importe en moneda de la cuenta del saldo de referencia. */
  saldoInicial: number;
  /** Importes de las libretas del saldo de referencia. */
  libretasIniciales: ImporteLibreta[];
}

/** Saldo después del ajuste: el crédito suma y el débito resta. */
export function saldoActualizado(inicial: number, importe: number, naturaleza: NaturalezaAjuste): number {
  return redondear(naturaleza === 'Crédito' ? inicial + importe : inicial - importe);
}

export interface EntidadFinanciera {
  codigo: string;
  tipo: string;
  denominacion: string;
  sigla: string;
}

export interface CuentaBancaria {
  numero: string;
  denominacion: string;
  moneda: MonedaSaldo;
  entidadCodigo: string;
}

export interface CuentaRegistro {
  idCorrelativo: string;
  numero: string;
  descripcion: string;
  cuentaBancaria: string;
}

export const ENTIDADES_FINANCIERAS: EntidadFinanciera[] = [
  { codigo: '0001', tipo: 'BANCO', denominacion: 'Banco Central de Reserva del Perú', sigla: 'BCRP' },
  { codigo: '0018', tipo: 'BANCO', denominacion: 'Banco de la Nación', sigla: 'BN' },
  { codigo: '0002', tipo: 'BANCO', denominacion: 'Banco de Crédito del Perú', sigla: 'BCP' },
  { codigo: '0011', tipo: 'BANCO', denominacion: 'BBVA Perú', sigla: 'BBVA' },
  { codigo: '0101', tipo: 'CAJA MUNICIPAL', denominacion: 'Caja Municipal de Ahorro y Crédito de Arequipa', sigla: 'CMAC AQP' },
];

export const CUENTAS_BANCARIAS: CuentaBancaria[] = [
  { numero: '12073303572000000003', denominacion: 'MEF - DGTP', moneda: 'USD', entidadCodigo: '0001' },
  { numero: '11040103570200000000', denominacion: 'MEF - DGTP Recursos Ordinarios', moneda: 'PEN', entidadCodigo: '0001' },
  { numero: '12073303572000000011', denominacion: 'MEF - DGTP Endeudamiento externo', moneda: 'USD', entidadCodigo: '0001' },
  { numero: '00000281794000000005', denominacion: 'MEF - Cuenta Única del Tesoro', moneda: 'PEN', entidadCodigo: '0018' },
  { numero: '00000281794000000013', denominacion: 'MEF - Fondos en dólares', moneda: 'USD', entidadCodigo: '0018' },
  { numero: '19300456712000000002', denominacion: 'MEF - Recaudación', moneda: 'PEN', entidadCodigo: '0002' },
  { numero: '01100586230200000007', denominacion: 'MEF - Garantías', moneda: 'USD', entidadCodigo: '0011' },
  { numero: '21500789014000000001', denominacion: 'MEF - Encargos regionales', moneda: 'PEN', entidadCodigo: '0101' },
];

const DESCRIPCION_MONEDA: Record<MonedaSaldo, string> = { PEN: 'Soles', USD: 'Dólares' };

/** Cuentas de registro (libretas) vinculadas: entre 2 y 6 por cuenta bancaria, derivadas de su número. */
export const CUENTAS_REGISTRO: CuentaRegistro[] = CUENTAS_BANCARIAS.flatMap((cuenta, i) => {
  const cantidad = 2 + ((i * 3) % 5);
  return Array.from({ length: cantidad }, (_, j) => ({
    idCorrelativo: String(i * 10 + j + 2).padStart(6, '0'),
    numero: `11111000${9000 + i} 1.00 000000 0000${String(99 - j).padStart(2, '0')}`,
    descripcion: `Cuenta Fondo Tesoro Público ${DESCRIPCION_MONEDA[cuenta.moneda]} ${j + 1}`,
    cuentaBancaria: cuenta.numero,
  }));
});

export function entidadPorCodigo(codigo: string | null | undefined): EntidadFinanciera | undefined {
  return ENTIDADES_FINANCIERAS.find((e) => e.codigo === codigo);
}

export function cuentaPorNumero(numero: string | null | undefined): CuentaBancaria | undefined {
  return CUENTAS_BANCARIAS.find((c) => c.numero === numero);
}

export function cuentasRegistroDe(numeroCuenta: string): CuentaRegistro[] {
  return CUENTAS_REGISTRO.filter((c) => c.cuentaBancaria === numeroCuenta);
}

/** Cotizaciones de compra del mercado simulado: el tipo de cambio se mueve dentro de este rango según la fecha. */
const COTIZACIONES = [3.41, 3.39, 3.45, 3.42, 3.4, 3.44, 3.43];

/**
 * Tipo de cambio de compra para una fecha (yyyy-mm-dd): 1 para soles; para dólares, un valor entre 3.39 y 3.45 que
 * cambia con la fecha y es siempre el mismo para el mismo día.
 */
export function tipoCambio(moneda: MonedaSaldo, fecha: string): number {
  if (moneda === 'PEN' || !fecha) return 1;
  const dia = Math.floor(new Date(`${fecha}T00:00:00Z`).getTime() / 86_400_000);
  return COTIZACIONES[((dia % COTIZACIONES.length) + COTIZACIONES.length) % COTIZACIONES.length];
}

/** Redondeo a céntimos (evita 0.1 + 0.2). */
export const redondear = (valor: number): number => Math.round(valor * 100) / 100;

/** 100000 → «100,000.00». */
export function formatoImporte(valor: number | null | undefined): string {
  return (valor ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** yyyy-mm-dd → dd/mm/aaaa. */
export const formatoFecha = (iso: string): string => (iso ? iso.split('-').reverse().join('/') : '');

/** Importe de una libreta dentro de un saldo. */
export interface ImporteLibreta {
  idCorrelativo: string;
  importe: number;
  /** Solo en un ajuste: cada libreta suma (crédito) o resta (débito). */
  naturaleza?: NaturalezaAjuste;
}

/** Un saldo inicial en libro bancos: una cuenta bancaria con los importes de sus libretas. */
export interface SaldoInicial {
  /** Id local del saldo dentro del documento. */
  id: string;
  fechaOperacion: string;
  cuentaBancaria: string;
  moneda: MonedaSaldo;
  tipoCambio: number;
  libretas: ImporteLibreta[];
  importeCuenta: number;
  importeNacional: number;
  /** La asigna el sistema al aprobar el documento. */
  secuencia?: string | null;
  /** Nombre del documento de sustento del saldo (opcional; el taller guarda solo el nombre). */
  sustento?: string | null;
  /** Solo en un ajuste de saldo inicial (tipo de operación 2). */
  ajuste?: AjusteSaldo;
}

/** Lo que el creador registra en el documento. */
export interface SaldosInicialesDatos {
  entidadFinanciera: string;
  saldos: SaldoInicial[];
}

/** El saldo registrado que se ajusta. */
export interface SaldoReferencia {
  secuencia?: string | null;
  importeCuenta: number;
  libretas: ImporteLibreta[];
}

/** Importe y naturaleza escritos en una libreta del ajuste. */
export interface MovimientoAjuste {
  importe: number;
  naturaleza: NaturalezaAjuste;
}

/** Libreta con su importe firmado: el débito resta. */
export const importeFirmado = (l: { importe: number; naturaleza?: NaturalezaAjuste }): number => (l.naturaleza === 'Débito' ? -l.importe : l.importe);

/**
 * Arma un ajuste de saldo inicial: cada libreta tiene su naturaleza; el ajuste guarda el resultado neto (importe
 * positivo y naturaleza Crédito si suma, Débito si resta).
 */
export function calcularAjuste(id: string, fechaOperacion: string, numeroCuenta: string, movimientos: Record<string, MovimientoAjuste>, referencia: SaldoReferencia): SaldoInicial {
  const moneda = cuentaPorNumero(numeroCuenta)?.moneda ?? 'PEN';
  const cambio = tipoCambio(moneda, fechaOperacion);
  const libretas: ImporteLibreta[] = cuentasRegistroDe(numeroCuenta)
    .map((c) => ({ idCorrelativo: c.idCorrelativo, importe: redondear(movimientos[c.idCorrelativo]?.importe ?? 0), naturaleza: movimientos[c.idCorrelativo]?.naturaleza ?? 'Crédito' }))
    .filter((l) => l.importe > 0);
  const neto = redondear(libretas.reduce((total, l) => total + importeFirmado(l), 0));
  const importeCuenta = Math.abs(neto);
  return {
    id,
    fechaOperacion,
    cuentaBancaria: numeroCuenta,
    moneda,
    tipoCambio: cambio,
    libretas,
    importeCuenta,
    importeNacional: redondear(importeCuenta * cambio),
    ajuste: {
      naturaleza: neto < 0 ? 'Débito' : 'Crédito',
      secuenciaReferencia: referencia.secuencia ?? '',
      saldoInicial: redondear(referencia.importeCuenta),
      libretasIniciales: referencia.libretas.map((l) => ({ idCorrelativo: l.idCorrelativo, importe: l.importe })),
    },
  };
}

/** Un saldo aprobado: la pestaña Registros. */
export interface SaldoInicialRegistro extends SaldoInicial {
  registroId: string;
  estado: 'Activo' | 'Inactivo';
  /** Código y nombre del movimiento en libro bancos (p. ej. «SIA001 - Saldo de Apertura»). */
  movimiento: string;
  entidadFinanciera: string;
  entidadSiglas: string;
  documentoId: string;
  numeroDocumento: string;
  fechaRegistro: string;
  /** Viene de un registro automático de saldos de apertura (RASA). */
  automatico?: boolean;
}

/** Arma un saldo a partir de lo ingresado: suma las libretas y calcula el nacional con el tipo de cambio. */
export function calcularSaldo(id: string, fechaOperacion: string, numeroCuenta: string, importes: Record<string, number>): SaldoInicial {
  const cuenta = cuentaPorNumero(numeroCuenta);
  const moneda = cuenta?.moneda ?? 'PEN';
  const cambio = tipoCambio(moneda, fechaOperacion);
  const libretas = cuentasRegistroDe(numeroCuenta)
    .map((c) => ({ idCorrelativo: c.idCorrelativo, importe: redondear(importes[c.idCorrelativo] ?? 0) }))
    .filter((l) => l.importe > 0);
  const importeCuenta = redondear(libretas.reduce((total, l) => total + l.importe, 0));
  return {
    id,
    fechaOperacion,
    cuentaBancaria: numeroCuenta,
    moneda,
    tipoCambio: cambio,
    libretas,
    importeCuenta,
    importeNacional: redondear(importeCuenta * cambio),
  };
}
