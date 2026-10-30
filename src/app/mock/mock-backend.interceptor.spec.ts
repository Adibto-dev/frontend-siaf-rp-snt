import { HttpClient, HttpErrorResponse, HttpHeaders, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Observable } from 'rxjs';

import type { LoginResponse } from '../core/api/auth-api.service';
import type { SolicitudResponse } from '../core/api/solicitudes-api.service';
import type { CuentaBancariaDatos, CuentaBancariaRegistro } from '../modules/tesoreria/traspasos-cuentas-registros/models/cuenta-bancaria.model';
import { cuentasRegistroDe, type SaldoInicialRegistro, type SaldosInicialesDatos } from '../modules/tesoreria/saldos-iniciales/models/saldo-inicial.model';
import { sumarDias, type AutorizacionRegistro, type AutorizacionVigente } from '../modules/tesoreria/autorizaciones/models/autorizacion.model';
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

  describe('registro automático de saldos de apertura (RASA)', () => {
    it('lo crea el sistema: no se puede crear y ambos roles ven solo los Procesados, con sus registros', fakeAsync(() => {
      const ana = entrar('45872163');
      const luis = entrar('70318246');
      const tipos = esperar(http.get<{ codigo: string }[]>(`${API}/tipos-documento`, { headers: ana })).valor!;
      const deAna = esperar(http.get<SolicitudResponse[]>(`${API}/solicitudes/bandeja-creador?tipos=RASA`, { headers: ana })).valor!;
      const deLuis = esperar(http.get<SolicitudResponse[]>(`${API}/solicitudes/bandeja-aprobador?tipos=RASA`, { headers: luis })).valor!;
      const registros = esperar(http.get<SaldoInicialRegistro[]>(`${API}/saldos-iniciales`, { headers: ana })).valor!;

      expect(tipos.some((t) => t.codigo === 'RASA')).toBeFalse();
      expect(deAna.map((s) => s.estado)).toEqual(['PROCESADO', 'PROCESADO']);
      expect(deLuis.map((s) => s.estado)).toEqual(['PROCESADO', 'PROCESADO']);
      for (const s of deAna) {
        expect(s.numero).toMatch(/^SI-DRSI-\d{5}-\d{4}-MEF-OGA$/);
        const suyos = registros.filter((r) => r.documentoId === s.id);
        expect(suyos.length).toBe(s.detalleSaldosIniciales!.saldos.length);
        expect(suyos.every((r) => r.automatico && r.movimiento === 'SIA001 - Saldo de Apertura' && /^\d{6}$/.test(r.secuencia ?? ''))).toBeTrue();
      }
    }));
  });

  describe('ajuste de saldo inicial (RSIN, tipo de operación 2)', () => {
    it('ajusta una sola cuenta ya registrada: el aprobado crea un registro ASC002 y el saldo original no cambia', fakeAsync(() => {
      const ana = entrar('45872163');
      const bandeja = esperar(http.get<SolicitudResponse[]>(`${API}/solicitudes/bandeja-creador?tipos=RSIN`, { headers: ana })).valor!;
      const registros = esperar(http.get<SaldoInicialRegistro[]>(`${API}/saldos-iniciales`, { headers: ana })).valor!;
      const ajustes = bandeja.filter((s) => s.detalleSaldosIniciales?.saldos.some((x) => x.ajuste));

      expect(ajustes.map((s) => s.estado).sort()).toEqual(['APROBADO', 'APROBADO', 'APROBADO']);
      for (const s of ajustes) {
        const [saldo, ...resto] = s.detalleSaldosIniciales!.saldos;
        expect(resto.length).toBe(0);
        const original = registros.find((r) => r.secuencia === saldo.ajuste!.secuenciaReferencia)!;
        expect(original.cuentaBancaria).toBe(saldo.cuentaBancaria);
        expect(original.ajuste).toBeUndefined();
        expect(original.movimiento).toBe('SI0001 - Saldo Inicial');
        expect(original.importeCuenta).toBe(saldo.ajuste!.saldoInicial);
        const suyo = registros.filter((r) => r.documentoId === s.id);
        expect(suyo.length).toBe(s.estado === 'APROBADO' ? 1 : 0);
        if (suyo[0]) expect(suyo[0].movimiento).toBe('ASC002 - Ajuste del Saldo Inicial');
      }
    }));
  });

  describe('documentos de autorización (RAUT)', () => {
    const ROSA = '46153928';

    function crearRaut(headers: HttpHeaders, tipoAccion: string): { id?: string; status?: number } {
      const tipos = esperar(http.get<{ id: string; codigo: string; accionesPermitidas: { tipoAccion: string }[] }[]>(`${API}/tipos-documento`, { headers })).valor!;
      const tipo = tipos.find((t) => t.codigo === 'RAUT')!;
      expect(tipo.accionesPermitidas.map((a) => a.tipoAccion)).toEqual(['creacion', 'modificacion']);
      const r = esperar(http.post<SolicitudResponse>(`${API}/solicitudes`, { tipoDocumentoId: tipo.id, tipoAccion }, { headers }));
      return { id: r.valor?.id, status: r.error?.status };
    }

    const estado = (headers: HttpHeaders, id: string, estadoNuevo: string) =>
      esperar(http.patch(`${API}/solicitudes/${id}/estado`, { estadoNuevo }, { headers }));

    it('solo el creador autorizador crea documentos RAUT', fakeAsync(() => {
      expect(crearRaut(entrar('45872163'), 'creacion').status).toBe(403);
      expect(crearRaut(entrar(ROSA), 'creacion').id).toBeTruthy();
    }));

    it('la vigencia exige ambas fechas, hasta ≥ desde y como máximo 3 días', fakeAsync(() => {
      const rosa = entrar(ROSA);
      const id = crearRaut(rosa, 'creacion').id!;
      const base = { procedimiento: 'saldos-iniciales', responsable: 'RU41023', cuentaBancaria: '11040103570200000000', estado: 'Activo' };
      const guardar = (extra: object) => esperar(http.post(`${API}/solicitudes/${id}/autorizacion`, { ...base, ...extra }, { headers: rosa }));
      expect(guardar({ fechaDesde: '2026-11-01', fechaHasta: null }).error?.status).toBe(400);
      expect(guardar({ fechaDesde: '2026-11-10', fechaHasta: '2026-11-01' }).error?.status).toBe(400);
      expect(guardar({ fechaDesde: '2026-11-01', fechaHasta: '2026-11-05' }).error?.status).toBe(400);
      expect(guardar({ fechaDesde: '2026-11-01', fechaHasta: '2026-11-04' }).error).toBeUndefined();
    }));

    it('Autorizar (desde NUEVO o ELABORADO) aprueba en un paso: elaborado y aprobado por el creador, verificado por el sistema; vigencia NO deja el registro Inactivo', fakeAsync(() => {
      const rosa = entrar(ROSA);
      const registros = () => esperar(http.get<AutorizacionRegistro[]>(`${API}/autorizaciones`, { headers: rosa })).valor!;
      const antes = registros().length;

      const creacion = crearRaut(rosa, 'creacion').id!;
      const datos = { procedimiento: 'saldos-iniciales', responsable: 'RU41023', cuentaBancaria: '11040103570200000000', estado: 'Activo', fechaDesde: '2026-11-01', fechaHasta: '2026-11-03' };
      expect(esperar(http.post(`${API}/solicitudes/${creacion}/autorizacion`, datos, { headers: rosa })).error).toBeUndefined();
      expect(estado(rosa, creacion, 'ELABORADO').error).toBeUndefined();
      // Otro creador no puede autorizarlo; el creador autorizador lo autoriza desde ELABORADO.
      expect(estado(entrar('45872163'), creacion, 'APROBADO').error?.status).toBe(403);
      expect(estado(rosa, creacion, 'APROBADO').error).toBeUndefined();
      const detalle = esperar(http.get<SolicitudResponse>(`${API}/solicitudes/${creacion}`, { headers: rosa })).valor!;
      expect(detalle.historialEstados!.map((h) => `${h.estadoNuevo}:${h.creador?.nombres}`)).toEqual(['NUEVO:Rosa', 'ELABORADO:Rosa', 'VERIFICADO:SIAF RP', 'APROBADO:Rosa']);
      const nueva = registros().find((r) => r.documentoId === creacion)!;
      expect(registros().length).toBe(antes + 1);
      expect([nueva.estado, nueva.fechaDesde, nueva.fechaHasta]).toEqual(['Activo', '2026-11-01', '2026-11-03']);
      // Un responsable no puede tener otra autorización activa, aunque sea de otra cuenta.
      const otra = crearRaut(rosa, 'creacion').id!;
      expect(esperar(http.post(`${API}/solicitudes/${otra}/autorizacion`, { ...datos, cuentaBancaria: '12073303572000000003' }, { headers: rosa })).error?.error.message).toContain('ya tiene una autorización activa');

      const modificacion = crearRaut(rosa, 'modificacion').id!;
      const vigencia = { ...datos, registroId: nueva.id, tipoModificacion: 'vigencia' };
      const guardarMod = (extra: object) => esperar(http.post(`${API}/solicitudes/${modificacion}/autorizacion`, { ...vigencia, ...extra }, { headers: rosa }));
      // SÍ sin cambiar la fecha hasta no es una modificación.
      expect(guardarMod({}).error?.status).toBe(400);
      // La ampliación es de 2 días como máximo.
      expect(guardarMod({ fechaHasta: '2026-11-06' }).error?.status).toBe(400);
      expect(guardarMod({ fechaHasta: '2026-11-05' }).error).toBeUndefined();
      expect(guardarMod({ estado: 'Inactivo' }).error).toBeUndefined();
      // Autorizar directo desde NUEVO, sin grabar.
      expect(estado(rosa, modificacion, 'APROBADO').error).toBeUndefined();
      expect(esperar(http.get<SolicitudResponse>(`${API}/solicitudes/${modificacion}`, { headers: rosa })).valor!.numero).toBeTruthy();

      const modificada = registros().find((r) => r.id === nueva.id)!;
      expect(registros().length).toBe(antes + 1);
      // NO: queda Inactivo y conserva sus fechas.
      expect([modificada.estado, modificada.fechaDesde, modificada.fechaHasta, modificada.documentoId]).toEqual(['Inactivo', '2026-11-01', '2026-11-03', modificacion]);
      expect(modificada.documentos.map((d) => d.tipoAccion)).toEqual(['creacion', 'modificacion']);
    }));
    function crearRsinAjuste(ana: HttpHeaders): string {
      const tipos = esperar(http.get<{ id: string; codigo: string }[]>(`${API}/tipos-documento`, { headers: ana }));
      const tipo = tipos.valor!.find((t) => t.codigo === 'RSIN')!;
      return esperar(http.post<SolicitudResponse>(`${API}/solicitudes`, { tipoDocumentoId: tipo.id, tipoAccion: 'creacion' }, { headers: ana })).valor!.id;
    }

    it('ajuste: exige una autorización vigente, guarda el neto, uno en curso por cuenta y al aprobarse la autorización queda inactiva', fakeAsync(() => {
      const ana = entrar('45872163');
      const cuenta = '11040103570200000000';
      const [l1, l2] = cuentasRegistroDe(cuenta).map((c) => c.idCorrelativo);
      const ajuste = (id: string) => esperar(http.post(`${API}/solicitudes/${id}/saldos-iniciales`, {
        entidadFinanciera: '0001',
        saldos: [{
          id: 'aj-1', fechaOperacion: '2026-07-17', cuentaBancaria: cuenta, moneda: 'PEN', tipoCambio: 1, importeCuenta: 0, importeNacional: 0,
          libretas: [{ idCorrelativo: l1, importe: 3000, naturaleza: 'Crédito' }, { idCorrelativo: l2, importe: 1000, naturaleza: 'Débito' }],
          ajuste: { naturaleza: 'Crédito', secuenciaReferencia: '', saldoInicial: 0, libretasIniciales: [] },
        }],
      }, { headers: ana }));
      const sinAutorizacion = crearRsinAjuste(ana);
      expect(ajuste(sinAutorizacion).error?.error.message).toContain('autorización vigente');

      const rosa = entrar(ROSA);
      const raut = crearRaut(rosa, 'creacion').id!;
      const hoy = new Date().toISOString().slice(0, 10);
      esperar(http.post(`${API}/solicitudes/${raut}/autorizacion`, { procedimiento: 'saldos-iniciales', responsable: 'RU41023', cuentaBancaria: cuenta, estado: 'Activo', fechaDesde: hoy, fechaHasta: sumarDias(hoy, 2) }, { headers: rosa }));
      expect(estado(rosa, raut, 'APROBADO').error).toBeUndefined();
      const vigentes = () => esperar(http.get<AutorizacionVigente[]>(`${API}/autorizaciones/vigentes`, { headers: ana })).valor!;
      expect(vigentes().map((v) => v.cuentaBancaria)).toEqual([cuenta]);

      const id = crearRsinAjuste(ana);
      expect(ajuste(id).error).toBeUndefined();
      const saldo = esperar(http.get<SolicitudResponse>(`${API}/solicitudes/${id}`, { headers: ana })).valor!.detalleSaldosIniciales!.saldos[0];
      expect([saldo.importeCuenta, saldo.ajuste?.naturaleza]).toEqual([2000, 'Crédito']);
      expect(saldo.ajuste?.saldoInicial).toBeGreaterThan(0);
      // En curso: la autorización sigue vigente (con su documento) y no se crea otro ajuste de la cuenta.
      expect(vigentes().map((v) => v.documentoEnCurso)).toEqual([id]);
      expect(ajuste(id).error).toBeUndefined();
      expect(ajuste(crearRsinAjuste(ana)).error?.error.message).toContain('en curso');
      // Aprobado el ajuste, la autorización termina.
      expect(estado(ana, id, 'ELABORADO').error).toBeUndefined();
      expect(estado(ana, id, 'VERIFICADO').error).toBeUndefined();
      expect(estado(entrar('70318246'), id, 'APROBADO').error).toBeUndefined();
      expect(vigentes()).toEqual([]);
    }));

  });

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

      expect(elaborar.valor?.numero).toMatch(/^SI-DRSI-\d{5}-\d{4}-MEF-OGA$/);
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
