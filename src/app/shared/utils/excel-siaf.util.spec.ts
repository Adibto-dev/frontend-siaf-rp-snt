import { EXCEL_COLORES, crearLibro, escribirTabla, fechaHoraCreacion, nombreArchivo } from './excel-siaf.util';

describe('excel-siaf.util', () => {
  it('escribe la tabla con la cabecera de un solo color y el cuerpo sin relleno', async () => {
    const libro = await crearLibro();
    const hoja = libro.addWorksheet('Resultado');
    const ultima = escribirTabla(
      hoja,
      [
        { titulo: 'Documento', clave: 'document' },
        { titulo: 'Número', clave: 'number' },
        { titulo: 'Estado', clave: 'status' },
      ],
      [
        { document: 'Registro de saldos iniciales', number: '1234000055-2026', status: 'Aprobado' },
        { document: 'Registro de saldos iniciales', number: '1234000054-2026', status: 'Elaborado' },
      ],
    );

    expect(ultima).toBe(3);
    expect(hoja.getCell('A1').value).toBe('Documento');
    const relleno = (ref: string) => (hoja.getCell(ref).fill as { fgColor?: { argb?: string } } | undefined)?.fgColor?.argb;
    expect(relleno('A1')).toBe(EXCEL_COLORES.cabecera);
    expect(relleno('B1')).toBe(EXCEL_COLORES.cabecera);
    expect(hoja.getCell('A1').font?.bold).toBeTrue();
    expect(relleno('A2')).toBeUndefined();
    expect(relleno('A3')).toBeUndefined();
    expect(hoja.getCell('A3').border?.top?.color?.argb).toBe(EXCEL_COLORES.borde);
    expect(hoja.getCell('C3').value).toBe('Elaborado');
    expect(hoja.getCell('B2').border?.top?.style).toBe('thin');
  });

  it('con columnas agrupadas arma dos filas de cabecera y une las celdas del grupo', async () => {
    const libro = await crearLibro();
    const hoja = libro.addWorksheet('Resultado');
    escribirTabla(
      hoja,
      [
        { titulo: 'Cuenta', clave: 'cuenta' },
        { titulo: 'Inicial', clave: 'inicial', grupo: 'Saldo' },
        { titulo: 'Actual', clave: 'actual', grupo: 'Saldo' },
      ],
      [{ cuenta: '001', inicial: 10, actual: 20 }],
    );

    expect(hoja.getCell('B1').value).toBe('Saldo');
    expect(hoja.getCell('B2').value).toBe('Inicial');
    expect(hoja.getCell('C1').isMerged).toBeTrue();
    expect(hoja.getCell('A2').isMerged).toBeTrue();
    expect(hoja.getCell('B3').value).toBe(10);
  });

  it('arma el nombre del archivo y la fecha de creación del Resumen', () => {
    expect(nombreArchivo('Documentos de saldos iniciales')).toBe('documentos-de-saldos-iniciales');
    expect(fechaHoraCreacion(new Date(2026, 6, 16, 7, 7, 7))).toBe('16/07/2026  07:07:07');
  });
});
