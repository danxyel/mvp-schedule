const PADDING = {
  sm: 'p-4',
  md: 'p-6',
}

export default function Card({ children, padding = 'md', className = '' }) {
  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm ${PADDING[padding]} ${className}`}>
      {children}
    </div>
  )
}
