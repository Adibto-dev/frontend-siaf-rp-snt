import { ChangeDetectionStrategy, Component, Input, computed, signal } from '@angular/core';

import { SolicitudeFormCardComponent } from '../../../../../shared/components/solicitude-form-card/solicitude-form-card.component';
import { ReadonlyFieldComponent } from '../../../../../shared/ui/readonly-field/readonly-field.component';
import { RecordStatusTagComponent } from '../../../../../shared/ui/record-status-tag/record-status-tag.component';
import { SummaryCardComponent, type SummaryCardField } from '../../../../../shared/ui/summary-card/summary-card.component';
import {
  type EstadoAutorizacion,
  cuentaDeAutorizacion,
  documentoResponsable,
  fechaCorta,
  nombreEntidadDeCuenta,
  nombreProcedimiento,
  responsablePorUsuario,
} from '../../models/autorizacion.model';

/** Lo que se muestra de una autorización: la del registro o la que dejó un documento de su historial. */
export interface AutorizacionVista {
  procedimiento: string;
  responsable: string;
  cuentaBancaria: string;
  estado: EstadoAutorizacion;
  fechaDesde: string | null;
  fechaHasta: string | null;
  motivo: string;
}

/**
 * Bloque de solo lectura con los datos de una autorización excepcional: procedimiento, responsable y cuenta bancaria
 * (en card), la justificación con su vigencia y el estado del registro. Lo usan la página «Detalle de la autorización»
 * y el historial del registro (`lineal`: cards con borde y sin el estado al final, que va en el bloque Documento).
 */
@Component({
  selector: 'siaf-autorizacion-detalle',
  standalone: true,
  imports: [ReadonlyFieldComponent, RecordStatusTagComponent, SolicitudeFormCardComponent, SummaryCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (datos(); as a) {
      <div class="flex flex-col gap-siaf-md">
        <siaf-solicitude-form-card [bordered]="lineal" title="Autorización">
          <readonly-field caption="Procedimiento" [value]="nombreProcedimiento(a.procedimiento)" />
          <section class="grid gap-siaf-sm">
            <h3 class="m-0 text-sm font-bold uppercase text-text">Responsable</h3>
            <siaf-summary-card [fields]="responsable()" [bordered]="true" [showClose]="false" />
          </section>
          <section class="grid gap-siaf-sm">
            <h3 class="m-0 text-sm font-bold uppercase text-text">Cuenta bancaria</h3>
            <siaf-summary-card [fields]="cuenta()" [bordered]="true" [showClose]="false" />
          </section>
        </siaf-solicitude-form-card>

        <siaf-solicitude-form-card [bordered]="lineal" title="Justificación">
          <readonly-field caption="Motivo de la autorización" [value]="a.motivo || '--'" />
          <section class="grid gap-siaf-sm">
            <h3 class="m-0 text-sm font-bold uppercase text-text">Vigencia</h3>
            <div class="grid gap-x-siaf-xl gap-y-siaf-md md:grid-cols-2 xl:grid-cols-3">
              @for (campo of vigencia(); track campo.caption) {
                <readonly-field [caption]="campo.caption" [value]="campo.value" />
              }
            </div>
          </section>
          @if (!lineal) {
            <div class="border-t border-[var(--sys-color-divider-default)] pt-siaf-md">
              <p class="siaf-text-caption-1 m-0 mb-siaf-xxs text-[var(--sys-color-text-neutral-low)]">Estado de registro</p>
              <siaf-record-status-tag [status]="a.estado" />
            </div>
          }
        </siaf-solicitude-form-card>
      </div>
    }
  `,
})
export class AutorizacionDetalleComponent {
  readonly datos = signal<AutorizacionVista | null>(null);

  @Input({ alias: 'autorizacion' }) set autorizacionValor(valor: AutorizacionVista | null) {
    this.datos.set(valor);
  }

  /** Cards con borde y sin el estado al final: así se ve en el historial del registro. */
  @Input() lineal = false;

  readonly nombreProcedimiento = nombreProcedimiento;

  readonly responsable = computed((): SummaryCardField[] => {
    const r = responsablePorUsuario(this.datos()?.responsable);
    return [
      { label: 'Usuario', value: r?.usuario ?? this.datos()?.responsable ?? '--' },
      { label: 'N° Documento', value: documentoResponsable(r) },
      { label: 'Nombres y apellidos', value: r?.nombres ?? '--' },
    ];
  });

  readonly cuenta = computed((): SummaryCardField[] => {
    const numero = this.datos()?.cuentaBancaria;
    const c = cuentaDeAutorizacion(numero);
    return [
      { label: 'Número de cuenta', value: numero ?? '--' },
      { label: 'Denominación', value: c?.denominacion ?? '--' },
      { label: 'Moneda', value: c?.moneda ?? '--' },
      { label: 'Entidad financiera', value: nombreEntidadDeCuenta(numero) || '--' },
    ];
  });

  /**
   * Vigente si el registro quedó Activo. Las fechas se muestran siempre que existan (un registro Inactivo conserva la
   * vigencia que tuvo, como en la tabla de Registros); sin fecha, «--».
   */
  readonly vigencia = computed(() => {
    const a = this.datos();
    const fecha = (iso: string | null | undefined) => (iso ? fechaCorta(iso) : '--');
    return [
      { caption: 'Vigente', value: a?.estado === 'Activo' ? 'Sí' : 'No' },
      { caption: 'Fecha desde', value: fecha(a?.fechaDesde) },
      { caption: 'Fecha hasta', value: fecha(a?.fechaHasta) },
    ];
  });
}
