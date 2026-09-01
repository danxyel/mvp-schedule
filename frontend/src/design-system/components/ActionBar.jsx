import React from 'react'

export function ActionBar({ summary, action, gutter = 'var(--gutter-movil)', className, children, ...rest }) {
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        marginTop: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-5)',
        padding: `var(--space-5) ${gutter}`,
        background: 'var(--color-surface)',
        borderTop: 'var(--border-hairline)',
      }}
      className={className}
      {...rest}
    >
      <span
        style={{
          fontSize: 'var(--text-meta)',
          color: 'var(--color-text-muted)',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {summary}
      </span>
      <span style={{ marginLeft: 'auto', flex: 'none' }}>{action || children}</span>
    </div>
  )
}
