export default function Field({
  label,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  error,
  disabled = false,
  children,
}) {
  const inputBase =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500 disabled:bg-gray-100 disabled:text-gray-500 min-h-11'
  const errorClasses = error
    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
    : ''

  return (
    <div className="space-y-1">
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">
          {label}
          {required ? <span className="ml-0.5 text-red-500">*</span> : null}
        </label>
      )}
      {children || (
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`${inputBase} ${errorClasses}`}
        />
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
