import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../../../../core/config/app.config';
import { SaldoInicialRegistro, SaldosInicialesDatos } from '../models/saldo-inicial.model';

/**
 * Endpoints propios de saldos iniciales. En el taller los responde el backend simulado
 * (`src/app/mock/mock-backend.interceptor.ts`); con un backend real serían las mismas URLs.
 */
@Injectable({ providedIn: 'root' })
export class SaldosInicialesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.api.baseUrl;

  /** Guarda (o reemplaza) la entidad financiera y los saldos del documento. */
  guardarDetalle(solicitudId: string, datos: SaldosInicialesDatos): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/solicitudes/${solicitudId}/saldos-iniciales`, datos);
  }

  /** Saldos aprobados: pestaña Registros. */
  listarRegistros(): Observable<SaldoInicialRegistro[]> {
    return this.http.get<SaldoInicialRegistro[]>(`${this.base}/saldos-iniciales`);
  }
}
