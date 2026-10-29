import { cuentasRegistroDe } from '../models/saldo-inicial.model';
import { leerPlantillaSaldos, libroExcel } from './saldos-carga-masiva.util';

/** Arma un .xlsx con las dos filas de cabecera y las filas dadas (A fecha, B cuenta, E id corr., H importe). */
async function archivo(filas: unknown[][]): Promise<File> {
  const Workbook = await libroExcel();
  const libro = new Workbook();
  const hoja = libro.addWorksheet('Plantilla');
  hoja.addRow(['Fecha de operación', 'Cuenta bancaria']);
  hoja.addRow(['', 'Número']);
  for (const f of filas) hoja.addRow(f);
  const buffer = await libro.xlsx.writeBuffer();
  return new File([buffer], 'plantilla.xlsx');
}

describe('leerPlantillaSaldos', () => {
  const CUENTA = '12073303572000000003';
  const [l1, l2] = cuentasRegistroDe(CUENTA).map((l) => l.idCorrelativo);
  let id = 0;
  const nuevoId = () => `nuevo-${++id}`;
  const fila = (fecha: string, cuenta: string, idc: string, imp: unknown) => [fecha, cuenta, '', '', idc, '', '', imp];

  it('agrupa las libretas por cuenta y suma sus importes', async () => {
    const r = await leerPlantillaSaldos(await archivo([fila('13/07/2026', CUENTA, l1, 3000), fila('13/07/2026', CUENTA, l2, 2000)]), '0001', [], nuevoId);
    expect(r.errores).toEqual([]);
    expect(r.saldos.length).toBe(1);
    expect([r.saldos[0].fechaOperacion, r.saldos[0].importeCuenta]).toEqual(['2026-07-13', 5000]);
  });

  it('con algún error no carga nada y lista los errores con su fila', async () => {
    const r = await leerPlantillaSaldos(await archivo([
      fila('13/07/2026', CUENTA, l1, 3000),
      fila('', CUENTA, l2, 100),
      fila('13/07/2026', '99999999999999999999', l1, 10),
    ]), '0001', [], nuevoId);
    expect(r.saldos).toEqual([]);
    expect(r.errores).toEqual([
      'Fila 4: ingrese la fecha de operación (dd/mm/aaaa).',
      'Fila 5: la cuenta bancaria 99999999999999999999 no existe.',
    ]);
  });

  it('rechaza una cuenta que ya está en el documento o de otra entidad', async () => {
    const usada = await leerPlantillaSaldos(await archivo([fila('13/07/2026', CUENTA, l1, 10)]), '0001', [CUENTA], nuevoId);
    const otra = await leerPlantillaSaldos(await archivo([fila('13/07/2026', CUENTA, l1, 10)]), '0018', [], nuevoId);
    expect(usada.errores[0]).toContain('ya está en el documento');
    expect(otra.errores[0]).toContain('no pertenece a la entidad');
  });
});
