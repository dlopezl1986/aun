# Integraciones

## Google Drive (2ndBrain)

Estado: **implementado** (`src/storage/providers/googleDrive`), se activa al configurar OAuth.

| Plataforma | Estado | Requisito |
|------------|--------|-----------|
| Web        | ✅ | Client ID tipo *Web application* |
| iOS        | ✅ | Client ID tipo *iOS* + **development/production build** (no funciona en Expo Go: Google rechaza el redirect `exp://`) |
| Android    | ⛔ próximamente | Google ya no admite redirects con esquema propio en Android: requiere el módulo nativo de inicio de sesión de Google (development build) |

### Permisos
Solo `https://www.googleapis.com/auth/drive.file` (+ `openid email` para mostrar la cuenta):
AUN únicamente ve los archivos que él mismo crea, dentro de la carpeta **AUN** de tu Drive. Es un
permiso *no sensible*: no exige la verificación de seguridad de Google.

### Configuración (Google Cloud Console)
1. Crea un proyecto → **APIs y servicios → Biblioteca** → habilita **Google Drive API**.
2. **Pantalla de consentimiento OAuth**: tipo *Externo*, añade el scope `drive.file` y, mientras esté en
   pruebas, tu cuenta como *usuario de prueba*.
3. **Credenciales → Crear ID de cliente OAuth**:
   - *Aplicación web*: orígenes autorizados `http://localhost:8090` (desarrollo) y tu dominio; URI de
     redirección autorizado: los mismos orígenes (p. ej. `http://localhost:8090`).
   - *iOS*: bundle ID `com.aun.allyouneed` (o el tuyo).
4. Copia los IDs en `.env.local` (no son secretos, pero no los subas si no quieres):
   ```bash
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=xxxx.apps.googleusercontent.com
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=yyyy.apps.googleusercontent.com
   ```
5. iOS: añade el esquema de redirección (ID de cliente iOS invertido) en `app.json`:
   ```json
   "ios": { "infoPlist": { "CFBundleURLTypes": [{ "CFBundleURLSchemes": ["com.googleusercontent.apps.yyyy"] }] } }
   ```
   y genera un development build: `npx eas-cli@latest build --profile development --platform ios`.
6. Reinicia `npm start`. En Configuración → Almacenamiento aparecerá **Conectar** en Google Drive.

### Comportamiento
- **Conectar**: consentimiento de Google en el navegador del sistema (nunca se pide la contraseña).
- **Tokens**: iOS → Keychain (refresh token, renovación automática y reintento ante 401).
  Web → solo en memoria (la conexión dura la sesión de la pestaña; ver SECURITY.md).
- **Eliminar** un documento lo mueve a la **papelera de Drive** (recuperable 30 días).
- **Desconectar** revoca el acceso de AUN; los archivos siguen en tu Drive. Si Drive era el
  almacenamiento activo, los documentos nuevos pasan a guardarse en el dispositivo.
- Las carpetas de 2ndBrain son metadatos de AUN; en Drive los archivos están dentro de `AUN/`.

## iCloud Drive
Preparado, no implementado (`ICloudStorageProvider` falla de forma explícita). Requiere un módulo
nativo de Expo con el contenedor de ubiquidad, la capacidad iCloud en la cuenta de Apple Developer y un
build instalado. Nunca está disponible en Android ni web (limitación de Apple).

## Correo (Gmail / Outlook)

Arquitectura: `EmailProvider` (contrato) → `GmailProvider` (Gmail API v1) y `OutlookProvider`
(Microsoft Graph v1.0) en `src/modules/email/providers/`. `EmailService` gestiona varias cuentas, tokens por
cuenta, renovación y la bandeja unificada. Añadir Yahoo/IMAP = un descriptor + un `EmailProvider`.

Funciones: leer, enviar, responder, responder a todos, reenviar, mover a la papelera (nunca borrado
definitivo), marcar leído/no leído, marcar importante, buscar y navegar por carpetas.

### Gmail (Google Cloud Console)
Usa el mismo proyecto e IDs de cliente que Google Drive.
1. **Biblioteca** → habilita **Gmail API**.
2. **Pantalla de consentimiento** → añade los scopes `gmail.modify` y `gmail.send` (además de `openid`,
   `email`). Son scopes **restringidos**: en modo *Pruebas* funcionan para tus usuarios de prueba (hasta
   100). Para publicarlo para todo el mundo Google exige verificación y una evaluación de seguridad.
3. Web: el mismo ID de cliente web (orígenes/redirect `http://localhost:8090` y tu dominio).
   iOS: el mismo ID de cliente iOS y esquema invertido que Drive (development build).
4. Android: Google no admite redirecciones con esquema propio; requiere el módulo nativo de Google
   Sign-In (pendiente). La app lo indica en Correo → Cuentas.

### Outlook / Microsoft 365 (Microsoft Entra ID)
1. [portal.azure.com](https://portal.azure.com) → **Microsoft Entra ID → Registros de aplicaciones → Nuevo
   registro**. Tipos de cuenta: *cuentas de cualquier directorio organizativo y cuentas Microsoft personales*.
2. **Autenticación → Agregar plataforma**:
   - *Aplicación de página única (SPA)*: `http://localhost:8090` (desarrollo) y tu dominio.
   - *Aplicaciones móviles y de escritorio*: URI personalizado `aun://oauth/microsoft`.
   No crees ningún *secreto de cliente*: la app es un cliente público con PKCE.
3. **Permisos de API → Microsoft Graph (delegados)**: `User.Read`, `Mail.ReadWrite`, `Mail.Send`,
   `offline_access`, `openid`, `email`, `profile`.
4. Copia el *Id. de aplicación (cliente)* en `.env.local`:
   ```bash
   EXPO_PUBLIC_MICROSOFT_CLIENT_ID=00000000-0000-0000-0000-000000000000
   ```
5. Reinicia `npm start` → Correo → Cuentas → **Conectar** en Outlook. En iOS/Android necesita una
   development build (Expo Go no admite el esquema `aun://`).

### Comportamiento y seguridad
- Tokens por cuenta: iOS/Android en Keychain/Keystore; web **solo en memoria** (al recargar la pestaña la
  cuenta aparece como «Reconectar»; con el backend de la Fase 9 la sesión será persistente vía cookie
  httpOnly).
- Los correos no se guardan en AUN: se piden al proveedor cada vez.
- El HTML se muestra sin scripts (CSP `default-src 'none'` + saneado), con imágenes remotas bloqueadas
  hasta que el usuario las permita y enlaces abiertos fuera de la app.

### Buzón de demostración (solo desarrollo)
En builds de desarrollo aparece el proveedor **Demo**: un buzón local con correos de ejemplo para probar
toda la interfaz sin credenciales reales. Está etiquetado como tal, no usa la red y no existe en builds de
producción (`featureFlags.emailDemo = __DEV__`).
