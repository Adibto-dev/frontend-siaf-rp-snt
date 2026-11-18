import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { APP_CONFIG } from '../../../../core/config/app.config';
import { AsignacionDatos, AsignacionRegistro } from '../models/asignacion.model';

/**
 * Endpoints propios de la asignación financiera. Las cuentas de registro con su saldo son las del traslado
 * (`TrasladosApiService.listarLibretas`). En el taller los responde el backend simulado.
 */
@Injectable({ providedIn: 'root' })
export class AsignacionesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.api.baseUrl;

  /** Guarda (o reemplaza) la cuenta bancaria, la periodicidad y las cuentas del documento. */
  guardarDetalle(solicitudId: string, datos: AsignacionDatos): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.base}/solicitudes/${solicitudId}/asignacion`, datos);
  }

  /** Asignaciones aprobadas: pestaña Registros. */
  listarRegistros(): Observable<AsignacionRegistro[]> {
    return this.http.get<AsignacionRegistro[]>(`${this.base}/asignaciones`);
  }
}
