import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Observable } from 'rxjs';

import type { LoginResponse } from '../core/api/auth-api.service';
import type { SolicitudResponse } from '../core/api/solicitudes-api.service';
import type { CuentaBancariaDatos, CuentaBancariaRegistro } from '../modules/tesoreria/cuentas-bancarias/models/cuenta-bancaria.model';
import type { SaldoInicialRegistro, SaldosInicialesDatos } from '../modules/tesoreria/saldos-iniciales/models/saldo-inicial.model';
import { mockBackendInterceptor } from './mock-backend.interceptor';
import { reiniciarDatosDemo } from './mock-db';
import { CONTRASENA_DEMO } from './usuarios-demo';

/**
 * El backend simulado sigue las reglas del flujo de una solicitud. Si una clase cambia una regla, este spec dice
 * cuál se rompió.
 */
describe('mockBackendInterceptor', () => {
  const API = '/api/v1';
  let http: HttpClient;
  let red: HttpTestingController;

  const CUENTA: CuentaBancariaDatos = {
    bancoCodigo: '002',
    tipoCuenta: 'CORRIENTE',
    moneda: 'PEN',
    numeroCuenta: '19412345678901',
    denominacion: 'Cuenta de prueba',
    fechaApertura: '2026-09-10',
    esRecaudadora: false,
  };

  /** Resuelve la petición simulada (tiene una latencia de 250 ms) y devuelve la respuesta o el error. */
  function esperar<T>(peticion: Observable<T>): { valor?: T; error?: HttpErrorResponse } {
    const resultado: { valor?: T; error?: HttpErrorResponse } = {};
    peticion.subscribe({ next: (v) => (resultado.valor = v), error: (e: HttpErrorResponse) => (resultado.error = e) });
    tick(300);
    return resultado;
  }

  function entrar(dni: string): HttpHeaders {
    const { valor } = esperar(http.post<LoginResponse>(`${API}/auth/login`, { dni, password: CONTRASENA_DEMO }));
    return new HttpHeaders({ Authorization: `Bearer ${valor!.accessToken}` });
  }

  function archivo(): FormData {
    const form = new FormData();
    form.append('archivo', new File(['%PDF'], 'constancia.pdf', { type: 'application/pdf' }));
    return form;
  }

  beforeEach(() => {
    reiniciarDatosDemo();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([mockBackendInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    red = TestBed.inject(HttpTestingController);
  });

  // Ninguna llamada a la API sale a la red: las responde el simulador.
  afterEach(() => red.verify());

  afterAll(() => reiniciarDatosDemo());

  it('rechaza una contraseña incorrecta con el mensaje que muestra el login', fakeAsync(() => {
    const { error } = esperar(http.post(`${API}/auth/login`, { dni: '45872163', password: 'otra' }));

    expect(error?.status).toBe(401);
    expect(error?.error.message).toContain('DNI o contraseña incorrectos');
  }));

  it('entrega los perfiles del usuario y cambia al que se elige', fakeAsync(() => {
    const { valor } = esperar(http.post<LoginResponse>(`${API}/auth/login`, { dni: '41269587', password: CONTRASENA_DEMO }));
    expect(valor?.perfilesDisponibles.map((p) => p.rolCodigo)).toEqual(['CREADOR', 'APROBADOR']);

    const headers = new HttpHeaders({ Authorization: `Bearer ${valor!.accessToken}` });
    const cambio = esperar(http.patch<{ perfilActivo: { rolCodigo: string } }>(`${API}/auth/cambiar-perfil`, { perfilId: 'perfil-carla-aprobador' }, { headers }));

    expect(cambio.valor?.perfilActivo.rolCodigo).toBe('APROBADOR');
  }));

  it('la bandeja no muestra solicitudes en NUEVO y pagina si se pide', fakeAsync(() => {
    const headers = entrar('45872163');
    esperar(http.post(`${API}/solicitudes`, { tipoAccion: 'creacion', organoLinea: 'OGA', justificacion: 'Borrador' }, { headers }));

    const { valor } = esperar(http.get<{ data: SolicitudResponse[]; total: number }>(`${API}/solicitudes/bandeja-creador?tipos=RTCR&page=1&limit=5`, { headers }));

    expect(valor?.data.length).toBe(5);
    expect(valor?.total).toBe(12);
  }));

  it('recorre el flujo completo: elaborar, verificar y aprobar crea la cuenta y avisa a cada rol', fakeAsync(() => {
    const ana = entrar('45872163');
    const creada = esperar(http.post<SolicitudResponse>(`${API}/solicitudes`, { tipoAccion: 'creacion', organoLinea: 'OGA', justificacion: 'Cuenta nueva' }, { headers: ana }));
    const id = creada.valor!.id;

    // Sin datos ni sustento no se puede elaborar.
    expect(esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: ana })).error?.status).toBe(400);

    esperar(http.post(`${API}/solicitudes/${id}/cuenta-bancaria`, CUENTA, { headers: ana }));
    esperar(http.post(`${API}/solicitudes/${id}/sustentos`, archivo(), { headers: ana }));
    const elaborada = esperar(http.patch<{ numero: string }>(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: ana }));
    expect(elaborada.valor?.numero).toMatch(/^PCB-RTCR-00013-\d{4}-MEF-OGA$/);

    // El creador no puede aprobar.
    expect(esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'APROBADO' }, { headers: ana })).error?.status).toBe(409);
    esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'VERIFICADO' }, { headers: ana }));

    const luis = entrar('70318246');
    const avisos = esperar(http.get<{ titulo: string; documento: { id: string } }[]>(`${API}/notificaciones`, { headers: luis }));
    expect(avisos.valor?.some((n) => n.documento.id === id && n.titulo === 'Solicitud por aprobar')).toBeTrue();

    esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'APROBADO' }, { headers: luis }));

    const registros = esperar(http.get<CuentaBancariaRegistro[]>(`${API}/cuentas-bancarias`, { headers: luis }));
    const cuenta = registros.valor?.find((r) => r.documentoId === id);
    expect(cuenta?.codigo).toBe('CB-0009');
    expect(cuenta?.numeroCuenta).toBe(CUENTA.numeroCuenta);

    const detalle = esperar(http.get<SolicitudResponse>(`${API}/solicitudes/${id}`, { headers: luis }));
    expect(detalle.valor?.historialEstados?.map((h) => h.estadoNuevo)).toEqual(['NUEVO', 'ELABORADO', 'VERIFICADO', 'APROBADO']);

    const avisosAna = esperar(http.get<{ titulo: string; documento: { id: string } }[]>(`${API}/notificaciones`, { headers: ana }));
    expect(avisosAna.valor?.some((n) => n.documento.id === id && n.titulo === 'Solicitud aprobada')).toBeTrue();
  }));

  it('observar pide comentario y una solicitud observada ya no se puede eliminar', fakeAsync(() => {
    const luis = entrar('70318246');
    const bandeja = esperar(http.get<SolicitudResponse[]>(`${API}/solicitudes/bandeja-aprobador?tipos=RTCR`, { headers: luis }));
    const verificada = bandeja.valor!.find((s) => s.estado === 'VERIFICADO')!;

    expect(esperar(http.patch(`${API}/solicitudes/${verificada.id}/estado`, { estadoNuevo: 'OBSERVADO' }, { headers: luis })).error?.status).toBe(400);
    esperar(http.patch(`${API}/solicitudes/${verificada.id}/estado`, { estadoNuevo: 'OBSERVADO', comentario: 'Falta la constancia.' }, { headers: luis }));

    const ana = entrar('45872163');
    esperar(http.patch(`${API}/solicitudes/${verificada.id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: ana }));
    const eliminar = esperar(http.patch(`${API}/solicitudes/${verificada.id}/estado`, { estadoNuevo: 'ELIMINADO' }, { headers: ana }));

    expect(eliminar.error?.status).toBe(409);
    expect(eliminar.error?.error.message).toContain('observada');
  }));

  describe('saldos iniciales (RSIN)', () => {
    const SALDOS: SaldosInicialesDatos = {
      entidadFinanciera: '0001',
      saldos: [{
        id: 'nuevo-1',
        fechaOperacion: '2026-07-13',
        cuentaBancaria: '12073303572000000003',
        moneda: 'USD',
        tipoCambio: 1,
        // Totales inventados: el backend los recalcula desde las libretas.
        importeCuenta: 1,
        importeNacional: 1,
        libretas: [{ idCorrelativo: '000002', importe: 50000 }, { idCorrelativo: '000003', importe: 50000 }],
      }],
    };

    function crearRsin(ana: HttpHeaders): string {
      const tipos = esperar(http.get<{ id: string; codigo: string }[]>(`${API}/tipos-documento`, { headers: ana }));
      const tipo = tipos.valor!.find((t) => t.codigo === 'RSIN')!;
      return esperar(http.post<SolicitudResponse>(`${API}/solicitudes`, { tipoDocumentoId: tipo.id, tipoAccion: 'creacion' }, { headers: ana })).valor!.id;
    }

    it('recalcula los importes, se elabora sin sustento y numera con su propio código', fakeAsync(() => {
      const ana = entrar('45872163');
      const id = crearRsin(ana);
      esperar(http.post(`${API}/solicitudes/${id}/saldos-iniciales`, SALDOS, { headers: ana }));
      const elaborar = esperar(http.patch<{ numero: string }>(`${API}/solicitudes/${id}/estado`, { estadoNuevo: 'ELABORADO' }, { headers: ana }));

      expect(elaborar.valor?.numero).toMatch(/^PCB-RSIN-00005-\d{4}-MEF-OGA$/);
      const saldo = esperar(http.get<SolicitudResponse>(`${API}/solicitudes/${id}`, { headers: ana })).valor!.detalleSaldosIniciales!.saldos[0];
      expect(saldo.importeCuenta).toBe(100000);
      expect(saldo.tipoCambio).toBeGreaterThanOrEqual(3.39);
      expect(saldo.tipoCambio).toBeLessThanOrEqual(3.45);
      expect(saldo.importeNacional).toBe(Math.round(100000 * saldo.tipoCambio * 100) / 100);
    }));

    it('rechaza una cuenta bancaria de otra entidad financiera o repetida', fakeAsync(() => {
      const ana = entrar('45872163');
      const id = crearRsin(ana);
      const otraEntidad = esperar(http.post(`${API}/solicitudes/${id}/saldos-iniciales`, { ...SALDOS, entidadFinanciera: '0018' }, { headers: ana }));
      const repetida = esperar(http.post(`${API}/solicitudes/${id}/saldos-iniciales`, { ...SALDOS, saldos: [SALDOS.saldos[0], { ...SALDOS.saldos[0], id: 'nuevo-2' }] }, { headers: ana }));

      expect(otraEntidad.error?.error.message).toContain('no pertenece');
      expect(repetida.error?.error.message).toContain('no puede repetirse');
    }));

    it('al aprobar, cada saldo recibe su secuencia y pasa a los registros', fakeAsync(() => {
      const luis = entrar('70318246');
      const bandeja = esperar(http.get<SolicitudResponse[]>(`${API}/solicitudes/bandeja-aprobador?tipos=RSIN`, { headers: luis }));
      const verificada = bandeja.valor!.find((s) => s.estado === 'VERIFICADO')!;
      const antes = esperar(http.get<SaldoInicialRegistro[]>(`${API}/saldos-iniciales`, { headers: luis })).valor!.length;

      esperar(http.patch(`${API}/solicitudes/${verificada.id}/estado`, { estadoNuevo: 'APROBADO' }, { headers: luis }));

      const registros = esperar(http.get<SaldoInicialRegistro[]>(`${API}/saldos-iniciales`, { headers: luis })).valor!;
      const nuevos = registros.filter((r) => r.documentoId === verificada.id);
      expect(registros.length).toBe(antes + nuevos.length);
      expect(nuevos.length).toBeGreaterThan(0);
      expect(nuevos.every((r) => /^\d{6}$/.test(r.secuencia ?? ''))).toBeTrue();
    }));
  });

  it('deja pasar lo que no es de la API (los assets)', () => {
    http.get('assets/datos.json').subscribe();

    red.expectOne('assets/datos.json').flush({});
  });
});
