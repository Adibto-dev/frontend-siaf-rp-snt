import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UploadedFileCardComponent } from './uploaded-file-card.component';

describe('UploadedFileCardComponent', () => {
  let fixture: ComponentFixture<UploadedFileCardComponent>;
  const el = (): HTMLElement => fixture.nativeElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UploadedFileCardComponent] }).compileComponents();
    fixture = TestBed.createComponent(UploadedFileCardComponent);
    fixture.componentRef.setInput('file', { name: 'DocEntregable001.xls', size: 512_000 });
    fixture.detectChanges();
  });

  it('un nombre largo ocupa hasta 2 líneas y se corta con «…», sin ensanchar la tarjeta', () => {
    fixture.componentRef.setInput('file', { name: 'constancia-de-apertura-de-cuenta-bancaria-corriente-recaudadora-banco-de-la-nacion-2026-final-v3.pdf' });
    fixture.detectChanges();
    el().style.display = 'block';
    el().style.width = '280px';
    document.body.appendChild(el());

    const nombre = el().querySelector<HTMLElement>('.line-clamp-2')!;
    const estilo = getComputedStyle(nombre);
    const alto = parseFloat(getComputedStyle(nombre).lineHeight) || parseFloat(estilo.fontSize) * 1.25;
    expect(estilo.webkitLineClamp).toBe('2');
    expect(nombre.clientHeight).withContext('dos líneas como máximo').toBeLessThanOrEqual(Math.ceil(alto * 2) + 1);
    expect(nombre.scrollHeight).withContext('el resto queda oculto').toBeGreaterThan(nombre.clientHeight);
    expect(el().querySelector('div')!.getBoundingClientRect().width).toBeLessThanOrEqual(280);
    el().remove();
  });

  it('sin error muestra el peso y el borde neutro', () => {
    const tarjeta = el().querySelector('div')!;
    expect(el().textContent).toContain('500kb');
    expect(tarjeta.classList).toContain('border-border');
    expect(el().querySelector('[role="alert"]')).toBeNull();
  });

  it('con error pasa al estado fallido: mensaje en lugar del peso y tono de error', () => {
    fixture.componentRef.setInput('error', 'No se pudo cargar el archivo');
    fixture.detectChanges();

    const tarjeta = el().querySelector('div')!;
    expect(tarjeta.classList).toContain('border-[var(--sys-color-border-feedback-danger)]');
    expect(tarjeta.classList).not.toContain('border-border');
    expect(el().querySelector('[role="alert"]')?.textContent?.trim()).toBe('No se pudo cargar el archivo');
    expect(el().textContent).not.toContain('500kb');
  });

  it('un error en blanco no cuenta como fallido', () => {
    fixture.componentRef.setInput('error', '   ');
    fixture.detectChanges();
    expect(el().querySelector('[role="alert"]')).toBeNull();
  });

  it('solo tiene «Quitar archivo» (sin reemplazar ni el ícono repeat), también fallido, y nada en solo lectura', () => {
    fixture.componentRef.setInput('error', 'Formato no permitido');
    fixture.detectChanges();
    const botones = el().querySelectorAll('button');
    expect(botones.length).toBe(1);
    expect(botones[0].getAttribute('aria-label')).toBe('Quitar archivo');
    expect(el().textContent).not.toContain('repeat');

    fixture.componentRef.setInput('readonly', true);
    fixture.detectChanges();
    expect(el().querySelectorAll('button').length).toBe(0);
    expect(el().querySelector('[role="alert"]')).not.toBeNull();
  });
});
