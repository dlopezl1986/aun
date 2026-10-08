# Backend y sincronización (Fase 9)

AUN funciona **sin servidor** (modo local) y pasa a **cuentas en la nube con sincronización** en cuanto se
configuran dos variables. El backend recomendado es **Supabase** (Postgres + Auth); AUN usa solo sus APIs
REST públicas (sin SDK), así que puede sustituirse por una API propia que ofrezca lo mismo.

> AUN Cloud (almacenamiento de documentos propio) **no** forma parte de esta fase.

## Qué hace
- **Cuentas**: email + contraseña (confirmación por email y recuperación de contraseña), y Google / Apple
  mediante el OAuth del propio backend. `SupabaseAuthGateway` sustituye a `LocalAuthGateway`
  automáticamente cuando hay backend configurado.
- **Sincronización offline-first** (`src/services/sync`): cada cambio local marca su fila como pendiente
  (`dirty`, sin depender del reloj); `SyncEngine` sube lo pendiente y baja lo que cambió en el servidor
  desde el último cursor (`server_updated_at`, con ventana de solape). Conflictos: gana el `updatedAt` más
  reciente (también en el servidor). Los borrados son *tombstones*. Se sincroniza al abrir, al volver a la
  app, cada 5 min y 3 s después de cualquier cambio.
- **Migración**: Configuración → Cuenta y sincronización → «Copiar a mi cuenta» copia los datos de una cuenta
  local del dispositivo (incluidos documentos locales y fotos de los hijos) a la cuenta de la nube.

Colecciones sincronizadas: calendarios, eventos, tareas, áreas, proyectos, secciones, etiquetas,
carpetas y documentos (metadatos), hijos, listas de Familia, personas con las que compartir, avisos,
notificaciones y relaciones. **No** se sincronizan las cuentas de correo (sus tokens son de cada
dispositivo) ni los archivos guardados en «Este dispositivo» (para verlos en todas partes, Google Drive).

## Servidor local de AUN (sin cuentas externas)
`server/aun-local-server.mjs` implementa en Node, sin dependencias, la parte de la API que usa la app
(Auth + `records` + `sync_push`). Sirve para usar AUN en **cualquier navegador de este ordenador** (y en otros
dispositivos de la misma red abriendo `http://<ip-del-mac>:8090`) con las mismas cuentas y datos.
- Contraseñas con scrypt + sal (nunca en claro), tokens aleatorios de 1 h con rotación del refresh token,
  datos aislados por usuario, mismas reglas *last write wins* que el SQL de Supabase.
- Datos en `server/data/db.json` (ignorado por git). Copia ese fichero para hacer una copia de seguridad.
- `.env.local` lo activa:
  ```bash
  EXPO_PUBLIC_SUPABASE_URL=http://localhost:8091
  EXPO_PUBLIC_SUPABASE_ANON_KEY=aun-local
  EXPO_PUBLIC_AUTH_ALLOW_USERNAME=1   # permite usuarios sin email
  ```
- Arrancar todo (servidor + web): `npm run local`. Por separado: `npm run server` y `npm run web`.
- Para producción (acceso desde fuera de casa, copias gestionadas) usa Supabase (abajo): la app no cambia.

## Puesta en marcha con Supabase (≈10 min)
1. Crea un proyecto en [supabase.com](https://supabase.com) (el plan gratuito sirve para empezar; la
   decisión de proveedor y plan es tuya).
2. **SQL Editor** → ejecuta `supabase/migrations/20261007000000_aun_sync.sql` (o `supabase db push` con la
   CLI). Crea la tabla `records` con **Row Level Security** y la función `sync_push`.
3. **Authentication → URL Configuration**:
   - *Site URL*: tu dominio web (en desarrollo `http://localhost:8090`).
   - *Redirect URLs*: `http://localhost:8090`, tu dominio y `aun://auth/callback` (móvil).
4. (Opcional) **Authentication → Providers**: activa Google y/o Apple con sus credenciales (se configuran
   en el backend, nunca en la app) y añade `EXPO_PUBLIC_AUTH_PROVIDERS=google,apple`.
5. **Project Settings → API**: copia la *Project URL* y la *anon public key* a `.env.local`:
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```
   La *anon key* es pública por diseño (la seguridad la da RLS). **Nunca** uses la `service_role` key en la
   app.
6. Reinicia `npm start`. La pantalla de acceso usará tu backend; entra o crea una cuenta y, si tenías datos
   locales, cópialos desde Configuración → Cuenta y sincronización.

## Seguridad
- RLS en todas las filas: `auth.uid() = user_id` para leer, crear y actualizar; sin borrado físico.
- `sync_push` es `SECURITY INVOKER` (respeta RLS), fuerza `user_id = auth.uid()`, limita 500 filas por
  llamada y aplica *last write wins* en el propio servidor.
- Sesión: Keychain/Keystore en iOS/Android; en web, almacenamiento del navegador con tokens de acceso de
  corta duración y rotación de refresh tokens (actívala en Auth → Settings). Ver `SECURITY.md`.

## Pendiente (siguientes iteraciones)
- Compartir calendarios y Familia entre cuentas (tabla de permisos + políticas RLS por rol).
- Notificaciones push remotas (correo nuevo, cambios compartidos) con una Edge Function.
- Sesión web con cookie httpOnly a través de una API propia.
- Sincronizar las preferencias del usuario (Inicio, módulos, notificaciones).
