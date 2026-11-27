import { TestBed } from '@angular/core/testing';

import { ESTADO } from '../../../core/models/documento.model';
import { DocumentSummaryCardComponent } from './document-summary-card.component';

describe('DocumentSummaryCardComponent', () => {
  function crear(status: string, detailAnchorId: string | null) {
    const fixture = TestBed.createComponent(DocumentSummaryCardComponent);
    fixture.componentRef.setInput('documentNumber', '1234000055-2026');
    fixture.componentRef.setInput('status', status);
    fixture.componentRef.setInput('detailAnchorId', detailAnchorId);
    fixture.detectChanges();
    return fixture;
  }

  const iconos = (el: HTMLElement) => el.querySelectorAll('siaf-button[ariaLabel="Ver detalle e historial"]').length;

  it('en Observado o Rechazado con sección muestra el ícono que lleva al detalle', () => {
    expect(iconos(crear(ESTADO.OBSERVADO, 'detalle-historial').nativeElement)).toBeGreaterThan(0);
    expect(iconos(crear(ESTADO.RECHAZADO, 'detalle-historial').nativeElement)).toBeGreaterThan(0);
  });

  it('sin sección o en otro estado no muestra el ícono', () => {
    expect(iconos(crear(ESTADO.OBSERVADO, null).nativeElement)).toBe(0);
    expect(iconos(crear(ESTADO.ELABORADO, 'detalle-historial').nativeElement)).toBe(0);
  });

  it('al hacer clic avisa a la sección y baja hasta ella', () => {
    const destino = document.createElement('section');
    destino.id = 'detalle-historial';
    destino.scrollIntoView = jasmine.createSpy('scrollIntoView');
    const aviso = jasmine.createSpy('aviso');
    destino.addEventListener('siaf-ver-detalle', aviso);
    document.body.appendChild(destino);

    crear(ESTADO.OBSERVADO, 'detalle-historial').componentInstance.irAlDetalle();

    expect(aviso).toHaveBeenCalled();
    expect(destino.scrollIntoView).toHaveBeenCalled();
    destino.remove();
  });
});
