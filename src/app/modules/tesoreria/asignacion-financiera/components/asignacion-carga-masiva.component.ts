import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

import { AlertComponent } from '../../../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../../../shared/ui/button/button.component';
import { SideNavComponent } from '../../../../shared/ui/side-nav/side-nav.component';
import { TextFieldComponent } from '../../../../shared/ui/text-field/text-field.component';
import { TooltipDirective } from '../../../../shared/ui/tooltip/tooltip.directive';
import { UploaderComponent } from '../../../../shared/ui/uploader/uploader.component';
import type { LibretaSaldo } from '../../traspasos-cuentas-registros/models/traslado.model';
import { DestinoCargado, descargarPlantillaAsignacion, leerPlantillaAsignacion } from '../utils/asignacion-carga-masiva.util';
import { FILTROS_VACIOS, cumpleFiltros, mismaFuente, opcionesFiltro, textoFuenteSubfuente } from '../utils/clasificacion-cuentas.util';

/**
 * «Carga masiva» de las cuentas de destino de la asignación financiera: descarga la plantilla precargada con las
 * cuentas de registros elegidas (de la cuenta bancaria, sin la de origen) y sube el Excel con el importe de cada una.
 * Grupo y Sub grupo del Clasificador Institucional acotan las cuentas y las marcan todas, para armar la plantilla de un
 * tipo de beneficiario en dos pasos; se puede desmarcar alguna antes de descargar.
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
            @if (origen) {
              <p class="siaf-text-caption-1 m-0 text-[var(--sys-color-text-neutral-low)]">Solo cuentas de {{ fuenteOrigen() }}, como la cuenta de origen.</p>
            }
            <div class="grid gap-siaf-sm sm:grid-cols-2">
              <siaf-input label="Grupo" type="select" placeholder="Todos" [options]="opcionesGrupo()" [value]="grupo()" (valueChange)="elegirGrupo($event)" />
              <siaf-input label="Sub grupo" type="select" placeholder="Todos" [options]="opcionesSubgrupo()" [value]="subgrupo()" [disabled]="!grupo()" (valueChange)="elegirSubgrupo($event)" />
            </div>
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
  /** Plantilla descargada (nombre del archivo): el panel se cierra y el padre avisa con un snackbar. */
  @Output() templateDownloaded = new EventEmitter<string>();

  private readonly todas = signal<LibretaSaldo[]>([]);
  private readonly idOrigen = signal('');
  /** Cuentas de registros que pueden ser destino: «000033 - Descripción». */
  /** Fuente y Sub fuente de la cuenta de origen, para el aviso. */
  readonly fuenteOrigen = computed(() => textoFuenteSubfuente(this.idOrigen()));
  /** Solo las de la misma Fuente y Sub fuente que la cuenta de origen. */
  private readonly destinosPosibles = computed(() =>
    this.todas().filter((l) => l.idCorrelativo !== this.idOrigen() && mismaFuente(this.idOrigen(), l.idCorrelativo)),
  );
  /** Grupo y Sub grupo del Clasificador Institucional (vacío = todos). */
  readonly grupo = signal('');
  readonly subgrupo = signal('');
  private readonly filtros = computed(() => ({ ...FILTROS_VACIOS, grupo: this.grupo(), subgrupo: this.subgrupo() }));
  private readonly idsPosibles = computed(() => this.destinosPosibles().map((l) => l.idCorrelativo));
  readonly opcionesGrupo = computed(() => opcionesFiltro(this.idsPosibles(), this.filtros(), 'grupo'));
  readonly opcionesSubgrupo = computed(() => opcionesFiltro(this.idsPosibles(), this.filtros(), 'subgrupo'));
  /** Cuentas que cumplen Grupo y Sub grupo. */
  private readonly filtradas = computed(() => this.destinosPosibles().filter((l) => cumpleFiltros(l.idCorrelativo, this.filtros())));
  readonly opcionesCuentas = computed(() => this.filtradas().map((l) => ({ label: `${l.idCorrelativo} - ${l.descripcion}`, value: l.idCorrelativo })));
  readonly cuentas = signal<string[]>([]);
  readonly asLista = (v: string | number | string[]): string[] => (Array.isArray(v) ? v : v ? [String(v)] : []);
  readonly archivo = signal<File | null>(null);
  readonly errores = signal<string[]>([]);
  readonly procesando = signal(false);

  /** Al elegir un grupo se marcan todas sus cuentas; sin grupo, ninguna. */
  elegirGrupo(valor: string | number | string[]): void {
    this.grupo.set(this.asLista(valor)[0] ?? '');
    this.subgrupo.set('');
    this.cuentas.set(this.grupo() ? this.filtradas().map((l) => l.idCorrelativo) : []);
  }

  /** Al elegir un subgrupo quedan marcadas todas sus cuentas. */
  elegirSubgrupo(valor: string | number | string[]): void {
    this.subgrupo.set(this.asLista(valor)[0] ?? '');
    this.cuentas.set(this.filtradas().map((l) => l.idCorrelativo));
  }

  /** Descarga la plantilla y cierra el panel: el archivo se sube al volver a abrir «Carga masiva». */
  async descargar(): Promise<void> {
    const elegidas = new Set(this.cuentas());
    const nombre = await descargarPlantillaAsignacion(this.destinosPosibles().filter((l) => elegidas.has(l.idCorrelativo)));
    this.cerrar();
    this.templateDownloaded.emit(nombre);
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
    this.grupo.set('');
    this.subgrupo.set('');
    this.cuentas.set([]);
    this.archivo.set(null);
    this.errores.set([]);
  }
}
