import { ABREVIATURAS } from '../../../../shared/utils/abreviaturas.util';
import { SaldoInicial, cuentaPorNumero, cuentasRegistroDe, entidadPorCodigo, formatoFecha, redondear } from '../models/saldo-inicial.model';

function descargar(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.click();
  URL.revokeObjectURL(url);
}

/**
 * «Descargar archivo aquí» del registro automático de saldos de apertura: un Excel con una fila por cuenta de registro
 * (libreta) de cada saldo del documento.
 */
export async function descargarSaldosApertura(numero: string, entidadCodigo: string, saldos: SaldoInicial[]): Promise<void> {
  const { Workbook } = await import('exceljs');
  const libro = new Workbook();
  const hoja = libro.addWorksheet('Saldos de apertura');
  const entidad = entidadPorCodigo(entidadCodigo);

  hoja.columns = [
    { header: ABREVIATURAS.secuencia.termino, key: 'secuencia', width: 12 },
    { header: ABREVIATURAS.fechaOperacion.termino, key: 'fecha', width: 20 },
    { header: 'Entidad financiera', key: 'entidad', width: 34 },
    { header: 'Cuenta bancaria', key: 'cuenta', width: 24 },
    { header: 'Denominación', key: 'denominacion', width: 24 },
    { header: 'Moneda', key: 'moneda', width: 9 },
    { header: ABREVIATURAS.idCorrelativo.termino, key: 'idCorrelativo', width: 16 },
    { header: 'Cuenta de registro', key: 'numero', width: 34 },
    { header: 'Descripción', key: 'descripcion', width: 44 },
    { header: ABREVIATURAS.importeCuenta.termino, key: 'importe', width: 32, style: { numFmt: '#,##0.00' } },
    { header: ABREVIATURAS.importeNacional.termino, key: 'nacional', width: 28, style: { numFmt: '#,##0.00' } },
  ];
  hoja.getRow(1).font = { bold: true };

  for (const saldo of saldos) {
    const importes = new Map(saldo.libretas.map((l) => [l.idCorrelativo, l.importe]));
    for (const libreta of cuentasRegistroDe(saldo.cuentaBancaria).filter((l) => importes.has(l.idCorrelativo))) {
      const importe = importes.get(libreta.idCorrelativo)!;
      hoja.addRow({
        secuencia: saldo.secuencia ?? '',
        fecha: formatoFecha(saldo.fechaOperacion),
        entidad: entidad ? `${entidad.codigo} - ${entidad.denominacion}` : entidadCodigo,
        cuenta: saldo.cuentaBancaria,
        denominacion: cuentaPorNumero(saldo.cuentaBancaria)?.denominacion ?? '',
        moneda: saldo.moneda,
        idCorrelativo: libreta.idCorrelativo,
        numero: libreta.numero,
        descripcion: libreta.descripcion,
        importe,
        nacional: redondear(importe * saldo.tipoCambio),
      });
    }
  }

  const buffer = await libro.xlsx.writeBuffer();
  descargar(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${numero || 'saldos-apertura'}.xlsx`);
}
