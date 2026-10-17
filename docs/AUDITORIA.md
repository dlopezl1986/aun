# Auditoría de AUN — 17 de octubre de 2026

Objetivo: usar AUN en familia **y** venderla en la App Store. Revisión de usuarios, familia y sincronización (lo prioritario), seguridad, privacidad, requisitos de Apple, rendimiento, costes y producto.

## 1. Resumen

| Área                        | Estado                                                                          |
| --------------------------- | ------------------------------------------------------------------------------- |
| Sincronización familiar     | ✅ Rehecha hoy: en tiempo real (~1,5 s), sin pérdidas ni divergencias conocidas |
| Seguridad de datos (reglas) | ✅ Buena. 28 tests de reglas; endurecidas hoy                                   |
| Cuentas                     | ✅ Eliminar cuenta añadido hoy (obligatorio en Apple). ⚠️ Falta verificar email |
| Lista para uso familiar     | ✅ Sí (web)                                                                     |
| Lista para la App Store     | ❌ Todavía no. Hay 6 bloqueantes (sección 3)                                    |
| Lista para cobrar           | ❌ No hay suscripciones ni paywall                                              |

**Veredicto:** la base técnica es sólida (offline-first, reglas probadas, 126 tests unitarios, 28 de reglas y 6 del notificador) y ya sirve para usarla en casa. Para venderla falta sobre todo lo que **no es código de la app**: compilar y probar en iPhone, cobrar con suscripciones de Apple, textos legales, notificaciones push de verdad, y decidir qué hacer con el módulo de correo.

## 2. Arreglado hoy (verificado)

Prueba real con dos cuentas (Ana y Bea) en el emulador de Firebase, con clics reales:

| Caso                                                                | Antes                              | Ahora (medido)                 |
| ------------------------------------------------------------------- | ---------------------------------- | ------------------------------ |
| Ana añade a la compra → Bea lo ve                                   | Hasta 5 min (o al volver a la app) | **1,4 s**                      |
| Bea añade → Ana lo ve                                               | Hasta 5 min                        | **1,4 s**                      |
| Ana marca comprado → Bea                                            | Hasta 5 min                        | **< 3 s**                      |
| Ana quita el acceso a Bea → los datos de Ana salen del móvil de Bea | **Nunca** (se quedaban)            | **0,4 s**                      |
| Bea elimina su cuenta → desaparece lo suyo para Ana                 | No existía                         | Verificado en la base de datos |

### Fallos graves corregidos

1. **Divergencia permanente entre dispositivos.** Firestore aceptaba que una versión **antigua** pisara a una nueva, por ejemplo un móvil que estuvo sin cobertura. Resultado: Ana y Bea podían ver para siempre datos distintos del mismo evento.
   - Ahora el servidor lo rechaza y el dispositivo antiguo recibe la versión buena.
   - Además, las ediciones siempre "avanzan" en el tiempo aunque un móvil tenga el reloj adelantado.
2. **Cambios que no se subían.** Un cambio hecho mientras ya había una sincronización en marcha se quedaba sin subir hasta el siguiente aviso. Ahora se encola.
3. **Datos que no llegaban.** Algunas escrituras no pasaban por el disparador de sincronización. Ahora cualquier cambio local, de cualquier módulo, sube en ~1 s, y también al recuperar la conexión.
4. **"Borrar todo el contenido" borraba datos de tu pareja.** Si tenías permiso de edición, borraba para todos sus eventos y su compra. Ahora solo borra lo tuyo.
5. **En iPhone/Android la sesión no se guardaba.** Se usaba la persistencia del navegador, así que habría que iniciar sesión cada vez que se abre la app. Ahora usa el almacenamiento nativo.
   - _Pendiente de comprobar en un build nativo._
6. **Al quitar el acceso, los datos del otro se quedaban en el dispositivo.** Ahora se eliminan del dispositivo.
7. **Al unirse a una familia, tus datos de familia previos no se veían.** Por ejemplo, la lista de la compra que ya tenías. Ahora se mueven a la familia.
8. **El servidor confiaba en la hora del cliente** para ordenar los cambios: se podía "esconder" un cambio. Ahora la hora la pone el servidor.
9. **Faltaba eliminar la cuenta desde la app**, que es obligatorio en la App Store (guía 5.1.1(v)). Ahora existe "Eliminar mi cuenta":
   - Pide la palabra de confirmación y la contraseña.
   - Borra todas tus filas, espacios, invitaciones y avisos en el servidor.
   - Sales de los espacios ajenos y quedan "lápidas" vacías para que los demás dispositivos se enteren.
   - Borra los datos del dispositivo y el usuario.

### Cómo sincroniza ahora

- **Subida:** ~1 s después de cualquier cambio. Se agrupan los cambios rápidos.
- **Bajada:** escuchas en vivo de Firestore, una por espacio compartido más la tuya. Solo leen los cambios posteriores, así que salen baratas.
- **Red de seguridad:** al abrir la app, al volver a ella, al recuperar conexión y cada 10 min.
- **Permisos:** si cambia lo que te comparten (te invitan o te quitan), se sincroniza al momento.

## 3. Bloqueantes para la App Store (P0)

1. **Cobrar.** No existe nada de pago.
   - Apple exige su sistema de compras (StoreKit) para suscripciones digitales.
   - Recomendación: RevenueCat, que tiene SDK para Expo, gestiona iOS y Android y es gratis hasta 2.500 $/mes de ingresos.
   - Hace falta un paywall y "derechos" (premium sí/no) **comprobados en el servidor**: en las reglas de Firestore o en una Cloud Function, no solo en la app, porque si no se salta fácil.
2. **Nunca se ha compilado ni probado en iPhone/Android.** Hace falta:
   - Builds con EAS y TestFlight.
   - Probar la sesión persistente, las notificaciones, las fotos y los enlaces de invitación.
   - Las invitaciones abren `/join` en la web. En nativo hacen falta Universal Links / App Links para que el enlace de WhatsApp abra la app.
3. **Textos legales.**
   - Política de privacidad y términos, enlazados en la app y en App Store Connect.
   - La ficha de "Privacidad de la app".
   - Ojo: guardas datos de **menores** (los hijos). La política debe explicarlo y ofrecer cómo borrarlo; ya existe la eliminación de cuenta.
4. **El código es público** (repositorio público en GitHub): cualquiera puede copiar el producto entero.
   - Hacerlo privado.
   - GitHub Pages con repo privado necesita GitHub Pro (4 $/mes). Alternativa gratis: Firebase Hosting.
5. **Correo (Gmail/Outlook).** Los permisos `gmail.modify` y `gmail.send` son "restringidos" para Google.
   - Para publicarlo hace falta la verificación de Google **y una auditoría de seguridad anual (CASA)**, que cuesta varios cientos o miles de euros al año.
   - Outlook pide verificar al editor.
   - Recomendación: **lanzar la v1 sin el módulo de correo** (desactivarlo con su flag) y añadirlo cuando haya ingresos.
6. **Avisos fuera de la app.**
   - Hoy dependen de GitHub Actions, cuyo cron es poco fiable: lo hemos visto ejecutarse cada 4–6 h. El correo diario saldría desde un Gmail personal.
   - Para un producto hacen falta:
     - **Notificaciones push** (Firebase Cloud Messaging / APNs).
     - **Cloud Functions** programadas (plan Blaze, de pago por uso, normalmente céntimos).
     - Un proveedor de correo transaccional (Resend, SendGrid o SES).
   - Telegram puede quedarse como extra.

## 4. Seguridad y abuso (P1)

- **App Check** (Firebase) para que solo tu app pueda usar tu base de datos. Hoy, con la clave pública, cualquiera podría crear cuentas y escribir datos dentro de los límites de las reglas.
- **Tamaño de los datos.** Las reglas no limitan cuánto ocupa una fila (Firestore corta en 1 MiB). Hay que poner límites de tamaño o de número de campos para evitar abusos que cuesten dinero.
- **Verificación del email** al registrarse. Evita cuentas falsas y errores de escritura que luego impiden recuperar la contraseña.
- **Invitaciones usadas.** Se quedan guardadas con el nombre de quien aceptó. Activar una política TTL de Firestore sobre `expiresAt` para que se borren solas.
- **Copias de seguridad.**
  - La base de datos tiene la **protección contra borrado desactivada** y no hay copias.
  - Activar la protección, la recuperación a un momento dado (PITR, 7 días) o copias programadas. Hacerlo antes de tener clientes.
- **Ubicación de los datos.** Están en **EE. UU. (nam5)**.
  - Es legal con Google como encargado (cláusulas tipo / Data Privacy Framework).
  - Pero si quieres vender "tus datos en Europa", hay que crear la base en `eur3`, y **no se puede mover después**. Decidirlo antes de lanzar.
- **Lo que está bien:**
  - Reglas con dueño en el id de cada espacio.
  - Invitaciones de un solo uso, con caducidad y aceptadas de forma atómica.
  - Roles ver/editar comprobados en el servidor.
  - Las contraseñas de las cuentas reales las gestiona Firebase Auth: nunca pasan por tu base de datos.
  - Tokens de correo solo en el llavero del móvil; en la web, solo en memoria.
- **Modo local** (cuentas solo en el dispositivo). Usa SHA-256 iterado (2.000 vueltas), que es débil. Vale para desarrollo; **no debe estar disponible en la versión de la tienda**.
  - Ningún secreto en el repositorio (revisado).

## 5. Rendimiento, escalabilidad y coste (P1–P2)

- **Almacenamiento local.** Cada módulo se guarda como un único JSON que se reescribe entero en cada cambio.
  - En la web eso es `localStorage`, con un **límite de ~5 MB**. Con un año de uso intenso (eventos repetidos, notas, documentos) puede llegar al límite y fallar al guardar.
  - Migrar a SQLite (`expo-sqlite`) en móvil e IndexedDB en web. La interfaz `KeyValueStore`/`Repository` ya está preparada para cambiarlo sin tocar los módulos.
- **Lápidas.** Lo borrado se guarda como lápida para siempre. Conviene compactarlas tras 30–60 días con una Cloud Function.
- **Conflictos.** Se resuelven por fila completa: si dos personas editan **el mismo** evento a la vez, gana la última edición entera. Es suficiente para una familia. Fusionar por campo sería una mejora futura.
- **Coste de Firestore (estimación).** Unas 1.000 lecturas al día por usuario activo con familia.
  - El plan gratis (50.000 lecturas/día) cubre ~50 usuarios activos.
  - Después, del orden de **0,02–0,05 € por usuario al mes**. El coste no es problema; lo caro son los bloqueantes del punto 3.

## 6. Calidad y producto (P2)

- **Calidad en el despliegue.** El despliegue (`deploy.yml`) **no pasa los tests** antes de publicar. Hay que añadir `npm run check` y los tests de reglas al flujo.
- **Pruebas de extremo a extremo.** No hay automáticas: Maestro para móvil, Playwright para web. Hoy se prueba a mano.
- **Errores y uso.** Falta un sistema de errores (Sentry) para enterarte de los fallos de los clientes, y analítica respetuosa con la privacidad para saber qué se usa.
- **Código muerto de Supabase** (backend anterior). Conviene quitarlo para reducir superficie y tamaño.
- **Versión y nombre.** Versión `0.1.0` e identificador `com.aun.allyouneed`. Comprobar que "AUN" está libre como marca en la App Store y en la OEPM/EUIPO.
- **Funcionalidad que falta para un producto.** Hoy, salvo eliminando la cuenta, no se puede:
  - "Salir de una familia" por iniciativa propia. La regla del servidor ya existe; falta el botón.
  - Cambiar la contraseña o el email.
  - Iniciar sesión con Apple o Google. Si se añade Google, Apple pasa a ser obligatorio (guía 4.8).

## 7. Modelo de negocio (propuesta)

- **Gratis:** una persona, sin compartir, con todos los módulos básicos.
- **AUN Familia** (p. ej. 3,99 €/mes o 29,99 €/año), para toda la familia con una sola suscripción:
  - Compartir familia y calendarios con hasta 6 cuentas.
  - Avisos por push, correo o Telegram.
  - Copia en la nube y 2ndBrain en Google Drive.
- Apple cobra un **15 %** si facturas menos de 1 M$/año (Small Business Program).

## 8. Plan recomendado

1. **Ya (1–2 días):**
   - Repo privado y Firebase Hosting.
   - Protección contra borrado y PITR.
   - Tests en el despliegue.
   - Verificación de email.
   - Decidir la región (eur3) **antes** de tener clientes.
2. **Fase iPhone (1–2 semanas):**
   - EAS build y TestFlight.
   - Universal Links para las invitaciones.
   - Push con FCM/APNs.
   - Probar todo en dispositivos reales.
3. **Fase de cobro (1–2 semanas):** RevenueCat, paywall, derechos comprobados en el servidor y App Check.
4. **Fase legal y ficha:** privacidad, términos, capturas, ficha de App Store y desactivar el módulo de correo en la v1.
5. **Después:** Cloud Functions (avisos, compactar lápidas), SQLite/IndexedDB, Sentry y salir de una familia.

## 9. Lo que no he podido verificar

- **Comportamiento en iPhone/Android.** No hay build nativo. En especial, la sesión persistente que he arreglado hoy.
- **Producción con sesión iniciada.** No tengo (ni debo tener) tus credenciales. La web de producción carga sin errores, y todo lo demás está probado en el emulador de Firebase con dos cuentas y con las mismas reglas que producción.
