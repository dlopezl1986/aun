# AUN en el iPhone con TestFlight

Los avisos en el iPhone son **notificaciones locales**. La app programa en el propio teléfono los recordatorios, eventos y tareas con hora: hasta 50 a la vez, y la lista se rehace cada vez que cambian los datos o vuelves a la app. No hacen falta servidor, Telegram ni email, y llegan aunque no haya conexión.

## Lo que ya está preparado

- `eas.json`: perfiles de build `production` (TestFlight) y `preview`, con la configuración pública de Firebase de producción.
- `app.json`: identificador `com.aun.allyouneed` y esquema `aun://`. Además declara que la app no usa cifrado propio, así que TestFlight no pregunta por ello en cada subida.
- El código de iPhone compila (`expo export --platform ios`) y `expo-doctor` pasa 21/21.
- La sesión se guarda en el teléfono y los datos van en SQLite.

## Lo que tienes que hacer tú (una sola vez)

1. **Apple Developer Program** (99 $/año) con tu Apple ID: <https://developer.apple.com/programs/enroll/>. Puede tardar hasta 48 h en activarse.
2. **Cuenta de Expo** (gratis): <https://expo.dev/signup>.
3. En la terminal, dentro de la carpeta `aun`:

   ```bash
   npx eas-cli login
   ```

   ```bash
   npx eas-cli init
   ```

   El segundo comando enlaza el proyecto con tu cuenta de Expo y añade su `projectId` a `app.json`. Ese cambio hay que guardarlo en el repositorio (lo puedo hacer yo después).

4. Crear el build de iPhone:

   ```bash
   npx eas-cli build --platform ios --profile production
   ```

   Te pedirá iniciar sesión con tu Apple ID y creará solo los certificados. Si dice que `com.aun.allyouneed` ya está cogido, dímelo y lo cambio (por ejemplo a `com.dlopezl.aun`).

5. Subirlo a TestFlight:

   ```bash
   npx eas-cli submit --platform ios --latest
   ```

## Usuarios de TestFlight (tu pareja y tú)

En <https://appstoreconnect.apple.com>, con la app ya subida:

- **Prueba interna** (sin revisión de Apple, hasta 100 personas):
  1. En _Usuarios y acceso_, añade el Apple ID de cada persona con el rol _Marketing_ o _Atención al cliente_. Cada uno acepta el correo de invitación.
  2. En _TestFlight → Pruebas internas_, crea un grupo y añádelos.
- **Prueba externa** (sin darles acceso a tu cuenta): en _TestFlight → Pruebas externas_, crea un grupo, añade sus emails o activa un **enlace público**. La primera versión pasa una revisión rápida de Apple, normalmente de menos de un día.

Cada persona instala **TestFlight** desde la App Store, acepta la invitación e instala AUN.

## Activar los avisos en el iPhone

Abre AUN, ve a **Ajustes → Notificaciones** y pulsa en activar. iOS pide permiso una vez. Desde ese momento, los recordatorios, eventos y tareas con hora avisan en el iPhone, también con la app cerrada. Al tocar un aviso se abre la pantalla correspondiente.

## Nuevas versiones

Cada vez que haya cambios: `npx eas-cli build -p ios --profile production` y después `npx eas-cli submit -p ios --latest`. El número de build sube solo. Los testers reciben la actualización en TestFlight.

Coste: el plan gratuito de Expo incluye un número limitado de builds al mes, suficiente para probar. Lo único de pago es la cuenta de Apple Developer.
