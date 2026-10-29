import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../../../../core/config/app.config';
import { AutorizacionDatos, AutorizacionRegistro, AutorizacionVigente } from '../models/autorizacion.model';

/** Endpoints del proceso de autorizaciones. En el taller los responde el backend simulado. */
@Injectable({ providedIn: 'root' })
export class AutorizacionesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.api.baseUrl;

  /** Guarda (o reemplaza) la autorización propuesta en el documento. */
  guardarDetalle(solicitudId: string, datos: AutorizacionDatos): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/solicitudes/${solicitudId}/autorizacion`, datos);
  }

  /** Autorizaciones aprobadas: pestaña Registros y selector de la modificación. */
  listarRegistros(): Observable<AutorizacionRegistro[]> {
    return this.http.get<AutorizacionRegistro[]>(`${this.base}/autorizaciones`);
  }

  /** Autorizaciones vigentes para ajustar el saldo inicial del usuario en sesión (una por cuenta). */
  listarVigentes(): Observable<AutorizacionVigente[]> {
    return this.http.get<AutorizacionVigente[]>(`${this.base}/autorizaciones/vigentes`);
  }
}
