# Variables de entorno — MVP Schedule

Referencia completa de todo lo que el código realmente lee del entorno (verificado contra el repo, no supuesto). Úsala para configurar `.env` local, y las mismas claves en Render/Vercel al desplegar.

> ⚠️ **Corrección importante:** `.env` y `.env.example` en la raíz del proyecto tienen `ENVIRONMENT=development` — esa variable **no existe en el código**. El backend lee `ENV` (minúscula tal cual, sin sufijo). Si en Render pones `ENVIRONMENT=production` en vez de `ENV=production`, Swagger (`/docs`) se queda expuesto públicamente sin que te des cuenta. Actualiza tu `.env` local para usar `ENV`, no `ENVIRONMENT`.

## Backend (Render / `.env` local)

| Variable | Requerida | Default si falta | Qué controla |
|---|---|---|---|
| `DATABASE_URL` | Sí | — (el proceso no arranca sin ella) | Cadena de conexión a Postgres (Neon). Formato `postgresql://usuario:password@host/db?sslmode=require`. |
| `JWT_SECRET_KEY` | Sí en producción | `CAMBIA_ESTO_EN_PRODUCCION_MIN_32_CHARS` (inseguro, solo dev) | Firma los tokens JWT. Generar con: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `TENANT_SECRETS_KEY` | Sí | — (el proceso truena al primer uso si falta) | Clave Fernet para encriptar `smtp_config` y otros secrets por tenant. **No es un hex cualquiera**, debe ser una Fernet key válida. Generar con: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| `ENV` | Recomendado en producción | `development` | `production` desactiva `/docs`, `/redoc` y `/openapi.json`. Cualquier otro valor (incluido no setearla) los deja expuestos. |
| `CORS_ORIGINS` | Recomendado en producción | `http://localhost:5173,http://localhost:3000` | Lista separada por comas de orígenes permitidos. En producción: la URL real de Vercel (ej. `https://tu-app.vercel.app`). |
| `FRONTEND_URL` | Recomendado en producción | `http://localhost:5173` | Origen público único del frontend — se usa para armar los links de "reclamar cuenta"/"activar cuenta" dentro de los correos. En producción: la misma URL real de Vercel. *(nueva — reclamar cuenta)* |
| `SQL_ECHO` | No | `false` | `true` loguea cada query SQL en consola — solo para debug local, no lo actives en producción (ensucia los logs). |
| `SMTP_CONSOLE` | No | (vacío = respeta el `smtp_config` de cada tenant) | `1` fuerza modo consola (no envía correos reales) para **todos** los tenants a la vez, sin importar su config individual. Útil en un ambiente de staging compartido. |
| `STRIPE_WEBHOOK_SECRET` | No todavía | — | Solo aplica si algún día se activa el checkout de Stripe (`iniciar_checkout` sigue sin implementar). No hace falta configurarlo ahora. |

## Frontend (Vercel / `frontend/.env`)

| Variable | Requerida | Default si falta | Qué controla |
|---|---|---|---|
| `VITE_API_URL` | Recomendado en producción | `http://localhost:8000` | URL del backend. En Vercel: la URL real de Render (ej. `https://tu-api.onrender.com`). |

## No configures esto — es código muerto

`app/tasks.py` referencia `REDIS_URL` y usa Celery (`broker=`, `backend=`). **Esto contradice la regla del proyecto** (HANDOFF/AGENTS.md: "Jobs: APScheduler, NO Celery") y nada en la app real lo importa — `celery` ni siquiera está en `requirements.txt`, así que si algo intentara usar este archivo, tronaría al importarlo. Es un archivo huérfano de una versión anterior. No necesitas Redis para nada en este proyecto. Si quieres, puedo pedir que se borre para evitar confusión futura (a alguien le puede parecer que falta configurar Redis cuando no hace falta).
