"""
database.py — Conexión SQLAlchemy · PostgreSQL

Configuración via variables de entorno. Nunca hardcodear credenciales aquí.
Crear un archivo .env en la raíz del proyecto (ver .env.example).
"""

import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# Lee la URL de conexión desde el entorno.
# Formato: postgresql://usuario:password@host:puerto/nombre_db
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/mvp_schedule"
)

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,       # detecta conexiones muertas antes de usarlas
    pool_size=10,             # conexiones en el pool
    max_overflow=20,          # conexiones adicionales bajo carga
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",  # logs SQL en dev
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,   # transacciones explícitas — requerido por services_v2_2
    autoflush=False,    # el código hace flush cuando lo necesita
)


def get_db():
    """Dependencia FastAPI. Entrega una sesión y la cierra al terminar."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verificar_conexion() -> bool:
    """Útil para el health check. Devuelve True si la DB responde."""
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
