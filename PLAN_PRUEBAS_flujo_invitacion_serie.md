# Plan de pruebas — flujo completo de series + invitación + reclamar cuenta

Cubre todo lo construido y subido a producción hasta el 2026-08-04. Sigue
las fases en orden — cada una depende de que la anterior haya funcionado.
Si algo falla, anota: en qué paso, qué endpoint (revisa la pestaña Network
del navegador), y el mensaje de error exacto — así lo diagnosticamos igual
de rápido que los anteriores.

Necesitas: acceso admin a un tenant de prueba, acceso superadmin, y un
email al que tengas acceso real (para recibir el correo de activación) o
confirmar que el tenant tiene `SMTP_CONSOLE`/consola activada para verlo en
logs en vez de bandeja real.

---

## Fase 1 — Servicio con pago por paquete

1. Como admin, entra a **Servicios** → edita o crea uno con
   `tipo_agenda = recurrente`.
2. Marca **"Ofrecer pago por sesión"** y **"Ofrecer pago por paquete"**,
   captura `precio` y `precio del paquete`. Guarda.
3. Recarga la pantalla — confirma que ambos precios persisten (no se
   borran al refrescar).
4. **Caso negativo**: intenta marcar "pago por paquete" en un servicio
   **no** recurrente. Debe rechazarse con un mensaje claro, no un error
   genérico ni un 500.

## Fase 2 — Crear la serie

5. Desde ese servicio, "Crear Serie de Reservas Recurrentes".
6. Confirma que el formulario **ya no pide precio ni modalidad de cobro**
   — solo frecuencia, día, hora, duración, repeticiones, asesor.
7. Crea la serie.

## Fase 3 — Invitar a un cliente sin cuenta

8. Desde la pestaña **Series**, invita/inscribe a un cliente que **no
   tenga contraseña** (si no tienes uno a mano, créalo desde
   **Superadmin → Usuarios → "+ Vincular usuario"**, sin password).
9. Confirma que el admin **ya no elige modalidad ni método de pago** —
   solo selecciona a quién invita.
10. Verifica que la inscripción queda en estado **"invitada"** y que
    **no se generan reservas todavía** (revisa que el cliente no tiene
    sesiones nuevas en su historial).
11. Confirma que se mandó el correo de invitación/activación (bandeja real
    o logs si está en modo consola) con el link.

## Fase 4 — Reclamar cuenta

12. Abre el link del correo (`/t/:tenantSlug/activar?token=...`).
13. Define una contraseña nueva y confirma.
14. Debe hacer **auto-login** y mandarte directo a su portal, sin pedir
    que inicies sesión de nuevo.

## Fase 5 — El cliente elige modalidad y método

15. En el portal del cliente (**Mis Series** o donde corresponda), debe
    ver la invitación pendiente con **ambas opciones y sus precios**
    (sesión y paquete).
16. Elige **paquete** + método **local**. Confirma.
17. Verifica que **ahora sí** se generaron las N reservas (revisa "Mis
    Reservas" del cliente).
18. **Caso negativo**: repite con otra invitación (o simula) eligiendo
    método **online** — debe fallar con un mensaje claro de "pago en
    línea no disponible", nunca un 500 ni un stub roto.

## Fase 6 — Registrar el pago (staff)

19. Como admin, en la pestaña Series, abre la inscripción y "Registrar
    pago". El monto por default debe ser el `precio_paquete` del
    servicio.
20. Confirma el pago. Verifica que **todas** las reservas de esa
    inscripción pasan a pagadas — no solo la primera.

## Fase 7 — Gate de pago en check-in

21. Intenta hacer check-in de una reserva **sin pago confirmado** — debe
    rechazarse (pago pendiente).
22. Después de registrar el pago, repite el check-in — ahora debe
    funcionar.

## Fase 8 — Fixes puntuales de esta sesión

23. Ya logueado como cliente, reserva una sesión suelta (no de serie).
    Confirma que **no** te vuelve a pedir nombre/email — debe mostrar
    "vas a reservar como [tu nombre]".
24. Revisa el calendario público de un servicio de confirmación manual
    que ya tenga una sesión de una serie activa en curso. Debe mostrar el
    asesor real y los cupos disponibles — no "se te asignará un asesor".

## Fase 9 — Superadmin: gestión de usuarios (independiente, no bloqueante)

25. Busca al usuario de prueba en **Superadmin → Usuarios**.
26. Desvincúlalo de un tenant, luego vuelve a vincularlo — confirma que
    esta vez **no** da el 409 falso de "ya vinculado" (bug ya corregido).
27. Desactiva la cuenta completa — confirma que cancela sus reservas
    activas en cascada, y que intentar loguearse después da el mensaje de
    "cuenta desactivada", no el genérico de credenciales inválidas.
28. **No pruebes "purgar"** todavía — es irreversible y solo se habilita
    tras 30 días de desactivación; no hace falta para esta ronda.

---

Cuando termines, dime qué falló (si algo falla) o si todo pasó — con eso
cerramos esta ronda y seguimos con `PROMPT_G` (MercadoPago).
