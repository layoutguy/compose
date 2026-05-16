import { useComposition } from '../hooks/useComposition'
import { computeGridLayout } from '../canvas/grid'

const UndoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M2 5H8.5C10.433 5 12 6.567 12 8.5S10.433 12 8.5 12H5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    <path d="M4.5 2.5L2 5l2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const RedoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M12 5H5.5C3.567 5 2 6.567 2 8.5S3.567 12 5.5 12H9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    <path d="M9.5 2.5L12 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)


function Pipe() {
  return <div style={{ width: 1, height: 12, background: 'var(--border-strong)', flexShrink: 0 }} />
}

function Stat({ label, value, muted }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      {label && <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{label}</span>}
      <span style={{
        fontSize: 11,
        color: muted ? 'var(--text-secondary)' : 'var(--text-primary)',
        fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </span>
    </div>
  )
}

function IconBtn({ children, onClick, disabled, title }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      width: 28, height: 28,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderRadius: 'var(--radius-sm)',
      color: disabled ? 'rgba(255,255,255,0.2)' : 'var(--text-tertiary)',
      transition: 'color 140ms cubic-bezier(0.25,0,0,1), background 140ms cubic-bezier(0.25,0,0,1), transform 80ms cubic-bezier(0.25,0,0,1), opacity 80ms cubic-bezier(0.25,0,0,1)',
    }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-hover)' } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'transparent' } }}>
      {children}
    </button>
  )
}

export default function StatusBar() {
  const { grid, display, advanced, logo, undo, redo, canUndo, canRedo } = useComposition()

  const layout = computeGridLayout(grid, { outputW: advanced.outputW, outputH: advanced.outputH })

  const integrityColor = {
    excellent:  '#34C463',
    acceptable: '#E8B84B',
    poor:       '#E85454',
    'n/a':      'rgba(255,255,255,0.2)',
  }[layout.integrity] ?? 'rgba(255,255,255,0.2)'

  return (
    <div style={{
      height: 'var(--statusbar-height)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 16px',
      borderTop: '1px solid var(--border)',
      flexShrink: 0, zIndex: 20,
    }}>

      {/* Left */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>

        {/* Logo indicator */}
        <span style={{ fontSize: 11, color: logo.url ? 'var(--text-secondary)' : 'var(--text-tertiary)' }}>
          {logo.name ?? 'No logo'}
        </span>

        <Pipe />

        <Stat label="Grid" value={`${grid.cols} × ${grid.rows}`} />
        <Pipe />
        <Stat value={`${layout.dotCount} dots`} muted />
        <Pipe />
        <Stat label="H" value={`${Math.round(layout.spacingX)}px`} muted />
        <Stat label="V" value={`${Math.round(layout.spacingY)}px`} muted />
        <Pipe />

        {/* Square integrity indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap' }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%',
            background: integrityColor,
            boxShadow: layout.integrity !== 'n/a' ? `0 0 5px ${integrityColor}` : 'none',
            flexShrink: 0, transition: 'background 0.2s, box-shadow 0.2s',
          }} />
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {layout.integrity === 'n/a' ? 'Square' : layout.integrity.charAt(0).toUpperCase() + layout.integrity.slice(1)}
          </span>
        </div>

        <Pipe />
        <Stat label="Margin" value={`${grid.margin}px`} />

        {/* Artboard size when non-default */}
        {(advanced.outputW !== 3840 || advanced.outputH !== 2160) && (
          <>
            <Pipe />
            <Stat label="Size" value={`${advanced.outputW}×${advanced.outputH}`} muted />
          </>
        )}

        {!display.showDots && (
          <>
            <Pipe />
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Dots hidden
            </span>
          </>
        )}
      </div>

      {/* Right: undo / redo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconBtn onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)">
          <UndoIcon />
        </IconBtn>
        <IconBtn onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)">
          <RedoIcon />
        </IconBtn>
      </div>

    </div>
  )
}
