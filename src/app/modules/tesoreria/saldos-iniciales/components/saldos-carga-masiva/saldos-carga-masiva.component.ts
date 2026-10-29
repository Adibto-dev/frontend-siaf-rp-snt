import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

import { AlertComponent } from '../../../../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../../../../shared/ui/button/button.component';
import { RadioComponent, RadioOption } from '../../../../../shared/ui/radio/radio.component';
import { SideNavComponent } from '../../../../../shared/ui/side-nav/side-nav.component';
import { TextFieldComponent } from '../../../../../shared/ui/text-field/text-field.component';
import { TooltipDirective } from '../../../../../shared/ui/tooltip/tooltip.directive';
import { UploaderComponent } from '../../../../../shared/ui/uploader/uploader.component';
import { CuentaBancaria, SaldoInicial } from '../../models/saldo-inicial.model';
import { descargarPlantillaSaldos, leerPlantillaSaldos } from '../../utils/saldos-carga-masiva.util';

type ModoPlantilla = 'vacio' | 'precargado';

/**
 * «Carga masiva» de saldos iniciales en el sidenav del kit (Figma 23953:159198): descarga la plantilla vacía o precargada con las cuentas
 * elegidas y sube el Excel (.xlsx) completado. Si todas las filas son correctas emite los saldos; si no, lista los
 * errores y no carga nada.
 */
@Component({
  selector: 'siaf-saldos-carga-masiva',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonComponent, RadioComponent, SideNavComponent, TextFieldComponent, TooltipDirective, UploaderComponent],
  template: `
    <!-- Sidenav del kit (420 px): Cancelar emite también closed, por eso basta con escuchar closed. -->
    <siaf-side-nav
      [open]="open"
      title="Carga masiva"
      confirmLabel="Aceptar"
      [confirmDisabled]="!archivo() || procesando()"
      (closed)="cerrar()"
      (confirmed)="cargar()"
    >
      @if (open) {
        <div class="grid gap-siaf-lg">
          <section class="grid gap-siaf-sm">
            <h3 class="m-0 text-sm font-medium uppercase text-text">Descargar plantilla</h3>
            <siaf-radio-group name="modo-plantilla" [inline]="true" [options]="modos" [value]="modo()" (valueChange)="cambiarModo($event)" />
            <div class="flex items-start gap-siaf-sm">
              <div class="min-w-0 flex-1">
                <siaf-input
                  label="Cuentas bancarias"
                  type="select-multiple"
                  placeholder="Seleccionar opciones"
                  [options]="opcionesCuentas()"
                  [value]="cuentas()"
                  [disabled]="modo() === 'vacio'"
                  (valueChange)="cuentas.set(asLista($event))"
                />
              </div>
              <siaf-button
                variant="outline"
                size="md"
                icon="download"
                [iconOnly]="true"
                ariaLabel="Descargar plantilla"
                siafTooltip="Descargar plantilla"
                [disabled]="modo() === 'precargado' && cuentas().length === 0"
                (click)="descargar()"
              />
            </div>
          </section>

          <section class="grid gap-siaf-sm">
            <h3 class="m-0 text-sm font-medium uppercase text-text">Cargar archivo</h3>
            <siaf-uploader accept=".xlsx" (fileSelected)="elegirArchivo($event)" (fileRemoved)="quitarArchivo()" />
            <p class="m-0 text-sm text-text">Solo se admiten archivos XLSX</p>
          </section>

          @if (errores().length) {
            <siaf-alert tone="error" title="No se cargó el archivo" [description]="errores().join(' ')" />
          }
        </div>
      }
    </siaf-side-nav>
  `,
})
export class SaldosCargaMasivaComponent {
  @Input() open = false;
  @Input() entidadCodigo = '';
  /** Cuentas de la entidad financiera que todavía no están en el documento. */
  @Input() set cuentasDisponibles(valor: CuentaBancaria[]) { this.disponibles.set(valor); }
  @Input() cuentasUsadas: string[] = [];
  /** Genera el id local de cada saldo cargado. */
  @Input() nuevoId: () => string = () => crypto.randomUUID();

  @Output() closed = new EventEmitter<void>();
  @Output() loaded = new EventEmitter<SaldoInicial[]>();

  readonly modos: RadioOption[] = [{ label: 'Vacío', value: 'vacio' }, { label: 'Precargado', value: 'precargado' }];
  private readonly disponibles = signal<CuentaBancaria[]>([]);
  readonly opcionesCuentas = computed(() => this.disponibles().map((c) => ({ label: c.numero, value: c.numero })));
  readonly modo = signal<ModoPlantilla>('vacio');
  readonly cuentas = signal<string[]>([]);
  readonly archivo = signal<File | null>(null);
  readonly errores = signal<string[]>([]);
  readonly procesando = signal(false);

  readonly asLista = (v: string | number | string[]): string[] => (Array.isArray(v) ? v : v ? [String(v)] : []);

  cambiarModo(valor: string): void {
    this.modo.set(valor === 'precargado' ? 'precargado' : 'vacio');
    if (valor !== 'precargado') this.cuentas.set([]);
  }

  descargar(): void {
    void descargarPlantillaSaldos(this.modo() === 'precargado' ? this.cuentas() : []);
  }

  elegirArchivo(archivo: File): void {
    this.archivo.set(archivo);
    this.errores.set([]);
  }

  quitarArchivo(): void {
    this.archivo.set(null);
    this.errores.set([]);
  }

  async cargar(): Promise<void> {
    const archivo = this.archivo();
    if (!archivo) return;
    this.procesando.set(true);
    const { saldos, errores } = await leerPlantillaSaldos(archivo, this.entidadCodigo, this.cuentasUsadas, this.nuevoId);
    this.procesando.set(false);
    if (errores.length) {
      this.errores.set(errores);
      return;
    }
    this.loaded.emit(saldos);
    this.reiniciar();
  }

  cerrar(): void {
    this.reiniciar();
    this.closed.emit();
  }

  private reiniciar(): void {
    this.modo.set('vacio');
    this.cuentas.set([]);
    this.archivo.set(null);
    this.errores.set([]);
  }
}
