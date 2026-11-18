import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { SideNavComponent } from '../../../../shared/ui/side-nav/side-nav.component';
import { TextFieldComponent } from '../../../../shared/ui/text-field/text-field.component';
import { TooltipDirective } from '../../../../shared/ui/tooltip/tooltip.directive';
import { UploaderComponent } from '../../../../shared/ui/uploader/uploader.component';
import type { LibretaSaldo } from '../../traspasos-cuentas-registros/models/traslado.model';
import { DestinoCargado, descargarPlantillaAsignacion, leerPlantillaAsignacion } from '../utils/asignacion-carga-masiva.util';

/**
 * «Carga masiva» de las cuentas de destino de la asignación financiera: descarga la plantilla precargada con las
 * cuentas de registros elegidas (de la cuenta bancaria, sin la de origen) y sube el Excel con el importe de cada una.
 */
@Component({
  selector: 'siaf-asignacion-carga-masiva',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonComponent, SideNavComponent, TextFieldComponent, TooltipDirective, UploaderComponent],
  template: `
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
            <div class="flex items-start gap-siaf-sm">
              <div class="min-w-0 flex-1">
                <siaf-input
                  label="Cuentas de registros"
                  type="select-multiple"
                  placeholder="Seleccionar opciones"
                  [options]="opcionesCuentas()"
                  [value]="cuentas()"
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
                [disabled]="cuentas().length === 0"
                (click)="descargar()"
              />
            </div>
          </section>

          <section class="grid gap-siaf-sm">
            <h3 class="m-0 text-sm font-medium uppercase text-text">Cargar archivo</h3>
            <siaf-uploader accept=".xlsx" (fileSelected)="elegirArchivo($event)" (fileRemoved)="quitarArchivo()" />
            <p class="m-0 text-sm text-text">Solo se admiten archivos XLSX. Las cuentas cargadas reemplazan a los destinos actuales.</p>
          </section>

          @if (errores().length) {
            <siaf-alert tone="error" title="No se cargó el archivo" [description]="errores().join(' ')" />
          }
        </div>
      }
    </siaf-side-nav>
  `,
})
export class AsignacionCargaMasivaComponent {
  @Input() open = false;
  /** Cuentas de registro de la cuenta bancaria. */
  @Input() set libretas(valor: LibretaSaldo[]) { this.todas.set(valor); }
  get libretas(): LibretaSaldo[] { return this.todas(); }
  /** Cuenta de origen: no puede ser destino ni va en la plantilla. */
  @Input() set origen(valor: string) { this.idOrigen.set(valor); }
  get origen(): string { return this.idOrigen(); }

  @Output() closed = new EventEmitter<void>();
  @Output() loaded = new EventEmitter<DestinoCargado[]>();

  private readonly todas = signal<LibretaSaldo[]>([]);
  private readonly idOrigen = signal('');
  /** Cuentas de registros que pueden ser destino: «000033 - Descripción». */
  private readonly destinosPosibles = computed(() => this.todas().filter((l) => l.idCorrelativo !== this.idOrigen()));
  readonly opcionesCuentas = computed(() => this.destinosPosibles().map((l) => ({ label: `${l.idCorrelativo} - ${l.descripcion}`, value: l.idCorrelativo })));
  readonly cuentas = signal<string[]>([]);
  readonly asLista = (v: string | number | string[]): string[] => (Array.isArray(v) ? v : v ? [String(v)] : []);
  readonly archivo = signal<File | null>(null);
  readonly errores = signal<string[]>([]);
  readonly procesando = signal(false);

  descargar(): void {
    const elegidas = new Set(this.cuentas());
    void descargarPlantillaAsignacion(this.destinosPosibles().filter((l) => elegidas.has(l.idCorrelativo)));
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
    const { destinos, errores } = await leerPlantillaAsignacion(archivo, this.libretas, this.origen);
    this.procesando.set(false);
    if (errores.length) { this.errores.set(errores); return; }
    this.loaded.emit(destinos);
    this.reiniciar();
  }

  cerrar(): void {
    this.reiniciar();
    this.closed.emit();
  }

  private reiniciar(): void {
    this.cuentas.set([]);
    this.archivo.set(null);
    this.errores.set([]);
  }
}
