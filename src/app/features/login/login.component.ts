import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { AlertComponent } from '../../shared/ui/alert/alert.component';
import { ButtonComponent } from '../../shared/ui/button/button.component';
import { ListComponent, ListItem } from '../../shared/ui/list/list.component';
import { ModalComponent } from '../../shared/ui/modal/modal.component';
import { SideNavComponent } from '../../shared/ui/side-nav/side-nav.component';
import { TabItem, TabsComponent } from '../../shared/ui/tabs/tabs.component';
import { TextFieldComponent } from '../../shared/ui/text-field/text-field.component';
import { AuthService } from '../../core/auth/auth.service';
import { reiniciarDatosDemo } from '../../mock/mock-db';
import { CONTRASENA_DEMO, USUARIOS_DEMO } from '../../mock/usuarios-demo';

type LoginTab = 'entidades' | 'proveedores';

@Component({
  selector: 'siaf-login',
  standalone: true,
  imports: [AlertComponent, ButtonComponent, ListComponent, ModalComponent, SideNavComponent, TabsComponent, TextFieldComponent],
  template: `
    <main class="flex min-h-screen bg-[var(--sys-color-bg-surfaces-surface)] text-text lg:h-screen lg:overflow-hidden">
      <section class="hidden h-screen flex-[0_0_50%] overflow-hidden lg:block" aria-hidden="true">
        <img class="h-full w-full object-cover" src="assets/figma/login/login-hero.webp" alt="" />
      </section>

      <section class="flex min-h-screen flex-1 items-center justify-center overflow-y-auto px-siaf-lg py-siaf-xxl lg:h-screen lg:min-h-0 lg:flex-[0_0_50%]">
        <div class="flex w-full max-w-[360px] flex-col items-center gap-12">

          <!-- Logos -->
          <header class="flex w-full flex-col items-center gap-siaf-lg">
            <img class="h-[53px] w-[250px] object-contain" src="assets/figma/login/mef-logo.webp" alt="Ministerio de Economia y Finanzas" />
            <img class="h-[54px] w-[174px] object-contain" src="assets/figma/login/siaf-logo-vector.svg" alt="SIAF-RP" />
          </header>

          <section class="flex w-full flex-col items-center gap-siaf-lg">

            <!-- Título + Tabs -->
            <div class="flex w-full flex-col items-center gap-siaf-xs">
              <h1 class="siaf-text-heading-3-bold m-0 leading-none text-[var(--sys-color-text-brand-primary)]">Bienvenido</h1>
              <p class="siaf-text-body-2-medium m-0 text-[var(--sys-color-text-neutral-medium)]">
                Ingresa tus datos para Iniciar sesión
              </p>

              <!-- Tabs: ocultas mientras solo se usa el ingreso de Entidades del Estado (ver mostrarPestanas). -->
              @if (mostrarPestanas) {
                <siaf-tabs
                  class="mt-siaf-xs w-full"
                  ariaLabel="Tipo de usuario"
                  [tabs]="pestanas"
                  [activeId]="activeTab()"
                  [border]="false"
                  [fullWidth]="true"
                  (activeIdChange)="activeTab.set($any($event))"
                />
              }
            </div>

            <!-- Formulario: Entidades del Estado -->
            @if (activeTab() === 'entidades') {
            <form class="flex w-full flex-col items-center gap-5" aria-label="Inicio de sesión" (submit)="$event.preventDefault(); onSubmit()">

              <!-- Input DNI, con las cuentas guardadas (taller: simula el autocompletar del navegador) -->
              <div
                class="relative w-full"
                (focusin)="cuentasAbiertas.set(true)"
                (focusout)="alSalirDelDni($event)"
                (keydown.escape)="cuentasAbiertas.set(false)"
              >
              <siaf-input
                class="block w-full"
                label="DNI"
                type="text"
                inputmode="numeric"
                leadingIcon="badge"
                autocomplete="username"
                [value]="usuario()"
                (valueChange)="usuario.set(textFieldValue($event)); faltanDatos.set(false)"
              />
              @if (cuentasAbiertas()) {
                <div
                  class="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-siaf-sm bg-surface shadow-siaf-elevation-1"
                  role="group"
                  aria-label="Cuentas guardadas en este navegador"
                >
                  <p class="siaf-text-overline-medium m-0 px-siaf-md pt-siaf-xs text-[var(--sys-color-text-neutral-low)]">Cuentas guardadas</p>
                  <siaf-list
                    ariaLabel="Cuentas guardadas"
                    [items]="usuariosDemo"
                    [selectable]="true"
                    [dividers]="true"
                    [selectedId]="usuarioElegido()"
                    (selectedIdChange)="elegirUsuario($event)"
                  />
                </div>
              }
              </div>

              <!-- Input Contraseña -->
              <siaf-input
                class="block w-full"
                label="Contraseña"
                [type]="showPassword() ? 'text' : 'password'"
                leadingIcon="lock"
                [trailingIcon]="showPassword() ? 'visibility_off' : 'visibility'"
                [trailingButtonLabel]="showPassword() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
                autocomplete="current-password"
                [value]="contrasena()"
                (valueChange)="contrasena.set(textFieldValue($event)); faltanDatos.set(false)"
                (trailingAction)="togglePassword()"
              />

              <!-- Error: datos incompletos o autenticación -->
              @if (faltanDatos()) {
                <p class="siaf-text-body-2 w-full rounded-siaf-sm bg-[var(--sys-color-bg-feedback-light-danger)] px-siaf-md py-siaf-xs text-[var(--sys-color-text-feedback-danger)]" role="alert">
                  Ingrese su DNI y contraseña.
                </p>
              } @else if (authService.authError()) {
                <p class="siaf-text-body-2 w-full rounded-siaf-sm bg-[var(--sys-color-bg-feedback-light-danger)] px-siaf-md py-siaf-xs text-[var(--sys-color-text-feedback-danger)]">
                  {{ authService.authError() }}
                </p>
              }

              <!-- Botón Iniciar sesión -->
              <siaf-button
                class="block w-full"
                variant="primary"
                type="submit"
                [disabled]="authService.isLoading()"
              >
                {{ authService.isLoading() ? 'Ingresando...' : 'Iniciar sesión' }}
              </siaf-button>

              <!-- Links inferiores -->
              <div class="flex w-full items-center justify-end">
                <button
                  class="siaf-text-body-2-medium inline-flex min-h-10 items-center justify-center rounded-siaf-md px-siaf-md py-siaf-xs text-[var(--sys-color-text-brand-primary)] transition hover:bg-surface-muted active:bg-[var(--sys-color-bg-states-light-pressed)] focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                  type="button"
                  (click)="goToRecuperarContrasena()"
                >
                  Olvidé mi contraseña
                </button>
              </div>
            </form>
            } <!-- fin @if entidades -->

            <!-- Formulario: Proveedores y Externos -->
            @if (activeTab() === 'proveedores') {
            <div class="flex w-full flex-col gap-5">

              <!-- ID Peru -->
              <button
                class="siaf-text-body-2-medium flex w-full items-center justify-center gap-siaf-xs rounded-siaf-md border border-[var(--sys-color-border-states-enabled)] bg-surface px-siaf-md py-siaf-xs text-[var(--sys-color-text-neutral-medium)] transition hover:bg-surface-muted focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                type="button"
              >
                <!-- ID Peru: fondo rojo, dos vectores posicionados (24×24px base) -->
                <span class="relative inline-block size-6 shrink-0 overflow-hidden rounded-siaf-sm bg-[var(--sys-color-bg-feedback-dark-danger)]">
                  <img class="absolute left-[7.74px] top-[4.65px] h-[14.7px] w-[12.36px]" src="assets/figma/login/id-peru-v1.svg" alt="" />
                  <img class="absolute left-[4.05px] top-[9.35px] h-[7.45px] w-[6.87px]" src="assets/figma/login/id-peru-v2.svg" alt="" />
                </span>
                ID Peru
              </button>

              <!-- Sunat -->
              <button
                class="siaf-text-body-2-medium flex w-full items-center justify-center gap-siaf-xs rounded-siaf-md border border-[var(--sys-color-border-states-enabled)] bg-surface px-siaf-md py-siaf-xs text-[var(--sys-color-text-neutral-medium)] transition hover:bg-surface-muted focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                type="button"
              >
                <!-- Sunat: fondo blanco, dos vectores posicionados -->
                <span class="relative inline-block size-6 shrink-0 overflow-hidden rounded-siaf-sm border border-[var(--sys-color-divider-default)] bg-surface">
                  <img class="absolute left-[8.1px] top-[3.6px] h-[11.25px] w-[11.55px]" src="assets/figma/login/sunat-v1.svg" alt="" />
                  <img class="absolute left-[4.35px] top-[9.3px] h-[11.1px] w-[11.55px]" src="assets/figma/login/sunat-v2.svg" alt="" />
                </span>
                Sunat
              </button>

              <!-- JNE -->
              <div class="relative w-full">
                <button
                  class="siaf-text-body-2-medium flex w-full items-center justify-center gap-siaf-xs rounded-siaf-md border border-[var(--sys-color-border-states-enabled)] bg-surface px-siaf-md py-siaf-xs text-[var(--sys-color-text-neutral-medium)] transition hover:bg-surface-muted focus-visible:outline-solid focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sys-color-border-states-focus)]"
                  type="button"
                  (mouseenter)="jnePopover.set(true)"
                  (mouseleave)="jnePopover.set(false)"
                >
                  <!-- JNE: fondo blanco, dos vectores posicionados -->
                  <span class="relative inline-block size-6 shrink-0 overflow-hidden rounded-siaf-sm border border-[var(--sys-color-divider-default)] bg-surface">
                    <img class="absolute left-[3.9px] top-[3.9px] h-[10.95px] w-[16.35px]" src="assets/figma/login/jne-v1.svg" alt="" />
                    <img class="absolute left-[3.9px] top-[8.4px] h-[11.7px] w-[16.35px]" src="assets/figma/login/jne-v2.svg" alt="" />
                  </span>
                  JNE
                </button>

                @if (jnePopover()) {
                  <div class="absolute bottom-[calc(100%+8px)] left-0 right-0 z-50 rounded-[4px] bg-surface px-siaf-md py-siaf-sm shadow-siaf-elevation-1">
                    <p class="siaf-text-body-2 m-0 text-[var(--sys-color-text-neutral-medium)]">
                      Exclusivo para autoridades electas.<br />
                      Se registra automáticamente al ingresar por primera vez.
                    </p>
                  </div>
                }
              </div>
            </div>
            } <!-- fin @if proveedores -->
          </section>
        </div>
      </section>

      <!-- Taller: opciones de la demo (no son parte del SIAF-RP) en un side nav que abre el botón flotante. -->
      <siaf-button
        class="fixed bottom-siaf-lg right-siaf-lg z-30 rounded-siaf-md bg-surface shadow-siaf-elevation-2"
        variant="outline"
        icon="settings"
        [iconOnly]="true"
        ariaLabel="Opciones de la demo"
        (click)="opcionesAbiertas.set(true)"
      />

      <siaf-side-nav
        [open]="opcionesAbiertas()"
        title="Opciones de la demo"
        [showFooter]="false"
        (closed)="cerrarOpciones()"
      >
        <div class="flex flex-col gap-siaf-md">
          <siaf-list
            ariaLabel="Opciones de la demo"
            [items]="opcionesDemo"
            [selectable]="true"
            [dividers]="true"
            [selectedId]="null"
            (selectedIdChange)="elegirOpcion($event)"
          />
          @if (datosReiniciados()) {
            <siaf-alert
              tone="success"
              description="Se restauraron las solicitudes, las cuentas y las notificaciones iniciales."
              [showClose]="true"
              (closed)="datosReiniciados.set(false)"
            />
          }
        </div>
      </siaf-side-nav>

      <siaf-modal
        [open]="confirmarReinicio()"
        variant="custom"
        title="¿Reiniciar los datos de la demo?"
        description="Se borrará todo lo grabado en la demo (solicitudes, registros y notificaciones) y se restaurarán los datos iniciales."
        confirmLabel="Reiniciar"
        (confirmed)="reiniciarDatos()"
        (canceled)="confirmarReinicio.set(false)"
        (closed)="confirmarReinicio.set(false)"
      />
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  readonly usuario = signal('');
  readonly contrasena = signal('');
  /** Pestañas Entidades del Estado / Proveedores y Externos. Apagadas: en el taller solo se ingresa como entidad. */
  readonly mostrarPestanas = false;
  readonly activeTab = signal<LoginTab>('entidades');
  readonly pestanas: TabItem[] = [
    { id: 'entidades', label: 'Entidades del Estado' },
    { id: 'proveedores', label: 'Proveedores y Externos' },
  ];
  readonly showPassword = signal(false);
  readonly jnePopover = signal(false);

  // ── Taller: cuentas «guardadas en el navegador» (src/app/mock/usuarios-demo.ts) ──
  // Una página no puede escribir en el gestor de contraseñas del navegador: se simula su autocompletar.
  readonly usuariosDemo: ListItem[] = USUARIOS_DEMO.filter((u) => !u.oculto).map((u) => ({
    id: u.dni,
    title: `${u.nombres} ${u.apellidoPaterno} ${u.apellidoMaterno}`,
    description: `${u.rol} · DNI ${u.dni}`,
    leading: { type: 'avatar', initials: `${u.nombres[0]}${u.apellidoPaterno[0]}` },
  }));
  readonly usuarioElegido = signal<string | null>(null);
  readonly datosReiniciados = signal(false);
  readonly cuentasAbiertas = signal(false);
  /** Se pulsó «Iniciar sesión» sin DNI o sin contraseña. */
  readonly faltanDatos = signal(false);

  // Los campos empiezan vacíos: se completan al elegir una cuenta guardada (clic en DNI).
  onSubmit(): void {
    if (!this.usuario().trim() || !this.contrasena()) {
      this.faltanDatos.set(true);
      return;
    }
    this.authService.login(this.usuario().trim(), this.contrasena()).subscribe({
      next: () => void this.router.navigate(['/panel']),
    });
  }

  elegirUsuario(dni: string): void {
    this.llenar(dni);
    this.cuentasAbiertas.set(false);
  }

  /** Cierra las cuentas guardadas cuando el foco sale del DNI y de su lista. */
  alSalirDelDni(evento: FocusEvent): void {
    const destino = evento.relatedTarget as Node | null;
    if (!destino || !(evento.currentTarget as HTMLElement).contains(destino)) this.cuentasAbiertas.set(false);
  }

  private llenar(dni: string): void {
    this.faltanDatos.set(false);
    this.usuarioElegido.set(dni);
    this.usuario.set(dni);
    this.contrasena.set(CONTRASENA_DEMO);
  }

  // ── Taller: opciones de la demo (botón flotante → side nav) ──
  readonly opcionesAbiertas = signal(false);
  readonly confirmarReinicio = signal(false);
  readonly opcionesDemo: ListItem[] = [
    {
      id: 'componentes',
      title: 'Ver componentes',
      description: 'Abre el catálogo de componentes (ui-kit) en otra pestaña.',
      icon: 'widgets',
      trailing: { type: 'icon', icon: 'open_in_new' },
    },
    {
      id: 'reiniciar',
      title: 'Reiniciar datos de la demo',
      description: 'Restaura las solicitudes, las cuentas y las notificaciones iniciales.',
      icon: 'restart_alt',
    },
  ];

  elegirOpcion(id: string): void {
    if (id === 'componentes') {
      // Otra pestaña: el login queda abierto donde estaba.
      window.open(this.router.serializeUrl(this.router.createUrlTree(['/ui-kit'])), '_blank', 'noopener');
    } else if (id === 'reiniciar') {
      this.confirmarReinicio.set(true);
    }
  }

  cerrarOpciones(): void {
    this.opcionesAbiertas.set(false);
    this.datosReiniciados.set(false);
  }

  /** Vuelve a los datos iniciales de la demo (lo que grabaron los usuarios se pierde). */
  reiniciarDatos(): void {
    this.confirmarReinicio.set(false);
    reiniciarDatosDemo();
    this.datosReiniciados.set(true);
  }

  goToRecuperarContrasena(): void {
    void this.router.navigate(['/login/recuperar-contrasena']);
  }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  textFieldValue(value: string | number | string[]): string {
    return Array.isArray(value) ? value.join(', ') : String(value);
  }
}
