import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';

import { FormTableSearchComponent } from './form-table-search.component';

/**
 * Buscador de tablas y paneles de selección (18 usos). Desde el cambio a
 * búsqueda confirmada, `valueChange` se emite con Enter o la lupa — no por
 * tecleo. Sus consumidores heredan el comportamiento sin cambiar una línea.
 */
describe('FormTableSearchComponent', () => {
  let fixture: ComponentFixture<FormTableSearchComponent>;
  let component: FormTableSearchComponent;
  let emitted: string | undefined;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FormTableSearchComponent] }).compileComponents();
    fixture = TestBed.createComponent(FormTableSearchComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    emitted = undefined;
    component.valueChange.subscribe(v => (emitted = v));
  });

  function input(): HTMLInputElement {
    return fixture.debugElement.query(By.css('input')).nativeElement as HTMLInputElement;
  }

  it('tipear NO emite: la búsqueda se confirma con Enter o la lupa', () => {
    input().value = '1.1.5';
    input().dispatchEvent(new Event('input'));

    expect(emitted).toBeUndefined();
  });

  it('Enter emite lo tecleado', () => {
    input().value = '1.1.5';
    input().dispatchEvent(new Event('input'));
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(emitted).toBe('1.1.5');
  });

  it('la lupa emite igual que Enter', () => {
    input().value = 'provisiones';
    input().dispatchEvent(new Event('input'));

    const lupa = fixture.debugElement.query(By.css('button[aria-label="Buscar"]')).nativeElement as HTMLButtonElement;
    lupa.click();

    expect(emitted).toBe('provisiones');
  });

  it('confirmar sin haber tecleado emite el value del padre', () => {
    fixture.componentRef.setInput('value', 'previo');
    fixture.detectChanges();

    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(emitted).toBe('previo');
  });

  it('los botones de filtro y más opciones siguen emitiendo aparte', () => {
    let filtro = false;
    component.filter.subscribe(() => (filtro = true));

    const btn = fixture.debugElement.query(By.css('button[aria-label="Filtrar"]')).nativeElement as HTMLButtonElement;
    btn.click();

    expect(filtro).toBeTrue();
    expect(emitted).toBeUndefined();
  });

  const iconoDe = (boton: HTMLElement): string => boton.querySelector('siaf-icon')?.textContent?.trim() ?? '';

  it('por defecto el segundo botón es Más opciones (more_vert) y emite more', () => {
    let mas = false;
    component.more.subscribe(() => (mas = true));
    const segundo = fixture.nativeElement.querySelector('button[data-accion]') as HTMLButtonElement;

    expect(segundo.getAttribute('aria-label')).toBe('Mas opciones');
    expect(iconoDe(segundo)).toBe('more_vert');
    segundo.click();
    expect(mas).toBeTrue();
  });

  it('variant="reports" (Consultas y reportes): Filtrar y Columnas, que emite columns y no more', () => {
    let columnas = false;
    let mas = false;
    component.columns.subscribe(() => (columnas = true));
    component.more.subscribe(() => (mas = true));
    fixture.componentRef.setInput('variant', 'reports');
    fixture.detectChanges();

    const botones = Array.from(fixture.nativeElement.querySelectorAll('button[aria-label]')) as HTMLButtonElement[];
    expect(botones.map((b) => b.getAttribute('aria-label'))).toEqual(['Buscar', 'Filtrar', 'Ocultar o mostrar columnas']);
    const segundo = fixture.nativeElement.querySelector('button[data-accion="columns"]') as HTMLButtonElement;
    expect(iconoDe(segundo)).toBe('view_column');
    segundo.click();
    expect(columnas).toBeTrue();
    expect(mas).toBeFalse();
  });

  describe('en vivo (live)', () => {
    let emitidos: string[];
    beforeEach(() => {
      emitidos = [];
      component.valueChange.subscribe((v: string) => emitidos.push(v));
      fixture.componentRef.setInput('live', true);
      fixture.detectChanges();
    });

    const escribir = (texto: string) => {
      const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
      input.value = texto;
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };

    it('filtra mientras se escribe desde 3 letras y avisa si faltan', () => {
      escribir('ca');
      expect(emitidos).toEqual([]);
      expect(fixture.nativeElement.textContent).toContain('Escribe al menos 3 letras para buscar');
      escribir('can');
      expect(emitidos).toEqual(['can']);
      expect(fixture.nativeElement.textContent).not.toContain('Escribe al menos');
    });

    it('muestra la lupa al inicio y, con texto, «Limpiar búsqueda» que borra todo', () => {
      expect(fixture.nativeElement.querySelector('button[aria-label="Limpiar búsqueda"]')).toBeNull();
      escribir('canon');
      const limpiar = fixture.nativeElement.querySelector('button[aria-label="Limpiar búsqueda"]') as HTMLButtonElement;
      limpiar.click();
      fixture.detectChanges();
      expect(emitidos).toEqual(['canon', '']);
      expect((fixture.nativeElement.querySelector('input') as HTMLInputElement).value).toBe('');
    });

    it('al bajar del mínimo quita el filtro', () => {
      escribir('canon');
      escribir('ca');
      expect(emitidos).toEqual(['canon', '']);
    });
  });
});
