# SaaS Agenda Multitenant v2.2.1

## Correcciones desde v2.1
- Hash determinista para advisory locks (multi-worker seguro)
- `codigo_confirmacion` con UNIQUE constraint
- Columna `checked_in` en reservas
- Buffers respetados en listado de disponibilidad
- Respuestas de formulario persistidas
- Webhook Stripe para confirmar pagos
- Endpoints de check-in y cierre de sesión
- Excepciones específicas en vez de `except Exception` genérico
- Migración SQL completa con todos los constraints e índices
- Secrets de tenant encriptados en reposo (Fernet)
- Cola de tareas Celery/Redis para efectos asíncronos

## Variables de entorno requeridas
```bash
DATABASE_URL=postgresql+psycopg2://user:pass@host/db?sslmode=require
REDIS_URL=redis://localhost:6379/0
TENANT_SECRETS_KEY=<clave-fernet-base64-32-bytes>
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Generar clave Fernet
```python
from cryptography.fernet import Fernet
print(Fernet.generate_key().decode())
```

## Deploy
1. Ejecutar `migracion_v2_2_postgres.sql` con app detenida
2. `pip install -r requirements.txt`
3. `uvicorn app.main:app --host 0.0.0.0 --port 8000`
4. `celery -A app.tasks worker -l info -B`

## Estructura
```
app/
  models_v2_2.py      # SQLAlchemy 2.0 + encriptación
  schemas_v2_2.py     # Pydantic v2
  services_v2_2.py    # Lógica de negocio + concurrencia
  router_v2_2.py      # FastAPI endpoints
  tasks.py            # Celery workers
  migracion_v2_2_postgres.sql
```
