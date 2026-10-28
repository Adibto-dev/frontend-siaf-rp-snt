import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { MessageBoxComponent } from '../../../../../shared/ui/message-box/message-box.component';
import { TooltipDirective } from '../../../../../shared/ui/tooltip/tooltip.directive';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { SaldosInicialesApiService } from '../../api/saldos-iniciales-api.service';
import { SaldoDetalleComponent } from '../../components/saldo-detalle/saldo-detalle.component';
import { PROCESS_ID, PROCESS_ROUTE } from '../../config/saldos-iniciales.rutas';
import { NOMBRE_AUTOMATICO, NOMBRE_DOCUMENTO, SaldoInicialRegistro } from '../../models/saldo-inicial.model';

/** Un dato de solo lectura: etiqueta arriba y valor abajo, como en el Figma. */
interface Dato {
  etiqueta: string;
  valor: string;
}

/**
 * «Detalle del saldo inicial»: la información consolidada de un registro aprobado (Figma 24028:69253). Se abre al pulsar
 * una fila de la pestaña Registros. Es de solo lectura: tipo de operación, movimiento interno, entidad financiera, el
 * saldo con su cuenta bancaria, tipo de cambio, importes y cuentas de registro, el sustento, el estado del registro y
 * el documento que lo creó.
 */
@Component({
  selector: 'siaf-saldo-inicial-detalle',
  standalone: true,
  imports: [MessageBoxComponent, NgTemplateOutlet, SaldoDetalleComponent, SolicitudeFormCardComponent, SolicitudePageLayoutComponent, TooltipDirective],
  template: `
    <div class="min-h-[calc(100vh-56px)] bg-[var(--sys-color-bg-surfaces-surface-lowest)] text-text">
      <siaf-solicitude-page-layout
        [breadcrumbs]="breadcrumbs"
        [heading]="registro()?.automatico ? 'Detalle del saldo inicial de apertura' : 'Detalle del saldo inicial'"
        [showReturn]="true"
        [showTag]="false"
        [customActions]="true"
        [showButtonGroup]="false"
        [loading]="cargando()"
        (returned)="regresar()"
      >
        @if (cargando()) {
          <div class="rounded-siaf-md bg-surface p-siaf-xl">
            <div class="grid grid-cols-3 gap-siaf-md">
              @for (i of [1, 2, 3]; track i) {
                <div class="siaf-skeleton-pulse h-4 w-32 rounded bg-[var(--sys-color-bg-surfaces-surface-low)]"></div>
              }
            </div>
          </div>
        } @else if (registro(); as r) {
          <siaf-saldo-detalle [registro]="r" />

          <!-- Documento que creó el registro -->
          <siaf-solicitude-form-card title="Documento">
            <ng-container *ngTemplateOutlet="datos; context: { $implicit: documento() }" />
          </siaf-solicitude-form-card>
        } @else {
          <siaf-solicitude-form-card>
            <message-box text="No se encontró el saldo inicial. Vuelva a la lista de registros." />
          </siaf-solicitude-form-card>
        }
      </siaf-solicitude-page-layout>
    </div>

    <ng-template #datos let-lista>
      <dl class="m-0 grid gap-siaf-md px-siaf-sm sm:grid-cols-3">
        @for (d of lista; track d.etiqueta) {
          <div class="min-w-0">
            <dt class="siaf-text-caption-1 text-[var(--sys-color-text-neutral-low)]">{{ d.etiqueta }}</dt>
            <dd class="m-0 truncate text-sm" siafTooltip>{{ d.valor }}</dd>
          </div>
        }
      </dl>
    </ng-template>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SaldoInicialDetalleComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly saldosApi = inject(SaldosInicialesApiService);

  readonly breadcrumbs = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE);
  readonly cargando = signal(true);
  readonly registro = signal<SaldoInicialRegistro | null>(null);

  readonly documento = computed((): Dato[] => {
    const r = this.registro();
    return [
      { etiqueta: 'Número', valor: r?.numeroDocumento ?? '' },
      { etiqueta: 'Denominación', valor: r?.automatico ? NOMBRE_AUTOMATICO : NOMBRE_DOCUMENTO },
      { etiqueta: 'Tipo de acción', valor: 'Creación' },
    ];
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('registroId');
    this.saldosApi.listarRegistros().subscribe({
      next: (registros) => {
        this.registro.set(registros.find((r) => r.registroId === id) ?? null);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  regresar(): void {
    void this.router.navigate([PROCESS_ROUTE], { queryParams: { tab: 'records' } });
  }
}
