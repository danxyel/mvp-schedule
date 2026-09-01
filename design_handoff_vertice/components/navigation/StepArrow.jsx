import React from 'react';

export function StepArrow({ direction = 'next', disabled = false, onClick, label, style, ...rest }) {
  const [hover, setHover] = React.useState(false);
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      aria-label={label || (direction === 'prev' ? 'Anterior' : 'Siguiente')}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: 40, height: 40, flex: 'none', borderRadius: 'var(--radius-pill)',
        background: hover && !disabled ? 'var(--color-accent-100)' : 'transparent',
        border: '1px solid var(--color-border-strong)',
        color: 'var(--color-text)', fontFamily: 'var(--font-heading)',
        fontSize: 18, lineHeight: 1, outlineOffset: 2,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? .35 : 1,
        transition: 'background var(--dur-fast) var(--ease-out)', ...style,
      }} {...rest}>{direction === 'prev' ? '‹' : '›'}</button>
  );
}
