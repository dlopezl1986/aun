# AUN · All You Need

> "Todo lo que necesitas para organizar tu vida, en un solo lugar."

AUN es un **segundo cerebro personal y modular**: documentos (2ndBrain), calendarios, tareas, correo,
familia y avisos conectados en una sola app para **iOS, Android y Web** (React Native + Expo).

Estado: **Fases 1–9** ✅ — Fundación, Dashboard, 2ndBrain, Calendarios, ToDo, Familia, Correo, Notificaciones y Backend/sincronización (lista para conectar: ver [docs/BACKEND.md](docs/BACKEND.md)) (ver [docs/ROADMAP.md](docs/ROADMAP.md)).

---

## Requisitos

- Node.js ≥ 20 (probado con Node 24)
- npm
- Para móvil: app **Expo Go** (SDK 57) en el teléfono, o un simulador/emulador.

## Instalación y ejecución

```bash
npm install
npm start          # menú de Expo: pulsa w (web), i (iOS), a (Android) o escanea el QR con Expo Go
npm run web        # directamente en el navegador
```

La primera vez, crea una cuenta en la pantalla de registro. En esta fase las cuentas son **locales al
dispositivo/navegador** (ver [docs/SECURITY.md](docs/SECURITY.md)).

### Calidad

```bash
npm run typecheck     # TypeScript estricto
npm run lint          # ESLint (config oficial de Expo)
npm run check:i18n    # verifica que todas las claves de traducción existen
npm test              # tests unitarios (Jest + jest-expo)
npm run format        # Prettier
npm run check         # todo lo anterior
npx expo-doctor       # diagnóstico de configuración Expo
```

### Builds (preparado)

- **Expo Go**: todas las dependencias actuales están incluidas en Expo Go. Excepción: **Google Drive en iOS**
  necesita un development build (ver [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)).
- **Development build / EAS / TestFlight / Play**: `npx eas-cli@latest build --profile development`
  (crear `eas.json` con `npx eas-cli@latest build:configure` cuando se configure la cuenta de Expo).
- Identificadores: `com.aun.allyouneed` (iOS y Android) en `app.json` — cámbialos antes de publicar.

## Variables de entorno

Ver [`.env.example`](.env.example). Solo se usan variables `EXPO_PUBLIC_*` (identificadores públicos).
**Nunca** pongas secretos en el frontend: los secretos vivirán en el backend (Fase 9).

## Estructura

```
src/
  app/            Rutas de Expo Router (finas: solo importan pantallas)
  components/     UI reutilizable (ui/, layout/, feedback/, forms/)
  modules/        Un módulo por carpeta: definition, service, hooks, pantallas, widgets
  services/       Auth, contenedor de servicios, permisos, relaciones, ajustes
  storage/        KV, almacenamiento seguro, repositorios, proveedores de 2ndBrain
  state/          Zustand (preferencias, sesión, ajustes de usuario) + TanStack Query
  hooks/ theme/ i18n/ types/ utils/ config/
docs/             Arquitectura, decisiones, seguridad, roadmap
```

Más detalle en [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y [docs/DECISIONS.md](docs/DECISIONS.md).

## Idiomas

Español (por defecto) e Inglés. Configuración → Idioma. Añadir un idioma: crear
`src/i18n/locales/xx.ts` tipado como `Translation` y registrarlo en `src/i18n/languages.ts`.
