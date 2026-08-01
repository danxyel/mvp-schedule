import { Navigate } from 'react-router-dom'

export default function ProtectedRoute({ children, allowedRoles }) {
  const token = sessionStorage.getItem('token')
  const usuarioStr = sessionStorage.getItem('usuario')
  
  if (!token || !usuarioStr) {
    return <Navigate to="/login" replace />
  }
  
  const usuario = JSON.parse(usuarioStr)
  
  if (allowedRoles && !allowedRoles.includes(usuario.rol)) {
    return <Navigate to="/login" replace />
  }
  
  return children
}
