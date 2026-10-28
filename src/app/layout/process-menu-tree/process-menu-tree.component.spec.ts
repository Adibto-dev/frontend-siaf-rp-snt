import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProcessMenuTreeComponent } from './process-menu-tree.component';

describe('ProcessMenuTreeComponent', () => {
  let fixture: ComponentFixture<ProcessMenuTreeComponent>;
  const texto = (): string => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    fixture = TestBed.configureTestingModule({ imports: [ProcessMenuTreeComponent] }).createComponent(ProcessMenuTreeComponent);
    fixture.componentRef.setInput('nodes', [
      { id: 'tesoreria', label: 'Tesorería', children: [{ id: 'saldos', label: 'Saldos iniciales' }] },
    ]);
    fixture.detectChanges();
  });

  it('sin coincidencias muestra «Sin resultados» con el texto buscado, en una región que se anuncia', () => {
    fixture.componentInstance.onQuery('xyz');
    fixture.detectChanges();

    expect(texto()).toContain('Sin resultados');
    expect(texto()).toContain('No hay coincidencias para "xyz"');
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="status"]')?.textContent).toContain('Sin resultados');
    expect((fixture.nativeElement as HTMLElement).querySelector('siaf-tree-view')).toBeNull();
  });

  it('con coincidencias (sin distinguir tildes) muestra el árbol y no el mensaje', () => {
    fixture.componentInstance.onQuery('tesoreria');
    fixture.detectChanges();

    expect(texto()).not.toContain('Sin resultados');
    expect((fixture.nativeElement as HTMLElement).querySelector('siaf-tree-view')).not.toBeNull();
  });

  it('lupa al inicio; con texto aparece «Limpiar búsqueda», que vacía la búsqueda y deja el foco en el campo', async () => {
    const el = fixture.nativeElement as HTMLElement;
    const limpiar = () => el.querySelector<HTMLButtonElement>('button[aria-label="Limpiar búsqueda"]');
    expect(limpiar()).toBeNull();

    fixture.componentInstance.onQuery('xyz');
    fixture.detectChanges();
    limpiar()!.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.query()).toBe('');
    expect(limpiar()).toBeNull();
    expect(el.querySelector('siaf-tree-view')).not.toBeNull();
    expect(document.activeElement).toBe(el.querySelector('siaf-input input'));
  });

  it('Escape en el buscador vacía la búsqueda', () => {
    fixture.componentInstance.onQuery('xyz');
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector('siaf-input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();

    expect(fixture.componentInstance.query()).toBe('');
  });
});
