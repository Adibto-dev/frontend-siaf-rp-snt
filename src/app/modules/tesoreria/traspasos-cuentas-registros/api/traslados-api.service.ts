import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../../../../core/config/app.config';
import { LibretaSaldo, TrasladoDatos, TrasladoRegistro } from '../models/traslado.model';

/**
 * Endpoints propios del traslado entre cuentas de registros. En el taller los responde el backend simulado
 * (`src/app/mock/mock-backend.interceptor.ts`); con un backend real serían las mismas URLs.
 */
@Injectable({ providedIn: 'root' })
export class TrasladosApiService {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.api.baseUrl;

  /** Guarda (o reemplaza) la cuenta bancaria y los movimientos del documento. */
  guardarDetalle(solicitudId: string, datos: TrasladoDatos): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/solicitudes/${solicitudId}/traslado`, datos);
  }

  /** Cuentas de registro de una cuenta bancaria con su saldo disponible de hoy. */
  listarLibretas(cuentaBancaria: string): Observable<LibretaSaldo[]> {
    return this.http.get<LibretaSaldo[]>(`${this.base}/traslados/libretas`, { params: new HttpParams().set('cuenta', cuentaBancaria) });
  }

  /** Traslados aprobados: pestaña Registros y consulta. */
  listarRegistros(): Observable<TrasladoRegistro[]> {
    return this.http.get<TrasladoRegistro[]>(`${this.base}/traslados`);
  }
}
