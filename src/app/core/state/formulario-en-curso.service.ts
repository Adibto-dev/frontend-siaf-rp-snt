import { Injectable, signal } from '@angular/core';

/**
 * Hay una solicitud en creación o edición. Mientras está activo, el armazón deshabilita la navegación (menú lateral,
 * menú de procesos, menú móvil, notificaciones y cambio de perfil): el foco queda en el formulario. Lo enciende y
 * apaga `SalidaProtegida`.
 */
@Injectable({ providedIn: 'root' })
export class FormularioEnCursoService {
  readonly activo = signal(false);
}
