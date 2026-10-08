# Decisiones técnicas

Formato: opciones → decisión → por qué.

## 1. Expo SDK 57 + Expo Router (src/app)
Proyecto gestionado con CNG (sin carpetas ios/android en el repo). Rutas tipadas activadas.
Funciona en Expo Go durante la Fase 1; development builds/EAS cuando haya módulos nativos propios.

## 2. Estado: Zustand + TanStack Query
- Opciones: Redux Toolkit, solo Context, Zustand, TanStack Query.
- **Decisión**: Zustand para estado de cliente (preferencias, sesión, ajustes) y TanStack Query para
  datos de dominio.
- **Por qué**: TanStack Query aporta caché, estados loading/error y invalidación; al pasar a backend
  los hooks no cambian. Zustand es mínimo (~1 KB) y sin boilerplate.

## 3. Persistencia local: AsyncStorage detrás de `Repository<T>`
- Opciones: expo-sqlite, MMKV, WatermelonDB, AsyncStorage.
- **Decisión**: AsyncStorage en la Fase 1, siempre detrás de `KeyValueStore`/`Repository`.
- **Por qué**: funciona igual en iOS/Android/Web y en Expo Go, sin configuración extra
  (expo-sqlite en web requiere WASM y cabeceras COOP/COEP; MMKV requiere build nativo).
  Volúmenes de la Fase 1 son pequeños. **Revisar en Fase 4/5** (eventos recurrentes, muchas tareas):
  migrar a SQLite implementando la misma interfaz.

## 4. Autenticación: `AuthGateway` con implementación local
- Opciones: Supabase Auth, Firebase Auth, Clerk, backend propio.
- **Decisión Fase 1**: `LocalAuthGateway` (cuentas en el dispositivo, contraseña con sal + hash iterado).
- **Recomendación Fase 9**: **Supabase** (Postgres + RLS para compartición/permisos, Auth con Google y
  Apple, Storage, Realtime para sincronización). Encaja con calendarios/familia compartidos y es
  sustituible gracias a la interfaz.
- Google/Apple se muestran **deshabilitados con explicación**: verificar ID tokens requiere backend.

## 5. i18n: i18next + react-i18next
Estándar de facto, plurales, interpolación. Catálogo en TS: `en` tipado contra `es` (clave que falta
= error de compilación) y `npm run check:i18n` valida las claves usadas en el código.

## 6. Navegación adaptativa con Tabs + barra propia
`Tabs` de expo-router con `tabBar` personalizado y `tabBarPosition` dinámico: una única definición
de rutas da sidebar en escritorio/tablet y barra inferior + "Más" en móvil. Mantiene el estado por pestaña.

## 7. Diálogos propios en lugar de `Alert.alert`
`Alert.alert` no funciona en react-native-web. `DialogProvider` (confirmar/pedir texto) y
`ToastProvider` dan la misma experiencia accesible en las 3 plataformas.

## 8. Fechas sin librería
`Intl` (disponible en Hermes y navegadores) para formato localizado; días como `DateKey` (YYYY-MM-DD)
para evitar desfases de zona horaria. Revisar si la Fase 4 (recurrencias RRULE) justifica `rrule`/`date-fns`.

## 9. Campos de fecha/hora como texto validado
Los date pickers nativos no existen en web. `DateField`/`TimeField` con validación y atajos
(Hoy/Mañana) funcionan igual en todas partes. En Fase 4 se puede añadir picker nativo en iOS/Android.

## 10. 2ndBrain: metadatos en AUN, binarios en el proveedor
Opciones: replicar el árbol de carpetas en cada proveedor vs. carpetas como metadatos.
**Decisión**: metadatos. Mover/renombrar carpetas es instantáneo y offline, la búsqueda (y en el futuro
etiquetas/OCR/IA) trabaja sobre AUN, y migrar entre proveedores es mover binarios planos.
El contrato `StorageProvider` mantiene los métodos de carpetas para una opción futura de "espejo".

## 11. Almacenamiento local en web: IndexedDB
`expo-file-system` no existe en web. Los archivos se guardan como Blob en IndexedDB (persisten, funcionan
sin conexión; se solicita almacenamiento persistente al navegador). Límite por archivo: 100 MB en web.

## 12. Google Drive con expo-auth-session
Un solo flujo OAuth estándar para web (token implícito, solo en memoria) e iOS (código + PKCE, refresh
token en Keychain). Android queda pendiente porque Google eliminó los redirects con esquema propio en
Android: requerirá el SDK nativo de Google en un development build. Ver INTEGRATIONS.md.

## 13. Visor: nativo cuando la plataforma lo permite
WKWebView (iOS) muestra PDF/Word/Excel; el navegador muestra PDF; `expo-image` muestra HEIC en iOS/Android.
Donde no hay visor fiable (Android PDF/Office, HEIC en web) se ofrece "Abrir con…"/Descargar con una
explicación, en vez de añadir librerías pesadas (pdf.js) en esta fase.

## 14. Tests
Jest + `jest-expo` para lógica de negocio y proveedores (con `fetch` simulado). La UI se verifica en el
navegador en cada fase; tests de componentes y E2E cuando la UI se estabilice.

## 15. Dependencias mínimas
Solo: expo-* oficiales, async-storage, zustand, @tanstack/react-query, i18next/react-i18next,
@expo/vector-icons (Feather) y la fuente Inter (solo 4 pesos importados). Dev: eslint (config Expo), prettier.

## 16. Relaciones en ambos sentidos sin acoplar módulos
`LinkSource` (qué se puede vincular) + `RelatedSource` (qué apunta a X). Las páginas de perfil se componen con
lo que aporten los módulos activos; desactivar Calendarios o ToDo simplemente oculta su tarjeta.

## 17. Fotos de los hijos solo en el dispositivo
Las fotos de perfil van siempre al proveedor **Local** (archivos de la app / IndexedDB), nunca a Drive/iCloud,
aunque 2ndBrain use un proveedor en la nube. Son datos sensibles de menores; si en el futuro se sincronizan,
será con una opción explícita.

## 18. Rutinas de "Para mañana"
Los elementos marcados como "Cada día" no se borran al limpiar: se desmarcan solos al día siguiente (reinicio
perezoso al leer la lista, sin tareas en segundo plano). Así la preparación diaria no hay que reescribirla.

## 19. Compartir Familia antes del backend
Se guardan ya las personas, su relación y su rol (Administrador/Editor/Lector) con estado "Pendiente". No se
simula ninguna invitación: se enviarán cuando exista sincronización (Fase 9).

## 20. Correo sin backend (todavía)
Gmail y Outlook se conectan directamente desde la app como clientes públicos OAuth (sin secretos). En web los
tokens viven en memoria (reconectar tras recargar) a cambio de no exponerlos al almacenamiento del navegador.
Cuando exista backend (Fase 9) el intercambio de código y la renovación pasarán al servidor con cookie
httpOnly. Los correos nunca se copian a AUN.

## 21. Estados de accesibilidad con `aria-*`
react-native-web 0.21 ignora `accessibilityState`; se usan las props `aria-checked/selected/disabled/busy`,
que funcionan igual en iOS, Android y Web.

## 22. Notificaciones locales calculadas, no almacenadas
Los avisos se derivan de los datos (eventos, tareas, listas, avisos) cada vez que cambian y se programan
en el dispositivo. Ventajas: sin servidor ni tokens push, sin duplicar datos, y desactivar un módulo o una
fuente lo silencia al momento. Límite: iOS admite 64 pendientes → se programan los 50 próximos y se rehace
la lista al abrir la app. El push remoto (correo nuevo, cambios compartidos) llegará con el backend.

## 23. Sync con una tabla genérica y LWW
Una sola tabla `records(user_id, collection, id, data jsonb, …)` sirve para todos los módulos (añadir un módulo
no requiere migraciones) y RLS la protege con una única regla. Conflictos por fila con *last write wins*;
detección de cambios locales con un flag `dirty` (independiente del reloj) y cursor de servidor con solape.
Si en el futuro hacen falta consultas en servidor (búsqueda, IA), se pueden crear vistas/tablas
especializadas a partir de `data`.

## 24. Supabase sin SDK
Se usan sus APIs REST (Auth y PostgREST) con un cliente mínimo: menos dependencias, mismo comportamiento en
iOS/Android/Web y un contrato (`RemoteStore`, `AuthGateway`) que cualquier API propia puede implementar.

## 25. Estilo visual en tres capas (moderno y legible)
1. **Exterior oscuro** (`#131C2E`, misma familia que el menú lateral `#0B1220`).
2. **Tarjetas crema casi blanco** (`#FBF8F1`) con borde cálido y sombra suave.
3. **Fichas de color** dentro de las tarjetas: cada módulo tiene un color propio y bien distinto (Calendarios
   azul, ToDo verde, 2ndBrain violeta, Familia naranja, Correo rojo, Avisos cian) que se repite en el menú,
   en los iconos de tarjeta y en las fichas de «HOY» (franja superior + fondo tintado).

Implementación: `CanvasScope` (en `Screen`) cambia a colores claros todo lo que se pinta directamente sobre el
fondo oscuro (títulos, etiquetas, chips, botones fantasma); `SurfaceScope` (en Card, Sheet, TextField,
botones, Badge, InfoNote, SegmentedControl) vuelve a la paleta normal. Así ningún componente tiene que saber
sobre qué fondo está. En modo oscuro ambas capas son oscuras y los colores de módulo se aclaran solos.

## 26. Estilos de color elegibles
Configuración → Apariencia ofrece cuatro estilos (Nítido, Bosque, Grafito cálido, Medianoche), guardados como
preferencia del dispositivo junto al tema claro/oscuro. Todos mantienen las tres capas y los colores propios
de cada módulo (identidad constante); solo cambian lienzo, menú, tarjetas y color principal. Añadir un estilo
es añadir una entrada en `src/theme/palettes.ts` (claro, oscuro, lienzo y colores de la vista previa).

## 27. Compras como módulo y calendario por miembro
Compras deja de ser un tipo de elemento de Familia: tiene listas, categorías y tiendas propias, y se
relaciona con los miembros mediante `personId` (fuente `related`). Familia no importa Calendarios: usa el
puente `MemberCalendarBridge` que se conecta en el contenedor, así los módulos siguen desacoplados. Las
actividades guardan el `eventId` de su evento semanal para actualizarlo o borrarlo sin duplicados.

## 28. Firebase como backend alternativo a Supabase
`FirebaseAuthGateway` y `FirebaseRemoteStore` implementan las mismas interfaces que los adaptadores de
Supabase (`AuthGateway`, `RemoteStore`). La elección es automática a partir de las variables de entorno
(`EXPO_PUBLIC_FIREBASE_*`). Firebase > Supabase > local. El SDK de Firebase solo se carga si Firebase
está configurado (import dinámico). Las reglas de Firestore aplican RLS equivalente a las de Supabase.
