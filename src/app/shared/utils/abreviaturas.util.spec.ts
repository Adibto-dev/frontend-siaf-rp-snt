import { ABREVIATURAS } from './abreviaturas.util';

describe('ABREVIATURAS (glosario de cabeceras de tabla)', () => {
  it('tiene las abreviaturas acordadas con su término completo', () => {
    expect(ABREVIATURAS.secuencia).toEqual({ abreviatura: 'Sec.', termino: 'Secuencia' });
    expect(ABREVIATURAS.fechaOperacion).toEqual({ abreviatura: 'F. Operación', termino: 'Fecha de operación' });
    expect(ABREVIATURAS.importeCuenta).toEqual({ abreviatura: 'Imp. M. Cuenta', termino: 'Importe en moneda de la cuenta' });
    expect(ABREVIATURAS.importeNacional).toEqual({ abreviatura: 'Imp. M. Nacional', termino: 'Importe en moneda nacional' });
    expect(ABREVIATURAS.idCorrelativo).toEqual({ abreviatura: 'ID Corr.', termino: 'ID correlativo' });
  });
});
