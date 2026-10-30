import { ComponentFixture, TestBed } from '@angular/core/testing';

import { READONLY_LEER_MAS_DESDE, ReadonlyFieldComponent } from './readonly-field.component';

describe('ReadonlyFieldComponent (Figma «Readonly forms»)', () => {
  let fixture: ComponentFixture<ReadonlyFieldComponent>;
  const el = (): HTMLElement => fixture.nativeElement;
  const poner = (inputs: Record<string, unknown>): void => {
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ReadonlyFieldComponent] }).compileComponents();
    fixture = TestBed.createComponent(ReadonlyFieldComponent);
    poner({ caption: 'Periodo', value: '2026' });
  });

  it('sin contenedor de edición: ni borde ni fondo, solo caption y valor', () => {
    const caja = el().querySelector('[data-valor]')!.closest('.relative')!;
    expect(caja.className).not.toContain('border');
    expect(caja.className).not.toContain('bg-[var(--sys-color-bg-surfaces-highlight)]');
    expect(el().textContent).toContain('Periodo');
    expect(el().querySelector('[data-valor]')!.textContent!.trim()).toBe('2026');
  });

  it('vacío muestra «--»', () => {
    poner({ value: '  ' });
    expect(el().querySelector('[data-valor]')!.textContent!.trim()).toBe('--');
  });

  it('importe a la derecha, negrita y resaltado', () => {
    poner({ align: 'right', bold: true, highlight: true });
    const valor = el().querySelector('[data-valor]')!;
    expect(valor.classList).toContain('text-right');
    expect(valor.classList).toContain('siaf-text-body-2-bold');
    expect(valor.closest('.relative')!.className).toContain('bg-[var(--sys-color-bg-surfaces-highlight)]');
  });

  it('tags como chips y estado de registro', () => {
    poner({ tags: ['GN', 'GR'] });
    expect(Array.from(el().querySelectorAll('li')).map((li) => li.textContent!.trim())).toEqual(['GN', 'GR']);

    poner({ status: 'Activo' });
    expect(el().querySelector('siaf-record-status-tag')).not.toBeNull();
  });

  it('texto largo: recortado con «Leer más», que lo despliega', () => {
    poner({ multiline: true, value: 'x'.repeat(READONLY_LEER_MAS_DESDE + 1) });
    const boton = el().querySelector('button')!;
    expect(boton.textContent!.trim()).toBe('Leer más');
    expect(el().querySelector('[data-valor]')!.classList).toContain('line-clamp-3');

    boton.click();
    fixture.detectChanges();
    expect(boton.textContent!.trim()).toBe('Leer menos');
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(el().querySelector('[data-valor]')!.classList).not.toContain('line-clamp-3');
  });

  it('texto corto no ofrece «Leer más»', () => {
    poner({ multiline: true, value: 'Breve' });
    expect(el().querySelector('button')).toBeNull();
  });

  it('el ícono info solo aparece con ayuda', () => {
    expect(el().querySelector('[aria-label="Ayuda"]')).toBeNull();
    poner({ help: 'Explicación' });
    expect(el().querySelector('[aria-label="Ayuda"]')).not.toBeNull();
  });
});
