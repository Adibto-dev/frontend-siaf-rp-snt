import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';

import { FocoDirective } from '../foco/foco.directive';
import { IconComponent } from '../icon/icon.component';
import { TooltipDirective } from '../tooltip/tooltip.directive';

/** Niveles de zoom de los botones − y +. 1 = 100 %. */
export const ZOOM_PDF = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

/** Un punto del PDF (1/72 de pulgada) en píxeles CSS (96 por pulgada): así 100 % es el tamaño real de la hoja. */
const PUNTOS_A_PIXELES = 96 / 72;

type DocumentoPdf = { numPages: number; getPage(n: number): Promise<PaginaPdf>; destroy(): Promise<void> };
type PaginaPdf = {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }): { promise: Promise<void> };
};

/**
 * Carga pdf.js solo cuando se abre un PDF (no pesa en el resto de la app). Su worker va empaquetado con la app y corre
 * en la misma página (`globalThis.pdfjsWorker`), así no depende de un archivo servido aparte.
 */
async function abrirPdf(datos: ArrayBuffer): Promise<DocumentoPdf> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    // @ts-expect-error el worker de pdf.js no publica tipos
    import('pdfjs-dist/build/pdf.worker.min.mjs'),
  ]);
  (globalThis as { pdfjsWorker?: unknown }).pdfjsWorker = worker;
  return (await pdfjs.getDocument({ data: new Uint8Array(datos) }).promise) as unknown as DocumentoPdf;
}

/**
 * Visor de PDF a pantalla completa (Figma 2.10.6.1.3, nodo 24324:79499): barra superior con Cerrar, nombre del archivo,
 * Descargar e Imprimir; las páginas sobre fondo oscuro y, abajo, «Página N de M» con zoom − / +.
 *
 * Recibe el archivo como `Blob` (`source`) y lo dibuja con pdf.js. Mientras no llega el archivo muestra «Cargando
 * documento…»; si no es un PDF válido, avisa sin cerrar el visor. Es agnóstico: quien lo usa decide de dónde sale el
 * archivo (el subido por el usuario, el que devuelve la API o uno de ejemplo).
 *
 * @usar
 * - Para ver un documento de sustento PDF ya adjunto: desde la tarjeta del archivo (`siaf-uploaded-file-card` con
 *   `[viewable]`) o desde la acción «Ver documento de sustento» de una tabla.
 * @evitar
 * - Para elegir o subir un archivo: usar `siaf-upload-side-nav`.
 * - Para archivos que no son PDF (Excel, imágenes): descargarlos.
 * @teclado
 * - **Tab**: recorre Cerrar, Descargar, Imprimir, el número de página y los botones de zoom; el foco no sale del visor.
 * - **Escape**: cierra el visor y devuelve el foco a quien lo abrió.
 * - **Enter** en «Página»: va a la página escrita.
 * @accesibilidad
 * - **4.1.2 Nombre, función y valor (A)**: el visor es un `role="dialog"` con `aria-modal` y el nombre del archivo; los
 *   botones de ícono llevan `aria-label`.
 * - **2.4.3 Orden del foco (A)**: con `siafFoco`, el foco entra al abrir, queda atrapado y vuelve al cerrar.
 * - **4.1.3 Mensajes de estado (AA)**: «Cargando documento…» y el error se anuncian con `role="status"` / `role="alert"`.
 * - **Pendiente · 1.1.1 Contenido no textual (A)**: las páginas se dibujan como imagen; el texto del PDF no es
 *   seleccionable ni lo lee un lector de pantalla (para eso, Descargar).
 */
@Component({
  selector: 'siaf-pdf-viewer',
  standalone: true,
  imports: [FocoDirective, IconComponent, TooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open) {
      <div
        class="fixed inset-0 z-[60] flex flex-col bg-[var(--sys-color-bg-feedback-dark-default)] text-[var(--sys-color-text-brand-white)]"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'Documento ' + fileName"
        tabindex="-1"
        [siafFoco]="open"
        (siafFocoEscape)="cerrar()"
      >
        <header class="flex h-14 shrink-0 items-center gap-siaf-sm bg-[var(--color-palette-grey-900)] px-siaf-md">
          <button type="button" [class]="claseBoton" aria-label="Cerrar visor" (click)="cerrar()">
            <siaf-icon name="close" [size]="24" />
          </button>
          <h2 class="m-0 min-w-0 flex-1 truncate text-base font-medium" [siafTooltip]="fileName">{{ fileName }}</h2>
          <button type="button" [class]="claseBoton" aria-label="Descargar" siafTooltip="Descargar" [disabled]="!archivo()" (click)="descargar()">
            <siaf-icon name="download" [size]="24" />
          </button>
          <button type="button" [class]="claseBoton" aria-label="Imprimir" siafTooltip="Imprimir" [disabled]="!archivo()" (click)="imprimir()">
            <siaf-icon name="print" [size]="24" />
          </button>
        </header>

        <div #area class="relative min-h-0 flex-1 overflow-auto" (scroll)="alDesplazar()">
          @if (estado() === 'cargando') {
            <p class="m-0 p-siaf-xl text-center text-sm" role="status">Cargando documento…</p>
          } @else if (estado() === 'error') {
            <p class="m-0 p-siaf-xl text-center text-sm" role="alert">No se pudo abrir el archivo: no es un PDF válido. Puede descargarlo para revisarlo.</p>
          }
          <div #paginas class="flex w-max min-w-full flex-col items-center gap-siaf-md px-siaf-md pb-24 pt-siaf-xl"></div>
        </div>

        @if (total() > 0) {
          <div class="pointer-events-none absolute inset-x-0 bottom-siaf-lg flex justify-center px-siaf-md">
            <div class="pointer-events-auto flex items-center gap-siaf-sm rounded-siaf-md bg-[var(--color-palette-grey-900)] px-siaf-md py-siaf-xs text-sm shadow-siaf-elevation-2">
              <label for="siaf-pdf-pagina">Página</label>
              <input
                id="siaf-pdf-pagina"
                class="h-8 w-11 rounded-siaf-sm border-0 bg-[var(--sys-color-bg-surfaces-surface)] text-center text-sm text-text [appearance:textfield] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                type="number"
                inputmode="numeric"
                min="1"
                [max]="total()"
                [value]="pagina()"
                (keydown.enter)="irA($any($event.target).valueAsNumber)"
                (change)="irA($any($event.target).valueAsNumber)"
              />
              <span>de {{ total() }}</span>
              <span class="mx-siaf-xs h-6 w-px bg-[var(--sys-color-bg-states-dark-hover)]" aria-hidden="true"></span>
              <button type="button" [class]="claseBoton" aria-label="Alejar" [disabled]="!puedeAlejar()" (click)="cambiarZoom(-1)">
                <siaf-icon name="remove" [size]="20" />
              </button>
              <span class="w-12 text-center tabular-nums" aria-live="polite">{{ porcentaje() }}</span>
              <button type="button" [class]="claseBoton" aria-label="Acercar" [disabled]="!puedeAcercar()" (click)="cambiarZoom(1)">
                <siaf-icon name="add" [size]="20" />
              </button>
            </div>
          </div>
        }
      </div>
    }
  `,
})
export class PdfViewerComponent {
  @Input() open = false;
  /** Nombre que muestra la barra superior y con el que se descarga. */
  @Input() fileName = 'documento.pdf';
  /** El PDF. `null` mientras se obtiene (el visor muestra «Cargando documento…»). */
  @Input() set source(valor: Blob | null) {
    this.archivo.set(valor);
  }

  @Output() closed = new EventEmitter<void>();

  readonly claseBoton =
    'inline-grid size-10 shrink-0 place-items-center rounded-siaf-md transition hover:bg-[var(--sys-color-bg-states-dark-hover)] disabled:opacity-40 focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]';

  readonly archivo = signal<Blob | null>(null);
  readonly estado = signal<'cargando' | 'listo' | 'error'>('cargando');
  readonly total = signal(0);
  readonly pagina = signal(1);
  readonly zoom = signal(1);
  readonly porcentaje = computed(() => `${Math.round(this.zoom() * 100)}%`);
  readonly puedeAlejar = computed(() => this.zoom() > ZOOM_PDF[0]);
  readonly puedeAcercar = computed(() => this.zoom() < ZOOM_PDF[ZOOM_PDF.length - 1]);

  private readonly area = viewChild<ElementRef<HTMLElement>>('area');
  private readonly paginas = viewChild<ElementRef<HTMLElement>>('paginas');
  private documento: DocumentoPdf | null = null;
  private documentoDe: Blob | null = null;
  private dibujo = 0;

  constructor() {
    // Se (re)dibuja al llegar el archivo, al abrirse el visor (aparece el contenedor) o al cambiar el zoom.
    effect(() => {
      const archivo = this.archivo();
      const contenedor = this.paginas()?.nativeElement;
      const zoom = this.zoom();
      if (!archivo || !contenedor) {
        this.estado.set('cargando');
        return;
      }
      void this.dibujar(archivo, contenedor, zoom);
    });
    inject(DestroyRef).onDestroy(() => void this.documento?.destroy());
  }

  cerrar(): void {
    this.zoom.set(1);
    this.pagina.set(1);
    this.closed.emit();
  }

  cambiarZoom(paso: 1 | -1): void {
    const i = ZOOM_PDF.indexOf(this.zoom() as (typeof ZOOM_PDF)[number]);
    const siguiente = ZOOM_PDF[Math.min(ZOOM_PDF.length - 1, Math.max(0, (i < 0 ? 2 : i) + paso))];
    this.zoom.set(siguiente);
  }

  irA(numero: number): void {
    const n = Math.min(this.total(), Math.max(1, Math.round(numero || 1)));
    this.pagina.set(n);
    this.paginas()?.nativeElement.children[n - 1]?.scrollIntoView({ block: 'start' });
  }

  /** La página actual es la que ocupa la parte superior del área visible. */
  alDesplazar(): void {
    const area = this.area()?.nativeElement;
    const hojas = Array.from(this.paginas()?.nativeElement.children ?? []) as HTMLElement[];
    if (!area || !hojas.length) return;
    const limite = area.getBoundingClientRect().top + area.clientHeight / 3;
    const actual = hojas.filter((h) => h.getBoundingClientRect().top <= limite).length;
    this.pagina.set(Math.max(1, actual));
  }

  descargar(): void {
    const archivo = this.archivo();
    if (!archivo) return;
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = this.fileName;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  /** Imprime el PDF tal cual (el diálogo del navegador), desde un marco oculto. */
  imprimir(): void {
    const archivo = this.archivo();
    if (!archivo) return;
    const url = URL.createObjectURL(new Blob([archivo], { type: 'application/pdf' }));
    const marco = document.createElement('iframe');
    marco.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
    marco.src = url;
    marco.onload = () => marco.contentWindow?.print();
    document.body.appendChild(marco);
    setTimeout(() => {
      marco.remove();
      URL.revokeObjectURL(url);
    }, 60_000);
  }

  private async dibujar(archivo: Blob, contenedor: HTMLElement, zoom: number): Promise<void> {
    const turno = ++this.dibujo;
    try {
      if (this.documentoDe !== archivo) {
        this.estado.set('cargando');
        contenedor.replaceChildren();
        void this.documento?.destroy();
        this.documento = await abrirPdf(await archivo.arrayBuffer());
        this.documentoDe = archivo;
      }
      const doc = this.documento!;
      const densidad = window.devicePixelRatio || 1;
      const hojas: HTMLCanvasElement[] = [];
      for (let n = 1; n <= doc.numPages; n++) {
        const pagina = await doc.getPage(n);
        if (turno !== this.dibujo) return;
        const vista = pagina.getViewport({ scale: zoom * PUNTOS_A_PIXELES * densidad });
        const hoja = document.createElement('canvas');
        hoja.width = Math.floor(vista.width);
        hoja.height = Math.floor(vista.height);
        hoja.style.width = `${Math.floor(vista.width / densidad)}px`;
        hoja.style.height = `${Math.floor(vista.height / densidad)}px`;
        hoja.setAttribute('aria-label', `Página ${n}`);
        hoja.setAttribute('role', 'img');
        await pagina.render({ canvasContext: hoja.getContext('2d')!, viewport: vista }).promise;
        hojas.push(hoja);
      }
      if (turno !== this.dibujo) return;
      contenedor.replaceChildren(...hojas);
      this.total.set(doc.numPages);
      this.estado.set('listo');
      this.irA(this.pagina());
    } catch {
      if (turno !== this.dibujo) return;
      this.documento = null;
      this.documentoDe = null;
      this.total.set(0);
      this.estado.set('error');
    }
  }
}
