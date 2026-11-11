import { DestroyRef, effect, inject, signal } from '@angular/core';
import { CanDeactivateFn } from '@angular/router';

import { FormularioEnCursoService } from './formulario-en-curso.service';

/**
 * Protege un formulario de solicitud mientras se crea o edita:
 * - mientras `enCurso` es verdadero, enciende `FormularioEnCursoService` (el armazón bloquea la navegación);
 * - al salir de la página (Cancelar, flecha atrás del navegador) con datos o cambios sin grabar (`pendiente`), abre el
 *   modal «¿Cancelar documento?» y espera la respuesta (`salidaProtegidaGuard`).
 *
 * Se crea como campo del componente: `readonly salida = new SalidaProtegida(() => …, () => …)`.
 */
export class SalidaProtegida {
  /** Modal «¿Cancelar documento?» abierto. */
  readonly modalAbierto = signal(false);
  private resolver: ((salir: boolean) => void) | null = null;
  private libre = false;

  constructor(
    private readonly enCurso: () => boolean,
    private readonly pendiente: () => boolean,
  ) {
    const formulario = inject(FormularioEnCursoService);
    effect(() => formulario.activo.set(this.enCurso()));
    inject(DestroyRef).onDestroy(() => {
      formulario.activo.set(false);
      this.responder(false);
    });
  }

  /** `true` si se puede salir ya; si hay datos sin grabar, abre el modal y resuelve con la respuesta. */
  confirmar(): boolean | Promise<boolean> {
    if (this.libre || !this.pendiente()) return true;
    if (this.resolver) return false;
    this.modalAbierto.set(true);
    return new Promise<boolean>((resolver) => (this.resolver = resolver));
  }

  /** Respuesta del modal: Aceptar descarta y sale; Cancelar o la X siguen en el formulario. */
  responder(salir: boolean): void {
    this.modalAbierto.set(false);
    const resolver = this.resolver;
    this.resolver = null;
    resolver?.(salir);
  }

  /** Tras grabar: la navegación que sigue no pregunta. */
  permitirSalida(): void {
    this.libre = true;
  }
}

/** Componente con `salida`: lo usa el guard de sus rutas. */
export interface ConSalidaProtegida {
  readonly salida: SalidaProtegida;
}

/** Pregunta antes de dejar una solicitud con datos sin grabar. El cierre de sesión (ir al login) no pregunta. */
export const salidaProtegidaGuard: CanDeactivateFn<ConSalidaProtegida> = (componente, _ruta, _estado, siguiente) =>
  siguiente?.url.startsWith('/login') ? true : (componente?.salida?.confirmar() ?? true);
