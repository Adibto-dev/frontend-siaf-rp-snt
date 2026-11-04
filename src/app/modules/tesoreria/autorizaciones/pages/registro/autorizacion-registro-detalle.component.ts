import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { SolicitudePageLayoutComponent } from '../../../../../shared/components/solicitude-page-layout/solicitude-page-layout.component';
import { MessageBoxComponent } from '../../../../../shared/ui/message-box/message-box.component';
import { ReadonlyFieldComponent } from '../../../../../shared/ui/readonly-field/readonly-field.component';
import { buildProcessBreadcrumbs } from '../../../../../shared/utils/breadcrumbs.util';
import { AutorizacionesApiService } from '../../api/autorizaciones-api.service';
import { AutorizacionDetalleComponent } from '../../components/autorizacion-detalle/autorizacion-detalle.component';
import { PROCESS_ID, PROCESS_ROUTE } from '../../config/autorizaciones.rutas';
import { AutorizacionRegistro, NOMBRE_DOCUMENTO, etiquetaTipoAccion } from '../../models/autorizacion.model';

/**
 * «Detalle de la autorización»: la autorización excepcional tal como está registrada. Se abre al pulsar una fila de la
 * pestaña Registros de «Documentos de autorización». Es de solo lectura: los datos de la autorización, su vigencia,
 * el estado del registro y el último documento que la creó o modificó. «Regresar» vuelve a Registros.
 */
@Component({
  selector: 'siaf-autorizacion-registro-detalle',
  standalone: true,
  imports: [AutorizacionDetalleComponent, MessageBoxComponent, ReadonlyFieldComponent, SolicitudeFormCardComponent, SolicitudePageLayoutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-h-[calc(100vh-56px)] bg-[var(--sys-color-bg-surfaces-surface-lowest)] text-text">
      <siaf-solicitude-page-layout
        [breadcrumbs]="breadcrumbs"
        heading="Detalle de la autorización"
        [showReturn]="true"
        [showTag]="false"
        [customActions]="true"
        [showButtonGroup]="false"
        [loading]="cargando()"
        (returned)="regresar()"
      >
        @if (cargando()) {
          <div class="rounded-siaf-md bg-surface p-siaf-xl">
            <div class="siaf-skeleton-pulse h-4 w-48 rounded bg-[var(--sys-color-bg-surfaces-surface-low)]"></div>
          </div>
        } @else if (registro(); as r) {
          <siaf-autorizacion-detalle [autorizacion]="r" />

          <!-- Último documento que creó o modificó la autorización -->
          <siaf-solicitude-form-card title="Documento">
            <div class="grid gap-x-siaf-xl gap-y-siaf-md md:grid-cols-3">
              @for (campo of documento(); track campo.caption) {
                <readonly-field [caption]="campo.caption" [value]="campo.value" />
              }
            </div>
          </siaf-solicitude-form-card>
        } @else {
          <siaf-solicitude-form-card>
            <message-box text="No se encontró la autorización. Vuelva a la lista de registros." />
          </siaf-solicitude-form-card>
        }
      </siaf-solicitude-page-layout>
    </div>
  `,
})
export class AutorizacionRegistroDetalleComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AutorizacionesApiService);

  readonly breadcrumbs = buildProcessBreadcrumbs(PROCESS_ID, PROCESS_ROUTE);
  readonly cargando = signal(true);
  readonly registro = signal<AutorizacionRegistro | null>(null);

  readonly documento = computed(() => {
    const r = this.registro();
    return [
      { caption: 'Número', value: r?.numeroDocumento || '--' },
      { caption: 'Denominación', value: NOMBRE_DOCUMENTO },
      { caption: 'Tipo de acción', value: etiquetaTipoAccion(r?.documentos.at(-1)?.tipoAccion) },
    ];
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('registroId');
    this.api.listarRegistros().subscribe({
      next: (registros) => {
        this.registro.set(registros.find((r) => r.id === id) ?? null);
        this.cargando.set(false);
      },
      error: () => this.cargando.set(false),
    });
  }

  regresar(): void {
    void this.router.navigate([PROCESS_ROUTE], { queryParams: { tab: 'records' } });
  }
}
