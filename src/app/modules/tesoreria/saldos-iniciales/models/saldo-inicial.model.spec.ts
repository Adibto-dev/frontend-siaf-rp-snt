import { CUENTAS_BANCARIAS, calcularSaldo, cuentasRegistroDe, formatoImporte, tipoCambio } from './saldo-inicial.model';

describe('saldo-inicial.model', () => {
  it('el tipo de cambio de dólares cambia con la fecha dentro de 3.39 – 3.45 y en soles es 1', () => {
    const valores = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16'].map((f) => tipoCambio('USD', f));

    expect(valores.every((v) => v >= 3.39 && v <= 3.45)).toBeTrue();
    expect(new Set(valores).size).toBeGreaterThan(1);
    expect(tipoCambio('USD', '2026-07-13')).toBe(valores[0]);
    expect(tipoCambio('PEN', '2026-07-13')).toBe(1);
  });

  it('cada cuenta bancaria tiene entre 2 y 6 cuentas de registro vinculadas', () => {
    for (const cuenta of CUENTAS_BANCARIAS) {
      const cantidad = cuentasRegistroDe(cuenta.numero).length;
      expect(cantidad).toBeGreaterThanOrEqual(2);
      expect(cantidad).toBeLessThanOrEqual(6);
    }
  });

  it('el saldo suma las libretas, ignora las vacías y calcula el nacional', () => {
    const [primera, segunda, tercera] = cuentasRegistroDe('12073303572000000003');
    const saldo = calcularSaldo('s1', '2026-07-13', '12073303572000000003', {
      [primera.idCorrelativo]: 50000,
      [segunda.idCorrelativo]: 50000.005,
      [tercera?.idCorrelativo ?? 'x']: 0,
    });

    expect(saldo.libretas.length).toBe(2);
    expect(saldo.importeCuenta).toBe(100000.01);
    expect(saldo.importeNacional).toBe(Math.round(100000.01 * saldo.tipoCambio * 100) / 100);
    expect(formatoImporte(saldo.importeCuenta)).toBe('100,000.01');
  });
});
