# Instrucciones para agente — MVP Schedule v2.2

## Stack
- Backend: FastAPI + SQLAlchemy + PostgreSQL (NO modificar archivos en app/)
- Frontend: React + Tailwind CSS + Vite
- Cliente HTTP: openapi-fetch generado desde docs/openapi.json

## Reglas absolutas
- Nunca modificar archivos dentro de app/
- Nunca hacer fetch() directo — solo usar el cliente de openapi-fetch
- Nunca inventar un estado que no esté en docs/API-CONTRACT.md
- Una tarea = una pantalla. No integrar varias a la vez
- Commit después de cada pantalla funcionando
- Las fechas siempre con timezone offset, nunca naive

## Errores de negocio
Están definidos en docs/API-CONTRACT.md — todas las pantallas deben manejarlos