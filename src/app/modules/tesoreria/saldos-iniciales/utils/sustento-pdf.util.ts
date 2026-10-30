import { leerArchivo } from '../../../../mock/archivos-demo';
import { cuentaPorNumero, entidadPorCodigo, formatoFecha, formatoImporte, type SaldoInicial } from '../models/saldo-inicial.model';

/** Lo que el visor necesita de un saldo para mostrar su sustento. */
export type SaldoConSustento = Pick<SaldoInicial, 'sustento' | 'sustentoId' | 'cuentaBancaria' | 'fechaOperacion' | 'importeCuenta' | 'moneda'> & {
  entidadFinanciera?: string;
};

/**
 * PDF de ejemplo para un sustento sin archivo (los datos iniciales del taller solo tienen el nombre): un estado de
 * cuenta ficticio de dos páginas con los datos del saldo (banco, cuenta, fecha e importe), marcado como ejemplo.
 */
export async function pdfDeEjemplo(saldo: SaldoConSustento): Promise<Blob> {
  const { default: jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const cuenta = cuentaPorNumero(saldo.cuentaBancaria);
  const banco = entidadPorCodigo(saldo.entidadFinanciera ?? cuenta?.entidadCodigo)?.denominacion.toUpperCase() ?? 'ENTIDAD FINANCIERA';
  const simbolo = saldo.moneda === 'USD' ? 'US$' : 'S/';
  const importe = `${simbolo} ${formatoImporte(saldo.importeCuenta)}`;
  const fecha = formatoFecha(saldo.fechaOperacion);
  const total = 2;

  const encabezado = (pagina: number) => {
    pdf.setFillColor(22, 50, 92).rect(0, 0, 210, 30, 'F');
    pdf.setTextColor(255).setFont('helvetica', 'bold').setFontSize(15).text(banco, 20, 15);
    pdf.setFont('helvetica', 'normal').setFontSize(9).text('Estado de cuenta corriente · documento de ejemplo', 20, 22);
    pdf.text(`Página ${pagina} de ${total}`, 190, 22, { align: 'right' });
    pdf.setTextColor(0);
  };
  const pie = () => {
    pdf.setFont('helvetica', 'italic').setFontSize(8).setTextColor(120)
      .text('Documento de ejemplo generado por la demo del SIAF-RP con datos ficticios. No tiene validez.', 105, 287, { align: 'center' });
    pdf.setTextColor(0);
  };
  const filaDato = (etiqueta: string, valor: string, y: number) => {
    pdf.setFont('helvetica', 'bold').text(`${etiqueta}:`, 20, y);
    pdf.setFont('helvetica', 'normal').text(valor, 65, y);
  };

  // ── Página 1: datos de la cuenta, resumen y movimiento de apertura ──
  encabezado(1);
  pdf.setFont('helvetica', 'bold').setFontSize(13).text('ESTADO DE CUENTA - APERTURA DE CUENTA', 105, 45, { align: 'center' });
  pdf.setFontSize(10);
  ([
    ['Titular', 'Ministerio de Economía y Finanzas'],
    ['RUC', '20131370645'],
    ['Cuenta', saldo.cuentaBancaria],
    ['Denominación', cuenta?.denominacion ?? '—'],
    ['Moneda', saldo.moneda === 'USD' ? 'Dólares (USD)' : 'Soles (PEN)'],
    ['Periodo', `Del ${fecha} al ${fecha}`],
  ] as [string, string][]).forEach(([e, v], i) => filaDato(e, v, 60 + i * 7));

  const resumenY = 112;
  pdf.setFillColor(238, 242, 248).rect(20, resumenY - 7, 170, 24, 'F');
  pdf.setFont('helvetica', 'bold').setFontSize(9);
  [['Saldo anterior', `${simbolo} 0.00`], ['Depósitos', importe], ['Retiros', `${simbolo} 0.00`], ['Saldo final', importe]]
    .forEach(([e, v], i) => {
      const x = 24 + i * 42;
      pdf.setFont('helvetica', 'normal').text(e, x, resumenY);
      pdf.setFont('helvetica', 'bold').setFontSize(10).text(v, x, resumenY + 9).setFontSize(9);
    });

  const y = 145;
  pdf.setFont('helvetica', 'bold').setFontSize(11).text('Movimientos', 20, y - 10);
  pdf.setFillColor(22, 50, 92).rect(20, y - 6, 170, 9, 'F');
  pdf.setTextColor(255).setFontSize(9);
  pdf.text('FECHA', 23, y).text('DESCRIPCIÓN DE LA OPERACIÓN', 48, y).text('DEPÓSITOS', 150, y, { align: 'right' }).text('SALDO', 187, y, { align: 'right' });
  pdf.setTextColor(0).setFont('helvetica', 'normal');
  pdf.text(fecha, 23, y + 9).text('Depósito inicial - apertura de cuenta', 48, y + 9)
    .text(importe, 150, y + 9, { align: 'right' }).text(importe, 187, y + 9, { align: 'right' });
  pdf.setDrawColor(200).line(20, y + 13, 190, y + 13);
  pdf.setFont('helvetica', 'bold').text('SALDO FINAL', 110, y + 21).text(importe, 187, y + 21, { align: 'right' });
  pie();

  // ── Página 2: constancia de apertura ──
  pdf.addPage();
  encabezado(2);
  pdf.setFont('helvetica', 'bold').setFontSize(13).text('CONSTANCIA DE APERTURA', 105, 45, { align: 'center' });
  pdf.setFont('helvetica', 'normal').setFontSize(10);
  const texto = `${banco} deja constancia de que el ${fecha} se aperturó la cuenta corriente N.° ${saldo.cuentaBancaria}, `
    + `a nombre del Ministerio de Economía y Finanzas, con un depósito inicial de ${importe}. `
    + 'El saldo indicado corresponde al saldo inicial que se registra en el SIAF-RP.';
  pdf.text(pdf.splitTextToSize(texto, 170), 20, 62);
  filaDato('Código de operación', `OP-${saldo.cuentaBancaria.replace(/\D/g, '').slice(-6).padStart(6, '0')}`, 95);
  filaDato('Fecha de emisión', fecha, 102);
  pdf.setDrawColor(120).line(120, 150, 185, 150);
  pdf.setFontSize(9).text('Firma y sello', 152.5, 156, { align: 'center' });
  pie();

  return pdf.output('blob');
}

/** El archivo del sustento: el que se subió (si sigue guardado) o, si no hay, el PDF de ejemplo. */
export async function archivoDeSustento(saldo: SaldoConSustento, subido?: Blob | null): Promise<Blob> {
  return subido ?? (await leerArchivo(saldo.sustentoId)) ?? (await pdfDeEjemplo(saldo));
}
