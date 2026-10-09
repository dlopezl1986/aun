# Avisos fuera de la app (email y Telegram)

AUN puede avisarte aunque la app esté cerrada:

- **Email**: un resumen del día (eventos, notas del día, avisos, tareas, «Para mañana» y compras) a la hora que elijas.
- **Telegram**: cada aviso a su hora y, si quieres, también el resumen del día.

Cada persona lo activa en **Configuración → Notificaciones → Avisos fuera de la app**.

## Cómo funciona

1. La app publica en Firebase lo que hay que enviar (`notify`, `outbox`, `digests`), solo tuyo
   (reglas en `firestore.rules`). Se actualiza cada vez que abres AUN o cambias algo.
2. Un robot (`notifier/run.mjs`) se ejecuta **cada 5 minutos en GitHub Actions**
   (`.github/workflows/notifier.yml`, gratis) y envía lo que toque.
3. GitHub puede retrasar unos minutos las ejecuciones programadas: los avisos salen hasta 5 min antes
   de su hora para no llegar tarde. Si el robot estuvo parado y el resumen llega con más de 3 h de retraso,
   ese día no se envía (nada de «buenos días» a las 23:00).

## Configuración (una sola vez, la hace el dueño del repositorio)

Todo se guarda como **secrets** del repositorio en
`https://github.com/dlopezl1986/aun/settings/secrets/actions` (nunca en el código).

### 1. Acceso del robot a Firebase — `FIREBASE_SERVICE_ACCOUNT`
Firebase → ⚙️ Configuración del proyecto → **Cuentas de servicio** → **Generar nueva clave privada**.
Se descarga un `.json`: copia **todo su contenido** en el secret `FIREBASE_SERVICE_ACCOUNT` y
después borra el archivo del ordenador. (Es una llave con acceso total a tu Firebase: solo en el secret.)

### 2. Bot de Telegram — `TELEGRAM_BOT_TOKEN` + variable `TELEGRAM_BOT_USERNAME`
1. En Telegram abre **@BotFather** → `/newbot` → nombre `AUN` → usuario terminado en `bot`
   (p. ej. `aun_familia_bot`).
2. BotFather te da un **token**: guárdalo en el secret `TELEGRAM_BOT_TOKEN`.
3. El usuario del bot (sin @) va en **Variables** (no secret):
   `https://github.com/dlopezl1986/aun/settings/variables/actions` → `TELEGRAM_BOT_USERNAME`.
   Después hay que volver a publicar la web (cualquier push o «Run workflow» en *Deploy*).

### 3. Email desde tu Gmail — `GMAIL_USER` + `GMAIL_APP_PASSWORD`
1. Activa la verificación en dos pasos en tu cuenta de Google.
2. Crea una **contraseña de aplicación** en `https://myaccount.google.com/apppasswords` (nombre: AUN).
3. Secrets: `GMAIL_USER` = tu Gmail, `GMAIL_APP_PASSWORD` = la contraseña de 16 letras.
   Los resúmenes saldrán desde tu Gmail hacia el email de cada cuenta de AUN.

Sin alguno de estos secrets el robot simplemente no usa ese canal.

## Pruebas

```bash
npm run test:notifier   # robot: Telegram, avisos, resúmenes (emulador + Telegram falso)
npm run test:rules      # reglas de seguridad (incluye notify / outbox / digests)
```

Para lanzarlo a mano: GitHub → Actions → **Notifier** → *Run workflow*.
