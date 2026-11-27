import { TestBed } from '@angular/core/testing';

import { RequestApprovalModalsComponent } from './request-approval-modals.component';

describe('RequestApprovalModalsComponent', () => {
  function abrir(entrada: 'observeOpen' | 'rejectOpen'): HTMLElement {
    const fixture = TestBed.createComponent(RequestApprovalModalsComponent);
    fixture.componentRef.setInput(entrada, true);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('«¿Observar solicitud?» limita la descripción a 200 caracteres con contador', () => {
    const el = abrir('observeOpen');
    expect(el.querySelector('textarea')?.getAttribute('maxlength')).toBe('200');
    expect(el.textContent).toContain('0/200');
  });

  it('«¿Rechazar solicitud?» limita la descripción a 200 caracteres con contador', () => {
    const el = abrir('rejectOpen');
    expect(el.querySelector('textarea')?.getAttribute('maxlength')).toBe('200');
    expect(el.textContent).toContain('0/200');
  });
});
