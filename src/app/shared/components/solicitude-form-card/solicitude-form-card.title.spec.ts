import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { SolicitudeFormCardComponent } from './solicitude-form-card.component';

@Component({
  standalone: true,
  imports: [SolicitudeFormCardComponent],
  template: `<siaf-solicitude-form-card title="Asignación financiera"><input id="campo" /></siaf-solicitude-form-card>`,
})
class AnfitrionComponent {}

describe('SolicitudeFormCardComponent — atributo title', () => {
  it('muestra el título pero no deja el title nativo (tooltip) en el elemento', () => {
    const fixture = TestBed.createComponent(AnfitrionComponent);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement.querySelector('siaf-solicitude-form-card');

    expect(host.hasAttribute('title')).toBeFalse();
    expect(host.textContent).toContain('Asignación financiera');
  });
});
