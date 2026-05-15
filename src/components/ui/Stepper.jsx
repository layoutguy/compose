export default function Stepper({ value = 2, min = 1, max = 99, onChange }) {
  const btnBase = {
    width: 28,
    height: 30,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--text-secondary)',
    fontSize: 15,
    fontWeight: 300,
    transition: 'color 140ms cubic-bezier(0.25,0,0,1), transform 80ms cubic-bezier(0.25,0,0,1), opacity 80ms cubic-bezier(0.25,0,0,1)',
    flexShrink: 0,
  }

  const hoverIn  = e => e.currentTarget.style.color = 'var(--text-primary)'
  const hoverOut = e => e.currentTarget.style.color = 'var(--text-secondary)'

  const decrement = () => { if (value > min) onChange?.(value - 1) }
  const increment = () => { if (value < max) onChange?.(value + 1) }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>

      {/* Value display */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 36,
        height: 30,
        padding: '0 10px',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-sm)',
        fontSize: 13,
        color: 'var(--text-primary)',
        fontVariantNumeric: 'tabular-nums',
        background: 'var(--bg-input)',
      }}>
        {value}
      </div>

      {/* − + buttons */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        background: 'var(--bg-input)',
      }}>
        <button
          onClick={decrement}
          disabled={value <= min}
          style={{ ...btnBase, opacity: value <= min ? 0.3 : 1 }}
          onMouseEnter={hoverIn}
          onMouseLeave={hoverOut}
        >
          −
        </button>
        <div style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0 }} />
        <button
          onClick={increment}
          disabled={value >= max}
          style={{ ...btnBase, opacity: value >= max ? 0.3 : 1 }}
          onMouseEnter={hoverIn}
          onMouseLeave={hoverOut}
        >
          +
        </button>
      </div>

    </div>
  )
}
