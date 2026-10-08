# Desplegar AUN con Firebase + GitHub Pages

Esta guía te lleva de 0 a tener AUN funcionando en internet para ti y tu familia.
Tiempo estimado: 15 minutos.

## 1. Crear el proyecto en Firebase (gratis)

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. **Añadir proyecto** → nombre: `aun-app` (o el que quieras) → Continuar
3. Desactiva Google Analytics (no lo necesitamos) → Crear proyecto

### 1a. Activar Authentication

1. En el menú lateral: **Authentication** → Comenzar
2. Pestaña **Método de acceso** → habilita **Correo electrónico/contraseña**
3. (Opcional) habilita **Google** si queréis entrar con Google

### 1b. Crear Firestore Database

1. En el menú lateral: **Firestore Database** → Crear base de datos
2. Ubicación: `europe-west1` (o la más cercana)
3. Elige **Modo de producción** (vamos a subir nuestras propias reglas)
4. Espera a que se cree

### 1c. Subir las reglas de seguridad

1. En Firestore → pestaña **Reglas**
2. Copia el contenido de `firestore.rules` de este proyecto y pégalo ahí
3. Publica

### 1d. Crear el índice

1. En Firestore → pestaña **Índices**
2. Añade un índice compuesto en la colección `records`:
   - Campo 1: `ownerId` — Ascendente
   - Campo 2: `serverUpdatedAt` — Ascendente
   - Alcance: Colección

### 1e. Registrar la app web

1. En la pantalla principal del proyecto, haz clic en el icono **</>** (Web)
2. Nombre: `AUN Web` → Registrar app
3. Te muestra un bloque `firebaseConfig = { ... }` — copia esos valores

## 2. Crear el repositorio en GitHub

1. En [github.com/new](https://github.com/new) crea un repo **privado** llamado `aun`
2. En tu Mac:

```bash
cd "ruta/al/proyecto/aun"
git init
git add .
git commit -m "AUN initial commit"
git remote add origin git@github.com:TU_USUARIO/aun.git
git push -u origin main
```

## 3. Configurar los secrets en GitHub

En tu repositorio → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
Crea estos 6 secrets con los valores del paso 1e:

| Secret name                      | Valor de `firebaseConfig` |
|----------------------------------|---------------------------|
| `FIREBASE_API_KEY`               | `apiKey`                  |
| `FIREBASE_AUTH_DOMAIN`           | `authDomain`              |
| `FIREBASE_PROJECT_ID`            | `projectId`               |
| `FIREBASE_STORAGE_BUCKET`        | `storageBucket`           |
| `FIREBASE_MESSAGING_SENDER_ID`   | `messagingSenderId`       |
| `FIREBASE_APP_ID`                | `appId`                   |

## 4. Activar GitHub Pages

1. En tu repositorio → **Settings** → **Pages**
2. Source: **GitHub Actions**
3. Haz un push (o ve a **Actions** → **Deploy to GitHub Pages** → **Run workflow**)
4. En unos minutos tendrás la URL: `https://TU_USUARIO.github.io/aun/`

## 5. Añadir el dominio a Firebase Auth

1. En Firebase → **Authentication** → **Settings** → **Dominios autorizados**
2. Añade `TU_USUARIO.github.io`

## 6. ¡Listo!

- Abre `https://TU_USUARIO.github.io/aun/` en el móvil
- Crea tu cuenta (correo + contraseña)
- Cada persona de la familia crea la suya
- Los datos de cada uno son privados y se sincronizan al guardar y cada pocos minutos

### Añadir la app al móvil

**iPhone**: Safari → Compartir → "Añadir a pantalla de inicio"
**Android**: Chrome → menú ⋮ → "Añadir a pantalla de inicio"

## Desarrollo local con Firebase

Si quieres probar Firebase en tu Mac en lugar del servidor local:

```bash
cp .env.firebase.example .env.local
# Rellena los valores de tu proyecto Firebase
npm start
```

## Cuentas del servidor local

Las cuentas creadas con el servidor local (`npm run local`), incluidas las que usan nombre de usuario,
NO existen en Firebase: Firebase usa email. Crea una cuenta nueva; los datos locales se pueden copiar a
la nueva cuenta desde Configuración → Cuenta.
