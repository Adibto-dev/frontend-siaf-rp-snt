import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { QueryReportExportEvent, QueryReportPageComponent } from '../../../../../shared/components/query-report-page/query-report-page.component';
import type { QueryReportConfig, QueryReportParameters, QueryReportResult, QueryReportRow } from '../../../../../shared/types/query-report.types';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { nombreDeProceso } from '../../../../../shared/utils/process-tree.util';
import { CUENTAS_BANCARIAS, cuentaPorNumero, formatoImporte } from '../../../saldos-iniciales/models/saldo-inicial.model';
import { TrasladosApiService } from '../../api/traslados-api.service';
import { CONSULTAS_PROCESS_ID, CONSULTAS_ROUTE, REQUEST_ROUTE } from '../../config/traslados.rutas';
import { TrasladoRegistro } from '../../models/traslado.model';
import { exportarTraslados } from '../../utils/traslados-export.util';

const MONEDA: Record<string, string> = { PEN: 'Soles', USD: 'Dólares' };
const MODALIDADES = ['1 a 1', '1 a N', 'N a 1', 'N a N'].map((m) => ({ value: m, label: m }));

/** ISO → dd/mm/aaaa (el formato que agrupa por mes la vista de gráficas). */
const aFechaPe = (iso: string): string => iso.slice(0, 10).split('-').reverse().join('/');

/**
 * «Consultas y reportes» del traslado entre cuentas de registros. La pantalla entera la arma `siaf-query-report-page`
 * desde esta configuración. Esta página solo responde la consulta (filtra los traslados aprobados con los
 * parámetros) y genera el archivo al exportar.
 */
@Component({
  selector: 'siaf-traslados-consultas',
  standalone: true,
  imports: [QueryReportPageComponent],
  template: `
    <siaf-query-report-page
      [config]="config"
      [result]="resultado()"
      [loading]="cargando()"
      (queried)="consultar($event)"
      (exported)="exportar($event)"
      (linkClicked)="abrirDocumento($event.row)"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TrasladosConsultasComponent {
  private readonly trasladosApi = inject(TrasladosApiService);
  private readonly router = inject(Router);

  readonly resultado = signal<QueryReportResult | null>(null);
  readonly cargando = signal(false);

  readonly config: QueryReportConfig = {
    // Título y última miga = nombre del MFD en el menú de procesos.
    title: nombreDeProceso(CONSULTAS_PROCESS_ID, 'Consultas y reportes de traslado entre cuentas de registros'),
    breadcrumbs: buildProcessBreadcrumbs(CONSULTAS_PROCESS_ID, CONSULTAS_ROUTE),
    parameterFields: [
      { key: 'desde', label: 'Aprobado desde', type: 'date', required: true, icon: 'calendar_today' },
      { key: 'hasta', label: 'Aprobado hasta', type: 'date', required: true, icon: 'event' },
      { key: 'cuentas', label: 'Cuentas bancarias', type: 'select-multiple', icon: 'account_balance', options: CUENTAS_BANCARIAS.map((c) => ({ value: c.numero, label: `${c.numero} - ${c.denominacion}` })) },
      { key: 'modalidad', label: 'Modalidad', type: 'select', icon: 'swap_horiz', options: MODALIDADES },
    ],
    columns: [
      { key: 'secuencia', label: 'Secuencia', width: 110 },
      { key: 'cuentaBancaria', label: 'Número', group: 'Cuenta bancaria', width: 200 },
      { key: 'denominacion', label: 'Denominación', group: 'Cuenta bancaria', width: 260 },
      { key: 'modalidad', label: 'Modalidad', width: 110 },
      { key: 'origenes', label: 'Origen', width: 170 },
      { key: 'destinos', label: 'Destino', width: 170 },
      { key: 'moneda', label: 'Moneda', width: 110 },
      { key: 'importe', label: 'Importe trasladado', width: 170 },
      { key: 'fecha', label: 'Fecha de registro', width: 150 },
      { key: 'documento', label: 'Documento', width: 280, kind: 'link' },
      { key: 'estado', label: 'Estado', width: 110, fixed: true },
    ],
    rowKey: 'secuencia',
    resultTitle: 'Traslados entre cuentas de registros',
    tableLabel: 'Traslados consultados',
    presetFilters: [
      { key: 'modalidad', label: 'Modalidad', options: MODALIDADES },
      { key: 'moneda', label: 'Moneda', options: [{ label: 'Soles', value: 'Soles' }, { label: 'Dólares', value: 'Dólares' }] },
    ],
    charts: {
      kpis: [
        { title: 'Traslados aprobados', icon: 'swap_horiz', tone: 'informative', aggregate: 'count' },
        { title: 'Varios orígenes (N a 1)', icon: 'call_merge', tone: 'success', aggregate: 'count', where: { column: 'modalidad', value: 'N a 1' } },
        { title: 'Varios destinos (1 a N)', icon: 'call_split', tone: 'warning', aggregate: 'count', where: { column: 'modalidad', value: '1 a N' } },
      ],
      charts: [
        { title: 'Traslados por cuenta bancaria', description: 'Cantidad de traslados aprobados en cada cuenta bancaria.', type: 'bar', groupBy: 'denominacion', aggregate: 'count', seriesName: 'Traslados', categoryLabel: 'Cuenta bancaria', width: 'wide' },
        { title: 'Traslados por modalidad', type: 'donut', groupBy: 'modalidad', aggregate: 'count', seriesName: 'Traslados' },
        { title: 'Traslados por mes', description: 'Traslados aprobados en cada mes del periodo consultado.', type: 'line', groupBy: 'fecha', byMonth: true, aggregate: 'count', seriesName: 'Traslados' },
      ],
    },
    emptyTitle: 'Realice una consulta',
    emptyDescription: 'Elija el rango de fechas y, si quiere, las cuentas bancarias y la modalidad.',
  };

  consultar(parametros: QueryReportParameters): void {
    const desde = String(parametros['desde'] ?? '');
    const hasta = String(parametros['hasta'] ?? '');
    const cuentas = (parametros['cuentas'] as string[] | undefined) ?? [];
    const modalidad = String(parametros['modalidad'] ?? '');

    this.cargando.set(true);
    this.trasladosApi.listarRegistros().subscribe({
      next: (registros) => {
        const filtrados = registros.filter((r) => {
          const dia = r.fechaRegistro.slice(0, 10);
          return (!desde || dia >= desde) && (!hasta || dia <= hasta)
            && (cuentas.length === 0 || cuentas.includes(r.cuentaBancaria))
            && (!modalidad || r.modalidad === modalidad);
        });
        const filas = filtrados.map((r) => this.aFila(r));
        this.resultado.set({
          rows: filas,
          summary: {
            label: 'Resultado de la consulta',
            icon: 'swap_horiz',
            title: `${filas.length} ${filas.length === 1 ? 'traslado' : 'traslados'}`,
            description: desde && hasta ? `Aprobados entre el ${aFechaPe(desde)} y el ${aFechaPe(hasta)}.` : undefined,
            fields: [
              { label: 'Cuentas bancarias', value: cuentas.length ? cuentas.map((c) => cuentaPorNumero(c)?.denominacion ?? c).join(', ') : 'Todas' },
              { label: 'Modalidad', value: modalidad || 'Todas' },
            ],
          },
        });
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  exportar(evento: QueryReportExportEvent): void {
    void exportarTraslados(evento.format, this.config.columns, evento.rows);
  }

  abrirDocumento(fila: QueryReportRow): void {
    if (fila['documentoId']) void this.router.navigate([REQUEST_ROUTE, fila['documentoId']]);
  }

  private aFila(r: TrasladoRegistro): QueryReportRow {
    const cuentas = (naturaleza: 'Débito' | 'Crédito') => r.movimientos.filter((m) => m.naturaleza === naturaleza).map((m) => m.idCorrelativo).join(', ');
    return {
      secuencia: r.secuencia,
      cuentaBancaria: r.cuentaBancaria,
      denominacion: cuentaPorNumero(r.cuentaBancaria)?.denominacion ?? '',
      modalidad: r.modalidad,
      origenes: cuentas('Débito'),
      destinos: cuentas('Crédito'),
      moneda: MONEDA[r.moneda] ?? r.moneda,
      importe: formatoImporte(r.total),
      fecha: aFechaPe(r.fechaRegistro),
      documento: r.numeroDocumento,
      documentoId: r.documentoId,
      estado: r.estado,
    };
  }
}
