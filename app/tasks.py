"""
tasks.py — Celery tasks para email, calendario y limpieza de holds.
Ejecutar worker: celery -A app.tasks worker -l info -B
"""
import os
from celery import Celery
from celery.schedules import crontab

celery_app = Celery(
    "scheduler",
    broker=os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
    backend=os.environ.get("REDIS_URL", "redis://localhost:6379/0"),
)

celery_app.conf.beat_schedule = {
    "limpiar-holds-expirados": {
        "task": "app.tasks.limpiar_holds_job",
        "schedule": crontab(minute="*/5"),
    },
}


@celery_app.task(bind=True, max_retries=3)
def enviar_confirmacion_email(self, tenant_id: int, reserva_id: int):
    from app.database import SessionLocal
    from app.models_v2_2 import Tenant, Reserva
    from app.services_v2_2 import enviar_email_confirmacion

    db = SessionLocal()
    try:
        tenant = db.get(Tenant, tenant_id)
        reserva = db.get(Reserva, reserva_id)
        if not tenant or not reserva:
            return
        enviar_email_confirmacion(tenant, reserva, reserva.creado_por, reserva.sesion)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
    finally:
        db.close()


@celery_app.task(bind=True, max_retries=3)
def sincronizar_calendario_task(self, tenant_id: int, sesion_id: int):
    from app.database import SessionLocal
    from app.models_v2_2 import Tenant, Sesion
    from app.services_v2_2 import sincronizar_calendario

    db = SessionLocal()
    try:
        tenant = db.get(Tenant, tenant_id)
        sesion = db.get(Sesion, sesion_id)
        if tenant and sesion:
            sincronizar_calendario(tenant, sesion)
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
    finally:
        db.close()


@celery_app.task
def limpiar_holds_job():
    from app.database import SessionLocal
    from app.services_v2_2 import limpiar_holds_expirados

    db = SessionLocal()
    try:
        n = limpiar_holds_expirados(db, lote=500)
        return {"liberadas": n}
    finally:
        db.close()
