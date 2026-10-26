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

/** Datos fijos de la cabecera y de «Tipo de operación del saldo». */
export const ENTE_RECTOR = 'Dirección General del Tesoro Público';
export const TIPO_OPERACION = '1 - Saldos iniciales';
export const PERIODO = '2026';
export const TIPO_COTIZACION = '01 - Compra / Venta';

export const MOVIMIENTO_INTERNO = { codigo: 'SI0001', denominacion: 'SALDO INICIAL', naturaleza: 'Crédito', sigla: 'SI' };

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
}

/** Lo que el creador registra en el documento. */
export interface SaldosInicialesDatos {
  entidadFinanciera: string;
  saldos: SaldoInicial[];
}

/** Un saldo aprobado: la pestaña Registros. */
export interface SaldoInicialRegistro extends SaldoInicial {
  registroId: string;
  estado: 'Activo' | 'Inactivo';
  entidadFinanciera: string;
  entidadSiglas: string;
  documentoId: string;
  numeroDocumento: string;
  fechaRegistro: string;
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
