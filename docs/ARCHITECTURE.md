# Arquitectura de AUN

## Capas

```
UI (pantallas, widgets, componentes)           src/modules/*/…Screen.tsx, components/
   ↓ solo hooks
Hooks / Estado                                  src/modules/*/hooks.ts, src/state/
   ↓ TanStack Query (datos) · Zustand (UI/prefs)
Servicios de dominio                            src/modules/*/service.ts, src/services/
   ↓ solo interfaces
Persistencia / APIs                             Repository<T>, KeyValueStore, SecureValueStore,
                                                StorageProvider, EmailProvider, AuthGateway
```

- Los componentes **nunca** acceden a almacenamiento directamente.
- Las reglas de negocio puras (p. ej. qué tareas son de "Hoy") viven en funciones sin UI
  (`src/modules/todo/selectors.ts`).
- `src/services/container.ts` es la **raíz de composición**: crea todos los servicios de un usuario.
  Cambiar a backend = sustituir la fábrica `repo()` por un repositorio remoto/sincronizado.

## Sistema modular

Cada módulo exporta un `AppModule` (`src/types/module.ts`) con: id, ruta, icono, color, tipo
(`core`/`feature`), `defaultEnabled`, posición en navegación y sus **contribuciones** a Inicio:

| Campo           | Qué aporta                                                    |
|-----------------|---------------------------------------------------------------|
| `widgets`       | Widgets del dashboard (tamaño por defecto y tamaños permitidos) |
| `todaySummary`  | Su línea en el panel **HOY** (con estado de atención)          |
| `weeklyStats`   | KPIs para el widget **Tu semana**                              |
| `quickActions`  | Accesos "crear…" con su propio formulario (Acciones rápidas)   |
| `search`        | `SearchSource` para la **búsqueda global**                     |
| `linkSources`   | Entidades que otros módulos pueden vincular (documentos, hijos, eventos, tareas…) |
| `alerts`        | `AlertSource`: qué avisa el módulo y cuándo (centro de notificaciones + notificaciones del sistema) |
| `related`       | "¿Qué de este módulo apunta a X?" (eventos/tareas de un hijo) + crear ya vinculado |
| `ai`, `entitlement` | Reservados (IA en standby, planes premium futuros)         |

El dashboard no conoce ningún módulo concreto: solo itera las contribuciones de los módulos activos.

El registro (`src/modules/registry.ts`) es la única lista de módulos. El shell (`src/app/(app)/_layout.tsx`)
lo inyecta en el store de ajustes; navegación, dashboard, ajustes y notificaciones se derivan de ahí.

Cuando un módulo está desactivado:
- desaparece de sidebar / barra inferior (`useNavItems`),
- sus widgets y su línea de HOY no se renderizan (`useDashboardWidgets`, `TodayPanel`),
- sus notificaciones se filtran (`NotificationService.listNotifications`),
- su ruta muestra `ModuleGate` (explica y ofrece reactivar),
- **sus datos no se tocan**.

### Añadir un módulo (ej. Finanzas)

1. `src/modules/finance/` con `meta.ts`, `definition.ts`, `service.ts`, `hooks.ts`, pantalla y widgets.
2. Ruta `src/app/(app)/finance/_layout.tsx` (con `ModuleGate`) + `index.tsx`.
3. Registrar en `src/modules/registry.ts`; servicio en `src/services/container.ts`; textos en `i18n`.

## Navegación

Expo Router + `Tabs` (`expo-router/js-tabs`) con barra personalizada (`AppTabBar`):

| Ancho            | Navegación                                    |
|------------------|-----------------------------------------------|
| < 768 (móvil)    | Barra inferior: Inicio + 3 módulos + "Más"    |
| 768–1099 (tablet)| Sidebar en modo rail (iconos)                 |
| ≥ 1100 (desktop) | Sidebar completo (contraíble, preferencia persistida) |

Autenticación: `Stack.Protected` en `src/app/_layout.tsx` separa `(auth)` y `(app)`.

## Datos y persistencia (Fase 1)

- `KeyValueStore` (AsyncStorage → localStorage en web) + `LocalRepository<T>`: un documento JSON
  por (usuario, colección), caché en memoria y escrituras serializadas.
- Entidades con `id` UUID cliente, `ownerId`, `createdAt`, `updatedAt` y **borrado lógico** (`deletedAt`)
  → preparadas para sincronización (Fase 9).
- Claves con espacio de nombres y versión: `aun:v1:u:<userId>:<colección>`.

## 2ndBrain y almacenamiento

```
SecondBrainService ──► StorageService ──► getStorageProvider(id)
   (metadatos)            (activo / por documento)   ├─ LocalStorageProvider   (.ts nativo · .web.ts IndexedDB)
                                                      ├─ GoogleDriveStorageProvider (REST v3 + OAuth)
                                                      └─ ICloudStorageProvider  (preparado)
```

- Metadatos (carpetas, documentos) en AUN; binarios en el `StorageProvider` activo.
- Los documentos nuevos van al proveedor **activo**; cada documento guarda `storage.providerId`, así que
  siempre se abre desde donde se guardó (cambiar de proveedor no rompe nada).
- Las carpetas son metadatos (profundidad ilimitada, mover/renombrar instantáneo): los binarios se guardan
  planos en la raíz del proveedor (`AUN/` en Drive).
- Visor por plataforma: `DocumentViewer.tsx` (nativo) y `DocumentViewer.web.tsx`.
- `StorageProvider` (`src/storage/providers/types.ts`) define initialize/authenticate/upload/download/
  delete/move/rename/list/createFolder/deleteFolder/moveFolder/search/getFileMetadata/disconnect.
- Un único proveedor activo por usuario (`settings.secondBrain.storageProvider`); cambiarlo avisa de
  que los documentos no se mueven. `StorageMigrationPlan` reserva el contrato para "Migrar documentos".
- Disponibilidad por plataforma en `descriptors.ts` (iCloud solo iOS). Las implementaciones llegan en la Fase 3.

## Relaciones, búsqueda global e IA (preparado)

- `EntityRef` enlaza cualquier entidad con cualquier otra (documento↔tarea, evento↔hijo…). Las referencias se
  guardan en la entidad que vincula (`event.attachments`, `task.attachments`).
- `LinkSource` (en el módulo destino) lista/resuelve lo que se puede vincular; `RelatedSource` (en el módulo
  origen) responde "qué apunta a X" y ofrece `Create` para crear algo ya vinculado. `RelatedPanel`
  (`src/components/links`) los pinta solo para módulos activos: así el perfil de un hijo muestra sus próximos
  eventos y tareas sin que Familia importe Calendarios ni ToDo y sin duplicar datos.
- `SearchSource` por módulo + `runGlobalSearch` (`src/services/search`): búsqueda en paralelo sobre los
  módulos activos; un módulo que falle no rompe al resto. Preparado para búsqueda en servidor/IA.
- `AIContextSource` / `AIAction` (solo contratos, **sin llamadas a modelos**). Feature flag `ai: false`.

## Permisos y compartición

`src/services/permissions`: roles `owner/admin/editor/viewer`, matriz `can(role, action)` y `ShareGrant`
(invitaciones pendiente/aceptada/rechazada). Reutilizable por calendarios, familia, carpetas y proyectos.
Se activará con el backend.

## Sistema de diseño

`src/theme`: tokens (espaciado, radios, tipografía Inter, tamaños), esquemas claro/oscuro, sombras
(`boxShadow` de la New Architecture) y `makeStyles`. Componentes en `src/components/ui`.
Accesibilidad: roles/labels/estados en todos los controles, objetivos táctiles ≥ 44 pt, contraste AA.
Los estados se declaran con props `aria-checked` / `aria-selected` / `aria-disabled` / `aria-busy` (no con
`accessibilityState`, que react-native-web ya no traslada al DOM): funcionan en iOS, Android y Web.

## Notificaciones (Fase 8)

`AlertSource.list(services, ctx)` calcula los avisos de cada módulo a partir de sus propios datos (nada se
duplica). `collectAlerts` (`src/services/notifications/alerts.ts`) une las fuentes de los módulos activos
respetando las preferencias del usuario. `useAlertScheduler` (montado en el shell) programa las
notificaciones locales con `scheduler.ts` (expo-notifications) o `scheduler.web.ts` (Notification API) y
re-sincroniza tras cada mutación (la query `alerts` se invalida en `useDataMutation`) o al volver a primer
plano. Preferencias en `UserSettings.notifications`.
