import { DOCUMENT } from '@angular/common';
import { Injectable, NgZone, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from './auth.service';

/** Minutos sin usar la aplicación antes de cerrar la sesión. */
export const MINUTOS_INACTIVIDAD = 15;

const EVENTOS_DE_USO = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;

/**
 * Cierra la sesión tras {@link MINUTOS_INACTIVIDAD} minutos sin usar la aplicación (sin mouse, teclado ni scroll) y
 * vuelve al login, que avisa con un modal por qué se cerró. Lo arranca el armazón (`app-shell`), que solo existe con la sesión iniciada, y lo detiene al
 * destruirse. Los eventos se escuchan fuera de Angular para no disparar la detección de cambios a cada movimiento.
 */
@Injectable({ providedIn: 'root' })
export class InactividadService implements OnDestroy {
  private readonly documento = inject(DOCUMENT);
  private readonly zona = inject(NgZone);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  private temporizador: ReturnType<typeof setTimeout> | null = null;
  private activo = false;
  private readonly alUsar = () => this.reiniciar();

  iniciar(): void {
    if (this.activo) return;
    this.activo = true;
    this.zona.runOutsideAngular(() => {
      for (const evento of EVENTOS_DE_USO) this.documento.addEventListener(evento, this.alUsar, { passive: true, capture: true });
    });
    this.reiniciar();
  }

  detener(): void {
    if (!this.activo) return;
    this.activo = false;
    for (const evento of EVENTOS_DE_USO) this.documento.removeEventListener(evento, this.alUsar, { capture: true });
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = null;
  }

  ngOnDestroy(): void {
    this.detener();
  }

  private reiniciar(): void {
    if (this.temporizador) clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.zona.run(() => this.cerrarSesion()), MINUTOS_INACTIVIDAD * 60_000);
  }

  private cerrarSesion(): void {
    this.detener();
    // El login muestra el aviso «Sesión cerrada por inactividad».
    const alLogin = () => void this.router.navigate(['/login'], { state: { inactividad: true } });
    this.auth.logout().subscribe({ next: alLogin, error: alLogin });
  }
}
