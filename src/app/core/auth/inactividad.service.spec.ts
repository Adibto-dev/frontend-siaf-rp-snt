import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { AuthService } from './auth.service';
import { InactividadService, MINUTOS_INACTIVIDAD } from './inactividad.service';

describe('InactividadService', () => {
  const minutos = (n: number) => n * 60_000;
  let auth: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;
  let servicio: InactividadService;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['logout']);
    auth.logout.and.returnValue(of(undefined));
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    servicio = TestBed.inject(InactividadService);
  });

  afterEach(() => servicio.detener());

  it('cierra la sesión y vuelve al login tras los minutos sin uso', fakeAsync(() => {
    servicio.iniciar();
    tick(minutos(MINUTOS_INACTIVIDAD) - 1);
    expect(auth.logout).not.toHaveBeenCalled();
    tick(1);
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { state: { inactividad: true } });
  }));

  it('usar la aplicación reinicia la cuenta', fakeAsync(() => {
    servicio.iniciar();
    tick(minutos(MINUTOS_INACTIVIDAD - 1));
    document.dispatchEvent(new KeyboardEvent('keydown'));
    tick(minutos(MINUTOS_INACTIVIDAD - 1));
    expect(auth.logout).not.toHaveBeenCalled();
    tick(minutos(1));
    expect(auth.logout).toHaveBeenCalledTimes(1);
  }));

  it('detenido, no cierra la sesión', fakeAsync(() => {
    servicio.iniciar();
    servicio.detener();
    tick(minutos(MINUTOS_INACTIVIDAD + 1));
    expect(auth.logout).not.toHaveBeenCalled();
  }));
});
