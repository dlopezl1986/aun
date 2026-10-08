# Seguridad

## Principios
- Ninguna API key ni secreto en el frontend. Solo identificadores públicos `EXPO_PUBLIC_*`.
- Nunca se piden ni guardan contraseñas de Google, Microsoft o Apple: siempre OAuth 2.0.
- Permisos mínimos (Google Drive: `drive.file`; Gmail/Outlook: los estrictamente necesarios).
- Desconectar un proveedor nunca borra documentos ni datos del usuario.

## Fase 1 (modo local)
- Cuentas locales: contraseña con **sal aleatoria de 128 bits + SHA-256 iterado (2000 rondas)**,
  comparación en tiempo constante, nunca en texto plano. Adecuado para proteger un perfil local;
  **no sustituye** al hash de servidor (argon2id/bcrypt) del backend.
- Sesión: en iOS/Android se guarda en **Keychain/Keystore** (`expo-secure-store`). En web no existe
  almacén seguro: solo se guarda una referencia opaca a la sesión local, nunca tokens de terceros.
- Datos de dominio en AsyncStorage/localStorage **sin cifrar** (como cualquier app local). El cifrado en
  reposo y la sincronización llegarán con el backend.
- Recuperación de contraseña: no disponible para cuentas locales (se informa al usuario).

## Google Drive (Fase 3)
- Scope mínimo `drive.file`: AUN solo accede a los archivos que crea.
- iOS: refresh token en Keychain; renovación automática; revocación al desconectar.
- Web: token de acceso **solo en memoria** (no localStorage/sessionStorage); caduca en ~1 h o al cerrar
  la pestaña. Sin client secret en la app (no hace falta con PKCE/token implícito).
- Borrar un documento lo envía a la papelera de Drive; desconectar nunca borra archivos.

## Correo (Fase 7)
- OAuth 2.0 de Google/Microsoft como cliente público (PKCE / token implícito en web para Google); nunca
  se pide ni se guarda la contraseña y no hay client secret en la app.
- Tokens por cuenta fuera de los metadatos de la cuenta (Keychain/Keystore; memoria en web). Desconectar
  revoca el acceso (Google) y borra los tokens; nunca borra correos.
- Scopes mínimos para las funciones ofrecidas: Gmail `gmail.modify` + `gmail.send` (sin borrado
  definitivo); Graph `Mail.ReadWrite` + `Mail.Send`. Eliminar = mover a la papelera.
- Renderizado del HTML: iframe con `sandbox` sin `allow-scripts` (web) / WebView con JavaScript
  desactivado (nativo), CSP `default-src 'none'`, saneado adicional (scripts, iframes, formularios,
  manejadores `on*`, `javascript:`), imágenes remotas bloqueadas por defecto (píxeles de seguimiento) y
  `referrerPolicy=no-referrer`. El cursor de paginación de Graph solo se sigue si es de
  `graph.microsoft.com` (evita enviar el token a otro dominio).

## Backend y sincronización (Fase 9)
- Solo la URL y la *anon key* (pública por diseño) llegan a la app; la `service_role` key nunca.
- Row Level Security en la tabla `records`: cada usuario solo lee/escribe sus filas; sin borrado físico;
  `sync_push` con `SECURITY INVOKER`, `user_id = auth.uid()` forzado y límite de 500 filas por llamada.
- Sesión de AUN: Keychain/Keystore en nativo. En web se guarda en el navegador para no cerrar sesión al
  recargar (como cualquier SPA): tokens de acceso de 1 h y rotación de refresh tokens con detección de
  reutilización (activarla en Supabase). Mejora prevista: cookie httpOnly vía API propia.
- Los campos locales (`dirty`) nunca se envían; los tokens de correo nunca se sincronizan.
- Recuperación de contraseña sin revelar si un email existe.

## Fases futuras
- **Tokens OAuth** (Drive, Gmail, Outlook):
  - Nativo: refresh tokens en SecureStore, renovación automática, gestión de expiración y revocación.
  - Web: el intercambio de código y los tokens viven en el **backend** (sesión con cookie httpOnly);
    el navegador nunca ve el refresh token.
- Gmail usa *scopes* restringidos: requiere verificación/auditoría de Google → integración vía backend.
- Compartición con RLS (Row Level Security) en la base de datos remota.
- IA (Fase 10): llamadas a modelos solo desde backend; claves nunca en el cliente.
