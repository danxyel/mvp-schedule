// Extrae un mensaje de error legible de la respuesta de openapi-fetch.
//
// El backend traduce errores de negocio (ReservaError) a
// HTTPException(status, {"codigo": ..., "mensaje": ...}) — FastAPI los
// serializa como {"detail": {"codigo": ..., "mensaje": ...}}. openapi-fetch
// no desenvuelve ese `detail`, así que `fetchErr.detail` puede ser un
// STRING (errores simples, ej. HTTPException(404, "No encontrado")) o un
// OBJETO {codigo, mensaje} (errores de negocio). Renderizar ese objeto
// directo en JSX revienta con "Minified React error #31: object with keys
// {codigo, mensaje}" — este helper evita eso en los dos casos.
export function errorMensaje(err) {
  if (err?.detail && typeof err.detail === 'string') return err.detail
  return err?.mensaje ?? err?.detail?.mensaje ?? err?.message ?? JSON.stringify(err)
}
