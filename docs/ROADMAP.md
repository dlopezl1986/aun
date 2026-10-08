# Roadmap

## ✅ Fase 1 — Fundación
- Expo SDK 57, TypeScript estricto, Expo Router, arquitectura por capas y módulos.
- Sistema de diseño (claro/oscuro), componentes base, estados loading/empty/error/success.
- Navegación adaptativa (sidebar / rail / barra inferior + "Más"), dinámica según módulos activos.
- Auth local (registro, login, logout, sesión persistente, perfil); Google/Apple preparados.
- Activar/desactivar módulos sin perder datos; dashboard HOY + widgets configurables (mostrar/ocultar/ordenar).
- Idiomas: español (por defecto) e inglés. Apariencia: claro / oscuro / sistema.
- Funcional con persistencia local:
  - **ToDo**: captura rápida, prioridades P1–P4, Hoy / Bandeja / Próximas / Todas / Completadas.
  - **Calendarios**: múltiples calendarios (color, descripción), visibilidad + "Mostrar todos",
    vista mes y agenda, crear/eliminar eventos (día completo u horario).
  - **2ndBrain**: carpetas con profundidad ilimitada, renombrar, borrar (recursivo, también en lote),
    breadcrumb, buscador por nombre, selección de proveedor de almacenamiento.
  - **Familia**: perfiles de hijos, "Para mañana" y lista de la compra por persona.
  - **Avisos**: avisos manuales con día y hora; centro de notificaciones.
  - **Correo**: arquitectura de proveedores; conexión real en Fase 7 (se indica en la UI).

## ✅ Fase 2 — Dashboard completo
- Modo **Personalizar** en el propio Inicio: reordenar (antes/después), **tamaño S/M/L** por widget,
  ocultar y volver a añadir widgets ocultos; todo persistido por usuario. Restablecer panel.
- Nuevos widgets: **Acciones rápidas** (nueva tarea / evento / aviso / carpeta / añadir a la compra sin salir
  de Inicio), **Próximos 7 días**, **Prioridades**, **Cumpleaños** y **Tu semana** (estadísticas, oculto por defecto).
- **Búsqueda global** en Inicio sobre todos los módulos activos (insensible a tildes/mayúsculas, agrupada por
  módulo, atajo `/` en web).
- Panel HOY con avisos de **atención** (tareas vencidas, avisos vencidos).
- Pull-to-refresh en móvil; la rejilla se pinta desde el primer frame (estimación + medida).
- Pendiente para fases posteriores: arrastrar y soltar (requiere gestos nativos; los controles actuales son
  accesibles y funcionan igual en las 3 plataformas).

## ✅ Fase 3 — 2ndBrain
- Importar documentos desde **Archivos** (todas las plataformas, selección múltiple) y desde **Fotos**
  (iOS/Android, conservando HEIC). Formatos: PDF, PNG, JPG/JPEG, HEIC/HEIF, WEBP, GIF, Word, Excel.
- Visor integrado: imágenes (zoom en iOS), PDF (web e iOS), Word/Excel (iOS); en el resto, explicación +
  "Abrir con…"/Descargar. Nunca una pantalla vacía.
- Renombrar (conserva la extensión), mover (árbol de carpetas sin ciclos), eliminar (también del
  almacenamiento), **selección múltiple** con mover/eliminar en lote, nombres duplicados → "(2)".
- `StorageService` + `StorageProvider`: **Local** (archivos del dispositivo en iOS/Android, IndexedDB en
  web), **Google Drive** (OAuth `drive.file`, web + iOS en development build), **iCloud** preparado.
- Configuración → Almacenamiento: conectar/desconectar, cuenta conectada, documentos por almacenamiento,
  aviso al cambiar de proveedor. Los documentos se abren siempre desde el proveedor donde se guardaron.
- Tests unitarios (Jest + jest-expo): reglas de tareas, fechas, cumpleaños, búsqueda, servicio 2ndBrain y
  proveedor de Drive contra una API simulada.
- Pendiente: Drive en Android (módulo nativo de Google), iCloud (módulo nativo), "Migrar documentos",
  miniaturas.

## ✅ Fase 4 — Calendarios
- Vistas **Día, Semana, Mes y Agenda** con navegación; timeline con horas, eventos solapados en paralelo,
  fila de "todo el día", línea de "ahora" y **tocar una hora libre para crear**. En móvil la semana es una lista.
- Eventos completos: título, calendario, todo el día / varios días, ubicación, participantes, notas,
  recordatorios y **repetición** (diaria, semanal con días, mensual, anual, personalizada con intervalo y fin
  por fecha o nº de veces). Editar la serie, duplicar, borrar "solo este" o "toda la serie".
- **Vínculos entre módulos** (contrato `LinkSource`): adjuntar documentos de 2ndBrain y relacionar hijos de
  Familia; se abren desde el detalle del evento.
- Calendarios con icono opcional, archivado/restauración y explicación del modelo de permisos
  (Administrador/Editor/Lector). Búsqueda global abre directamente el evento.
- Tests: motor de recurrencias y algoritmo de solapamientos (33 tests en total).
- Pendiente: invitaciones y calendarios compartidos (requieren backend, Fase 9); notificaciones de
  recordatorios (Fase 8); picker nativo de fecha/hora.

## ✅ Fase 5 — ToDo
- Jerarquía completa **Áreas → Proyectos → Secciones → Tareas → Subtareas** (crear, renombrar, mover,
  eliminar; borrar un área conserva sus proyectos, borrar un proyecto borra secciones y tareas).
- Vistas: **Hoy** (incluye vencidas), **Bandeja**, **Próximas** (agrupadas por día), **Todas**,
  **Prioridades** (agrupadas P1–P3), **Completadas** (+ "Archivar completadas"), **Proyectos** (con
  secciones) y **Etiquetas**. Panel lateral con contadores en escritorio; chips + navegación en móvil.
  Cada vista tiene URL propia (`/todo?view=…`, `?project=`, `?tag=`, `?task=`).
- **Captura inteligente**: «Comprar pintura viernes p1 #obra @reforma» detecta fecha (hoy/mañana/pasado
  mañana/día de la semana/dd/mm), prioridad, etiquetas (se crean solas) y proyecto, con vista previa.
- **Detalle de tarea**: nombre, descripción, estado (Pendiente/En progreso/Completada/Archivada),
  prioridad, fecha + hora, **repetición** (al completar pasa a la siguiente fecha y reinicia subtareas),
  recordatorios, fecha límite, proyecto/sección, etiquetas, responsable, subtareas, URLs y **vínculos**
  con documentos, eventos e hijos. Los eventos también pueden vincular tareas.
- Tareas compartidas: modelo creador (`ownerId`) + responsable preparado; la asignación a otra cuenta
  llega con el backend (Fase 9).
- Tests: servicio de tareas (jerarquía, repetición, etiquetas) y parser de captura (41 tests en total).
- Pendiente: vista Kanban/calendario, arrastrar para reordenar, notificaciones de recordatorios (Fase 8).

## ✅ Fase 6 — Familia
- **Perfil de cada hijo** (`/family/child/:id`): foto (guardada solo en el dispositivo), edad, próximo
  cumpleaños, colegio y curso, actividades, información importante y notas.
- En el perfil: **Próximos eventos** y **Tareas pendientes** vinculados (de Calendarios y ToDo, sin duplicar
  datos) con "Nuevo evento" / "Nueva tarea" ya vinculados; su "Para mañana" y su lista de la compra.
- **Para mañana**: sugerencias de un toque (mochila, ropa, merienda…) y elementos **"Cada día"** que se
  desmarcan solos al día siguiente; limpiar borra solo lo puntual.
- **Compras**: cantidad, categoría y tienda (con sugerencias de tiendas usadas); agrupar por **persona,
  categoría o tienda**; editar cada elemento.
- **Compartir familia**: personas con relación (pareja, abuelos, cuidadores…) y rol (Administrador / Editor /
  Lector); las invitaciones se enviarán con la sincronización (Fase 9).
- Accesibilidad: los estados (marcado/seleccionado/desactivado) ahora llegan también a los lectores de
  pantalla en web (`aria-*`).
- Tests: rutinas, limpieza, tiendas, borrado de perfiles y validación de personas (47 tests en total).

## ✅ Fase 7 — Correo
- `GmailProvider` (Gmail API) y `OutlookProvider` (Microsoft Graph) reales sobre el contrato
  `EmailProvider`, con OAuth 2.0 (cliente público, PKCE) y **varias cuentas** a la vez.
- **Bandeja unificada** ("Todas las bandejas") + carpetas por cuenta con contadores, paginación,
  búsqueda en todas las cuentas.
- Leer (HTML seguro o texto, adjuntos listados), **redactar, responder, responder a todos, reenviar**,
  mover a la papelera, marcar leído/no leído e importante. Imágenes remotas bloqueadas por defecto.
- Gestión de cuentas: conectar, reconectar, renombrar ("Gmail personal", "Outlook trabajo") y desconectar
  (revoca el acceso, nunca borra correos). Estado real de cada proveedor (sin configurar, Expo Go, Android).
- Inicio: widget con los no leídos y resumen en HOY.
- Buzón **Demo** solo en desarrollo para probar todo sin credenciales.
- Tests: MIME/base64, saneado de HTML, Gmail y Outlook contra API simulada, servicio (tokens, renovación,
  caducidad, reconexión) — 67 tests en total.
- Pendiente: abrir/descargar adjuntos, enviar adjuntos, Gmail en Android (módulo nativo), notificaciones de
  correo nuevo (Fase 8), sesión persistente en web (backend, Fase 9).

## ✅ Fase 8 — Notificaciones
- Contrato `AlertSource` por módulo: **Calendarios** (avisos de cada evento y de cada repetición),
  **ToDo** (recordatorios relativos a la fecha/hora y fechas límite), **Familia** («Para mañana» por la
  noche si queda algo por preparar, cumpleaños la víspera y el día) y **avisos manuales**.
- **Avisos manuales** únicos o **recurrentes** (diario, semanal con días, mensual, anual, personalizado),
  editar, posponer (10 min / 1 h / 3 h / mañana 9:00) y "Hecho" que salta a la siguiente repetición.
- **Centro de notificaciones**: hoy y 7 días, agrupado por día con la hora de cada aviso (pasados
  atenuados), abre el elemento relacionado; contador en el menú de lo ocurrido no visto.
- **Notificaciones del sistema**: iOS/Android con `expo-notifications` (programadas en el dispositivo, sin
  servidor; se re-sincronizan al cambiar datos o volver a la app; límite de 50 pendientes); web con la
  API del navegador mientras la pestaña está abierta; aviso dentro de la app cuando el sistema no lo
  muestra. Tocar una notificación abre su pantalla.
- **Ajustes → Notificaciones**: permiso del sistema (con estado bloqueado/no disponible), activar o
  desactivar cada fuente, hora del aviso «Para mañana». Un módulo desactivado deja de notificar al momento.
- Tests: fuentes de los 4 módulos, preferencias, recurrencia y fallo aislado de una fuente (72 en total).
- Pendiente: avisos de correo nuevo y push remoto (requieren servidor, Fase 9); acciones en la propia
  notificación (posponer desde el banner).

## ✅ Fase 9 — Backend y sincronización (lista para conectar)
- Motor de sincronización **offline-first** (`SyncEngine`): cambios marcados como pendientes sin depender
  del reloj, subida por lotes, bajada por cursor de servidor con solape, *last write wins* por fila,
  borrados como *tombstones*, idempotente. Sincroniza al abrir, al volver, cada 5 min y tras cada cambio.
- Adaptador **Supabase** sin SDK (REST): `SupabaseAuthGateway` (email/contraseña con confirmación y
  recuperación, Google/Apple por OAuth del backend, perfil, sesión en Keychain/Keystore) y
  `SupabaseRemoteStore`. Se activa solo con `EXPO_PUBLIC_SUPABASE_URL` + anon key; sin ellas, modo local.
- Esquema SQL con **Row Level Security** y función `sync_push` con LWW (`supabase/migrations`).
- **Migración** de los datos de una cuenta local (con documentos locales y fotos) a la cuenta de la nube.
- Configuración → **Cuenta y sincronización**: estado, última sincronización, cambios pendientes,
  sincronizar ahora, copiar datos locales.
- Tests: dos dispositivos, borrados, conflictos, sin conexión, migración, REST con renovación de token y
  autenticación (79 en total). Guía: `docs/BACKEND.md`.
- Pendiente: crear el proyecto de backend (decisión tuya), compartir entre cuentas con roles, push remoto,
  sincronizar preferencias.

## Ampliación — Compras y miembros de Familia (2026-10-08)
- **Compras**, módulo propio (sale de Familia): varias listas, 17 categorías incluidas + categorías propias
  (emoji y color), alta rápida «2 leche #lácteos @mercadona», agrupar por categoría/tienda/persona,
  «Volver a comprar», comprados archivados, widget e Inicio. Migra una vez la lista antigua de Familia.
- **Miembros de Familia** (hijos, pareja, padres, abuelos…): foto (también al crearlos), contacto,
  colegio o trabajo, tallas (predefinidas + propias), salud, datos extra.
- Cada miembro tiene **su calendario** en Calendarios (se renombra/recolorea con él y se archiva al quitarlo).
  Sus **actividades con días** son eventos semanales en ese calendario; los eventos creados desde su ficha
  van a su calendario. Creación idempotente (sin calendarios duplicados).

## Fase 10 — IA
Asistente sobre `AIContextSource`/`AIAction`, ejecutado en backend.

## Despliegue — Firebase + GitHub Pages (2026-10-08)
- **Firebase Authentication** (correo y contraseña; opcionalmente Google).
- **Firestore** como base de datos en la nube, con reglas de seguridad por usuario.
- **GitHub Pages** para servir la web (GitHub Actions en cada push a `main`).
- Guía paso a paso en `docs/DEPLOY.md`.

## Calendarios — vista de día y notas del día (2026-10-08)
- Vista **Día → Lista**: notas del día arriba y cada evento como tarjeta con su nombre (y la hora en
  pequeño). «Por horas» mantiene la cuadrícula horaria.
- **Mes**: el nombre de cada evento y las notas dentro de la casilla del día (+N más).
- **Notas del día** (tipo pósit): texto, color, marcar como hecha y aviso opcional a una hora
  (Notificaciones). Aparecen en Mes, Semana, Día, Agenda, en «Hoy» de Inicio y en la búsqueda.
- Eventos: **Descripción** (bajo el título) y **Notas** separadas; las dos se ven en la ficha del evento.

## Calendarios — turnos y días de la semana (2026-10-08)
- Formulario de evento: **Turno** (Mañana 07–15, Tarde 15–23, Noche 23–07; la hora se puede cambiar y se
  recuerda) y **Repetir estos días** (días de la semana, hasta fin de mes / una fecha / sin fin).
- Vista **Mes**: tocar un evento o una nota dentro de la casilla lo abre directamente (con «Editar»).
- **Color propio por evento** (p. ej. cada turno de un color): el color del evento es el relleno y el del
  calendario (la persona) queda como franja lateral. Los turnos traen color por defecto (mañana ámbar,
  tarde violeta, noche pizarra), editable y recordado. En las casillas pequeñas se ve «Mañana/Tarde/Noche».
