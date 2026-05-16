// ─── Shape icons ──────────────────────────────────────────────────────────────

const SquareIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <rect x="2" y="2" width="8" height="8" fill="currentColor" />
  </svg>
)

const CircleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <circle cx="6" cy="6" r="4.5" fill="currentColor" />
  </svg>
)

const DiamondIcon = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <polygon points="6,1 11,6 6,11 1,6" fill="currentColor" />
  </svg>
)

const SHAPES = [
  { value: 'square',  Icon: SquareIcon,  label: 'Square'  },
  { value: 'circle',  Icon: CircleIcon,  label: 'Circle'  },
  { value: 'diamond', Icon: DiamondIcon, label: 'Diamond' },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function ShapePicker({ value, onChange }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 6,
    }}>
      {SHAPES.map(({ value: v, Icon, label }) => {
        const active = value === v
        return (
          <button
            key={v}
            title={label}
            onClick={() => onChange?.(v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              height: 32,
              borderRadius: 'var(--radius-sm)',
              border: active
                ? '1px solid rgba(0,87,200,0.6)'
                : '1px solid var(--border-input)',
              background: active
                ? 'rgba(0,87,200,0.12)'
                : 'var(--bg-input)',
              color: active
                ? 'var(--accent-blue)'
                : 'var(--text-tertiary)',
              fontSize: 10,
              fontWeight: 500,
              letterSpacing: '0.04em',
              transition: 'color 140ms cubic-bezier(0.25,0,0,1), background 140ms cubic-bezier(0.25,0,0,1), border-color 140ms cubic-bezier(0.25,0,0,1), transform 80ms cubic-bezier(0.25,0,0,1)',
              cursor: 'pointer',
            }}
            onMouseEnter={e => {
              if (!active) {
                e.currentTarget.style.color = 'var(--text-secondary)'
                e.currentTarget.style.background = 'var(--bg-hover)'
              }
            }}
            onMouseLeave={e => {
              if (!active) {
                e.currentTarget.style.color = 'var(--text-tertiary)'
                e.currentTarget.style.background = 'var(--bg-input)'
              }
            }}
          >
            <Icon />
            {label}
          </button>
        )
      })}
    </div>
  )
}
