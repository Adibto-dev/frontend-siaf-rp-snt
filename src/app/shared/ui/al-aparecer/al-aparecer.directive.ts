import { AfterViewInit, Directive, ElementRef, Input, inject } from '@angular/core';

/** Lo que puede recibir el foco al aparecer: el primer campo o botón habilitado. */
const ENFOCABLES = 'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Aire entre la barra fija y el bloque: 16 px (`siaf-md`). */
const AIRE = 16;

/**
 * Lleva a la vista un bloque que acaba de aparecer en lugar de otro (un formulario que reemplaza a un recuadro, y el
 * recuadro al volver): desplaza la página hasta dejarlo justo debajo de las barras fijas (navbar y cabecera de la
 * solicitud), como si el bloque hubiera salido de ahí. Solo actúa al crearse el elemento y si la condición es `true`.
 *
 * @usar
 * - En un bloque que aparece con `@if` al pulsar un botón: `<section [siafAlAparecer]="true" [siafAlAparecerFoco]="true">`
 *   (ej. «Agregar saldo inicial libro bancos»).
 * - Para volver al recuadro de origen al cerrar el formulario: `[siafAlAparecer]="volviendo()"`, con una signal que el
 *   padre pone en `true` al cerrar. Así no se mueve al cargar la página.
 * @evitar
 * - En contenido que está desde la carga de la página: la desplazaría sin que el usuario haga nada.
 * - Para modales, paneles laterales y desplegables: ya se ven completos y su foco lo maneja `siafFoco`.
 * @teclado
 * - Con `siafAlAparecerFoco` el foco va al primer campo habilitado del bloque, sin un segundo salto de la página.
 * @accesibilidad
 * - **2.3.3 Animación desde interacciones (AAA)**: con `prefers-reduced-motion: reduce` el salto es inmediato, sin
 *   animación.
 * - **2.4.3 Orden del foco (A)**: con `siafAlAparecerFoco`, el foco sigue al bloque nuevo en vez de quedarse en el botón
 *   que desapareció.
 * - **2.4.11 Foco no oculto (AA)**: el bloque queda debajo de las barras fijas, no tapado por ellas.
 */
@Directive({ selector: '[siafAlAparecer]', standalone: true })
export class AlAparecerDirective implements AfterViewInit {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Si es `true` al crearse el elemento, lo lleva a la vista. */
  @Input() siafAlAparecer: boolean | '' = true;
  /** Lleva también el foco al primer campo habilitado. */
  @Input() siafAlAparecerFoco = false;

  ngAfterViewInit(): void {
    if (this.siafAlAparecer === false) return;
    // Un cuadro después: el bloque ya tiene su alto y el que reemplazó ya no está.
    requestAnimationFrame(() => this.llevarALaVista());
  }

  private llevarALaVista(): void {
    const host = this.el.nativeElement;
    const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const destino = host.getBoundingClientRect().top + window.scrollY - alturaDeBarrasFijas() - AIRE;
    window.scrollTo({ top: Math.max(0, destino), behavior: reducido ? 'auto' : 'smooth' });

    if (this.siafAlAparecerFoco) {
      host.querySelector<HTMLElement>(ENFOCABLES)?.focus({ preventScroll: true });
    }
  }
}

/** Borde inferior más bajo de los elementos `sticky` pegados arriba (navbar y cabecera de la solicitud). */
function alturaDeBarrasFijas(): number {
  // Solo barras: anchas, bajas y pegadas arriba (una capa de fondo a pantalla completa no cuenta).
  // Se mide dónde queda cada barra ya pegada (su `top`), no dónde está ahora: antes del salto puede no estar pegada.
  const barras: { top: number; bottom: number }[] = [];
  for (const el of Array.from(document.body.querySelectorAll<HTMLElement>('*'))) {
    const estilo = getComputedStyle(el);
    if (estilo.position !== 'sticky' && estilo.position !== 'fixed') continue;
    if (estilo.position === 'sticky' && estilo.top === 'auto') continue;
    const caja = el.getBoundingClientRect();
    if (caja.height === 0 || caja.height >= window.innerHeight / 3 || caja.width < window.innerWidth / 2) continue;
    const top = estilo.position === 'sticky' ? parseFloat(estilo.top) || 0 : caja.top;
    barras.push({ top, bottom: top + caja.height });
  }
  barras.sort((a, b) => a.top - b.top);
  let borde = 0;
  for (const b of barras) if (b.top <= borde + 1) borde = Math.max(borde, b.bottom);
  return borde;
}
