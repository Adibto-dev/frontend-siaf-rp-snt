/**
 * Glosario de abreviaturas de las cabeceras de tabla. En pantalla la columna muestra la abreviatura y el tooltip el
 * término completo; en un Excel exportado va el término completo (no hay tooltip).
 *
 * Un término nuevo se agrega aquí y las tablas lo toman de este glosario: nunca escribir la abreviatura a mano.
 */
export interface Abreviatura {
  /** Texto de la cabecera en la tabla. */
  readonly abreviatura: string;
  /** Término completo: tooltip en pantalla y cabecera del Excel. */
  readonly termino: string;
}

export const ABREVIATURAS = {
  secuencia: { abreviatura: 'Sec.', termino: 'Secuencia' },
  fechaOperacion: { abreviatura: 'F. Operación', termino: 'Fecha de operación' },
  importeCuenta: { abreviatura: 'Imp. M. Cuenta', termino: 'Importe en moneda de la cuenta' },
  importeNacional: { abreviatura: 'Imp. M. Nacional', termino: 'Importe en moneda nacional' },
  idCorrelativo: { abreviatura: 'ID Corr.', termino: 'ID correlativo' },
  saldoActualizado: { abreviatura: 'Saldo act.', termino: 'Saldo actualizado' },
  /** Subcolumnas del grupo «Saldo» (ajuste de saldo inicial): Inicial y Act. */
  saldoInicial: { abreviatura: 'Inicial', termino: 'Saldo inicial' },
  saldoActualizadoEnGrupo: { abreviatura: 'Act.', termino: 'Saldo actualizado' },
  /** Traslado entre cuentas de registros. */
  saldoCuenta: { abreviatura: 'Saldo m. cuenta', termino: 'Saldo en moneda de la cuenta' },
  importeDebitar: { abreviatura: 'Imp. a debitar', termino: 'Importe a debitar' },
  importeAcreditar: { abreviatura: 'Imp. a acreditar', termino: 'Importe a acreditar' },
} as const satisfies Record<string, Abreviatura>;

export type TerminoAbreviado = keyof typeof ABREVIATURAS;
