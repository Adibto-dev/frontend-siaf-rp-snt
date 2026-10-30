---
name: flujo-creador
description: Construye o valida el flujo del rol CREADOR en la solicitud de un proceso del SIAF-RP (Crear, Grabar, Editar, Verificar, Eliminar, sustento, backend simulado y notificaciones), tomando como modelo traspasos-cuentas-registros (RTCR). Usar con /flujo-creador o cuando pidan armar o revisar la pantalla de solicitud del creador.
---

# Flujo del creador

Dos modos:

- **construir**: implementa el flujo del creador en un proceso nuevo.
- **validar**: revisa un proceso ya hecho contra la lista de control y reporta qué cumple y qué no.

Solo cubre al **creador normal** (con aprobador). La autorización excepcional (RAUT, creador autorizador) queda fuera.

## 1. Qué preguntar (lo mínimo)

Preguntar solo lo que falte; si el usuario ya lo dijo, no repetir.

1. **Modo**: ¿construir o validar?
2. **Proceso**: carpeta `modules/<área>/<proceso>/`. En modo validar, basta con esto.
3. Solo en modo construir:
   - **Campos del formulario** (nombre, tipo, obligatorio, validación). Si hay diseño, la URL de Figma con `node-id`
     reemplaza esta pregunta (leerla con `get_design_context` y adaptar a los componentes del kit).
   - **Código y nombre del documento** (p. ej. `RTCR`, «Solicitud de Registro de…»). Si no lo dan, proponerlo.

Antes de escribir código, resumir lo entendido y confirmar (regla del proyecto).

## 2. Reglas del flujo (las impone el backend simulado)

Fuente: `TRANSICIONES` en `src/app/mock/mock-backend.interceptor.ts` y su spec.

| Estado actual | El creador puede pasar a |
| --- | --- |
| `NUEVO` | `ELABORADO` (Grabar) |
| `ELABORADO` | `ELABORADO` (volver a grabar), `VERIFICADO`, `ELIMINADO` |
| `OBSERVADO` | `ELABORADO` (corregir), `VERIFICADO` |

- **Grabar** = crear solicitud (`solicitudesFacade.crearSolicitud`, solo si es nueva) → guardar detalle del proceso →
  subir sustento (`sustentosApi.subir(id, archivo, 'sustento')`) → `cambiarEstado(id, 'ELABORADO')`.
  Al elaborar se genera el número (`PCB-<CODIGO>-00013-2026-…`). Sin sustento no se elabora.
- Volver a grabar un `ELABORADO` no deja fila en el historial.
- **Editar** solo en `ELABORADO` u `OBSERVADO`; al entrar se toma la foto del formulario.
- **Verificar** en `ELABORADO` u `OBSERVADO`; desde edición con cambios, primero graba y luego verifica.
  Notifica al aprobador («Solicitud por aprobar»).
- **Eliminar** solo desde `ELABORADO` y **nunca** si la solicitud pasó alguna vez por `OBSERVADO`.
- Bandeja del creador: su entidad, sin `NUEVO` ni `REGISTRADO`.

## 3. Modo construir

Modelo a copiar: `src/app/modules/tesoreria/traspasos-cuentas-registros/`
(sobre todo `pages/solicitud/cuenta-bancaria-request.component.ts` y su `.html`). Adaptar, no pegar a ciegas.

1. **Modelo** (`models/<proceso>.model.ts`): `CODIGO_DOCUMENTO`, `NOMBRE_DOCUMENTO`, tipo de datos del detalle y
   catálogos con sus funciones `nombreX()` para el modo lectura.
2. **API** (`api/<proceso>-api.service.ts`): `guardarDetalle(id, datos)` y lo propio del proceso. Mismo contrato que
   `core/api`.
3. **Rutas** (`config/<proceso>.rutas.ts`): `PROCESS_ID`, `PROCESS_ROUTE`, `REQUEST_SEGMENT`.
4. **Backend simulado**: rutas del detalle en `RUTAS` (`mock-backend.interceptor.ts`), datos iniciales en
   `mock-db.ts` (subir `VERSION` si cambia la forma), tipo de documento en `/tipos-documento`. Si se toca una regla,
   actualizar el spec del interceptor.
5. **Pantalla de solicitud** con `siaf-solicitude-page-layout`:
   - Estado en `signal()`/`computed()`, `OnPush`, `inject()`, `@if`/`@for`.
   - `estado`, `soloLectura`, `puedeVerificar`, `headerState` y `estadoDocumento` derivados de la respuesta.
   - Formulario editable y vista de lectura (`siaf-readonly-field`).
   - Justificación con mínimo de caracteres (`cumpleMinimoTextoLibre`).
   - Sustento con `siaf-upload-side-nav`, tomado en `(confirmed)`; mostrado con `siaf-uploaded-file-card`.
   - «Grabar» habilitado solo con formulario completo, sustento y cambios (`form-snapshot.util.ts`).
   - Modales de confirmación para Grabar, Verificar y Eliminar; snackbar `creation-elaborated`, `creation-verified`,
     `creation-deleted`. Tras crear, navegar a `/solicitud/:id` con `state: { fromSave: true }`.
   - Historial y trazabilidad con `siaf-detail-history-tabs` y `siaf-action-tracker`.
   - Título y migas: `nombreDeProceso(PROCESS_ID, …)` y `buildProcessBreadcrumbs(PROCESS_ID, ruta)`.
   - Acciones del aprobador con `siaf-request-approval-modals` (aunque la skill no las construya a fondo, la pantalla
     es compartida).
6. **Rutas Angular**: `modules/<área>/<área>.routes.ts` (`solicitud` y `solicitud/:id`) y `app.routes.ts`.
7. **Menú y avisos**: fila en `docs/menu-procesos.xlsx` + `npm run menu:build`; `DATOS_EXTRA_POR_ID`
   (`process-tree.util.ts`); `ROUTE_BY_PROCESO` en `layout/shell/app-shell.component.ts`; `resolveRoute` en
   `layout/notifications-panel` y `layout/tray-notifications-view`.
8. Al terminar, correr el **modo validar** sobre lo construido.

Reglas de diseño: componentes del `/ui-kit` antes que markup propio, colores solo con tokens (`var(--sys-color-*)`),
íconos con `siaf-icon`, botones `filled`/`outline`/`text`, foco con `siafFoco`.

## 4. Modo validar

Revisar el proceso y entregar una tabla **Punto · Cumple (Sí/No/Parcial) · Evidencia (archivo:línea) · Corrección**.
No corregir nada sin aprobación del usuario.

**Backend simulado**
- [ ] Tipo de documento en `/tipos-documento` y rutas del detalle en `RUTAS`.
- [ ] Datos iniciales en `mock-db.ts`; `VERSION` subida si cambió la forma.
- [ ] Ninguna llamada cae en `[mock] Endpoint no simulado`.

**Pantalla**
- [ ] Usa `siaf-solicitude-page-layout`; título y migas salen del menú.
- [ ] Grabar sigue el orden crear → detalle → sustento → `ELABORADO`; navega a `/solicitud/:id` con aviso.
- [ ] Grabar deshabilitado sin datos completos, sin sustento o sin cambios.
- [ ] Editar solo en `ELABORADO`/`OBSERVADO` y con foto del formulario; Cancelar restaura lo grabado.
- [ ] Verificar en `ELABORADO`/`OBSERVADO`; desde edición con cambios graba antes.
- [ ] Eliminar solo en `ELABORADO` y oculto si fue observada.
- [ ] Modales de confirmación y snackbars en Grabar, Verificar y Eliminar.
- [ ] Modo lectura después de elaborar; historial y trazabilidad visibles.
- [ ] Convenciones: standalone, `OnPush`, signals, sin hex crudo, íconos válidos, componentes del kit.

**Integración**
- [ ] Rutas en `<área>.routes.ts` y `app.routes.ts`.
- [ ] Hoja del menú, `ROUTE_BY_PROCESO` y `resolveRoute` en ambos paneles de notificaciones.

**Comandos (todos en verde)**
```bash
npx ng build --configuration=development
npx ng test --watch=false --browsers=ChromeHeadless
npm run ui-kit:check
npm run icons:check
npm run menu:check
```

**Recorrido en el navegador** (`preview_start`, usuario Ana `45872163`, contraseña `Demo-DGTP2026`):
1. Crear documento → llenar → adjuntar PDF → Grabar: recibe número y queda Elaborada.
2. Editar → sin cambios, Grabar deshabilitado → cambiar un campo → Grabar.
3. Verificar: queda Verificada; entrar como Luis (`70318246`): tiene «Solicitud por aprobar».
4. Luis observa con comentario; como Ana: corregir y volver a verificar; Eliminar ya no aparece.
5. Revisar la consola: sin errores ni endpoints no simulados.

## 5. Cierre

- Después de cambiar código: `graphify update .`.
- No commitear salvo que el usuario lo pida (`tipo(scope): descripción`, en español).
