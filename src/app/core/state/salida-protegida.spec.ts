import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { FormularioEnCursoService } from './formulario-en-curso.service';
import { SalidaProtegida } from './salida-protegida';

@Component({ standalone: true, template: '' })
class FormularioPrueba {
  readonly enCurso = signal(true);
  readonly pendiente = signal(false);
  readonly salida = new SalidaProtegida(() => this.enCurso(), () => this.pendiente());
}

describe('SalidaProtegida', () => {
  let formulario: FormularioPrueba;
  let estado: FormularioEnCursoService;
  let fixture: ReturnType<typeof TestBed.createComponent<FormularioPrueba>>;

  beforeEach(() => {
    fixture = TestBed.createComponent(FormularioPrueba);
    formulario = fixture.componentInstance;
    estado = TestBed.inject(FormularioEnCursoService);
    fixture.detectChanges();
  });

  it('con el formulario en curso bloquea la navegación y la libera al salir', () => {
    expect(estado.activo()).toBeTrue();
    formulario.enCurso.set(false);
    fixture.detectChanges();
    expect(estado.activo()).toBeFalse();
  });

  it('sin datos ni cambios sale sin preguntar', () => {
    expect(formulario.salida.confirmar()).toBeTrue();
    expect(formulario.salida.modalAbierto()).toBeFalse();
  });

  it('con datos sin grabar abre el modal y sale solo si se acepta', async () => {
    formulario.pendiente.set(true);
    const respuesta = formulario.salida.confirmar() as Promise<boolean>;
    expect(formulario.salida.modalAbierto()).toBeTrue();
    formulario.salida.responder(false);
    expect(await respuesta).toBeFalse();

    const otra = formulario.salida.confirmar() as Promise<boolean>;
    formulario.salida.responder(true);
    expect(await otra).toBeTrue();
  });

  it('tras grabar la navegación no pregunta', () => {
    formulario.pendiente.set(true);
    formulario.salida.permitirSalida();
    expect(formulario.salida.confirmar()).toBeTrue();
  });
});
