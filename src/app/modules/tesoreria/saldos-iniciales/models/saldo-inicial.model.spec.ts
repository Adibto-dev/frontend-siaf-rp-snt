import { CUENTAS_BANCARIAS, CUENTAS_REGISTRO, calcularSaldo, cuentasRegistroDe, esCuentaDeDemostracion, formatoImporte, tipoCambio } from './saldo-inicial.model';

describe('saldo-inicial.model', () => {
  it('el tipo de cambio de dólares cambia con la fecha dentro de 3.39 – 3.45 y en soles es 1', () => {
    const valores = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16'].map((f) => tipoCambio('USD', f));

    expect(valores.every((v) => v >= 3.39 && v <= 3.45)).toBeTrue();
    expect(new Set(valores).size).toBeGreaterThan(1);
    expect(tipoCambio('USD', '2026-07-13')).toBe(valores[0]);
    expect(tipoCambio('PEN', '2026-07-13')).toBe(1);
  });

  it('cada cuenta bancaria tiene entre 2 y 6 cuentas de registro vinculadas, sin contar las de demostración', () => {
    for (const cuenta of CUENTAS_BANCARIAS) {
      const cantidad = cuentasRegistroDe(cuenta.numero).filter((c) => !esCuentaDeDemostracion(c.idCorrelativo)).length;
      expect(cantidad).toBeGreaterThanOrEqual(2);
      expect(cantidad).toBeLessThanOrEqual(6);
    }
  });

  it('la Cuenta Única del Tesoro suma 30 cuentas de demostración con IDs propios', () => {
    const demo = cuentasRegistroDe('00000281794000000005').filter((c) => esCuentaDeDemostracion(c.idCorrelativo));
    expect(demo.length).toBe(30);
    expect(demo.map((c) => c.idCorrelativo).sort()[0]).toBe('0000000100');
    expect(new Set(CUENTAS_REGISTRO.map((c) => c.idCorrelativo)).size).toBe(CUENTAS_REGISTRO.length);
  });

  it('cada cuenta de registro tiene un número propio, con sus segmentos y el secuencial correlativo', () => {
    expect(new Set(CUENTAS_REGISTRO.map((c) => c.numero)).size).toBe(CUENTAS_REGISTRO.length);
    // ámbito (5) · entidad (4) · UE (3) · fuente.subfuente (1.2) · acreedor (3) · convenio (6) · secuencial (2)
    CUENTAS_REGISTRO.forEach((c) => expect(c.numero).toMatch(/^\d{5} \d{4} \d{3} \d\.\d{2} \d{3} \d{6} \d{2}$/));
    const porPrefijo = new Map<string, string[]>();
    for (const c of CUENTAS_REGISTRO) {
      const prefijo = c.numero.slice(0, -3);
      porPrefijo.set(prefijo, [...(porPrefijo.get(prefijo) ?? []), c.numero.slice(-2)]);
    }
    porPrefijo.forEach((secuencias) => expect([...secuencias].sort()).toEqual(secuencias.map((_, k) => String(k + 1).padStart(2, '0'))));
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
