import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AlAparecerDirective } from './al-aparecer.directive';

@Component({
  standalone: true,
  imports: [AlAparecerDirective],
  template: `
    @if (visible()) {
      <section [siafAlAparecer]="activo" [siafAlAparecerFoco]="true">
        <input id="campo" />
      </section>
    }
  `,
})
class AnfitrionComponent {
  readonly visible = signal(false);
  activo = true;
}

describe('AlAparecerDirective', () => {
  let scroll: jasmine.Spy;

  beforeEach(() => {
    scroll = spyOn(window, 'scrollTo');
    spyOn(window, 'requestAnimationFrame').and.callFake((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  function mostrar(activo: boolean) {
    const fixture = TestBed.createComponent(AnfitrionComponent);
    document.body.appendChild(fixture.nativeElement);
    fixture.componentInstance.activo = activo;
    fixture.componentInstance.visible.set(true);
    fixture.detectChanges();
    return fixture;
  }

  it('al aparecer desplaza la página y lleva el foco al primer campo', () => {
    const fixture = mostrar(true);
    expect(scroll).toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('campo');
    fixture.nativeElement.remove();
  });

  it('con la condición en false no se mueve', () => {
    const fixture = mostrar(false);
    expect(scroll).not.toHaveBeenCalled();
    fixture.nativeElement.remove();
  });
});
