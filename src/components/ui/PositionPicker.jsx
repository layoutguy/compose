const POSITIONS = [
  { id: 'top-left',     col: 0, row: 0 },
  { id: 'top-center',   col: 1, row: 0 },
  { id: 'top-right',    col: 2, row: 0 },
  { id: 'mid-left',     col: 0, row: 1 },
  { id: 'mid-center',   col: 1, row: 1 },
  { id: 'mid-right',    col: 2, row: 1 },
  { id: 'bot-left',     col: 0, row: 2 },
  { id: 'bot-center',   col: 1, row: 2 },
  { id: 'bot-right',    col: 2, row: 2 },
]

function AnchorIcon({ col, row, selected }) {
  // The small filled dot shows which point on the logo is the anchor handle
  const ix = 2 + col * 5.5
  const iy = 2 + row * 5.5
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      {/* Logo bounding box */}
      <rect
        x="1" y="1" width="16" height="16" rx="2"
        stroke="currentColor" strokeWidth="1"
        opacity={selected ? 0.55 : 0.22}
      />
      {/* Anchor handle dot */}
      <circle
        cx={ix + 2.25} cy={iy + 2.25} r="2.5"
        fill="currentColor"
        opacity={selected ? 1 : 0.5}
      />
    </svg>
  )
}

export default function PositionPicker({ selected = 'bot-right', onSelect }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 4,
    }}>
      {POSITIONS.map(pos => {
        const isSelected = pos.id === selected
        return (
          <button
            key={pos.id}
            onClick={() => onSelect?.(pos.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: 32,
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${isSelected ? 'rgba(255,255,255,0.14)' : 'transparent'}`,
              background: isSelected ? 'rgba(255,255,255,0.07)' : 'transparent',
              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
              transition: 'background 0.12s ease, border-color 0.12s ease, color 0.12s ease',
            }}
            onMouseEnter={e => {
              if (!isSelected) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.04)'
                e.currentTarget.style.color = 'var(--text-primary)'
              }
            }}
            onMouseLeave={e => {
              if (!isSelected) {
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }
            }}
          >
            <AnchorIcon col={pos.col} row={pos.row} selected={isSelected} />
          </button>
        )
      })}
    </div>
  )
}
