import { useRef, useState, useCallback } from 'react'
import { useComposition } from '../hooks/useComposition'
import PositionPicker from './ui/PositionPicker'
import { triggerTransition } from '../hooks/useCanvasTransition'
import { computeGridLayout } from '../canvas/grid'

// ─── Icons ────────────────────────────────────────────────────────────────────

const SnapIcon = ({ active }) => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <rect x="1" y="1" width="3.5" height="3.5" rx="0.8" fill="currentColor" opacity={active ? 0.9 : 0.3}/>
    <rect x="4.75" y="1" width="3.5" height="3.5" rx="0.8" fill="currentColor" opacity={active ? 1 : 0.35}/>
    <rect x="8.5" y="1" width="3.5" height="3.5" rx="0.8" fill="currentColor" opacity={active ? 0.9 : 0.3}/>
    <rect x="1" y="4.75" width="3.5" height="3.5" rx="0.8" fill="currentColor" opacity={active ? 0.7 : 0.25}/>
    <rect x="4.75" y="4.75" width="3.5" height="3.5" rx="0.8" fill="currentColor" opacity={active ? 1 : 0.6}/>
    <rect x="8.5" y="4.75" width="3.5" height="3.5" rx="0.8" fill="currentColor" opacity={active ? 0.7 : 0.25}/>
    <rect x="1" y="8.5" width="3.5" height="3.5" rx="0.8" fill="currentColor" opacity={active ? 0.9 : 0.3}/>
    <rect x="4.75" y="8.5" width="3.5" height="3.5" rx="0.8" fill="currentColor" opacity={active ? 1 : 0.35}/>
    <rect x="8.5" y="8.5" width="3.5" height="3.5" rx="0.8" fill="currentColor" opacity={active ? 0.9 : 0.3}/>
  </svg>
)

const UploadIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <path d="M6.5 9V3M6.5 3L4 5.5M6.5 3L9 5.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M1.5 10.5v.5h10v-.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
)

const MinusIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M2 5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
)

const PlusIcon = () => (
  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
    <path d="M5 2v6M2 5h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
  </svg>
)

const DiceIcon = () => (
  <svg width="14" height="14" viewBox="0 0 15 15" fill="none" style={{ display: 'block', marginLeft: 2, marginTop: -1 }}>
    <rect x="1" y="1" width="13" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.2"/>
    <circle cx="4.5" cy="4.5" r="1" fill="currentColor"/>
    <circle cx="10.5" cy="4.5" r="1" fill="currentColor"/>
    <circle cx="7.5" cy="7.5" r="1" fill="currentColor"/>
    <circle cx="4.5" cy="10.5" r="1" fill="currentColor"/>
    <circle cx="10.5" cy="10.5" r="1" fill="currentColor"/>
  </svg>
)

const SHAPES    = ['square', 'circle', 'diamond']
const POSITIONS = ['top-left','top-center','top-right','mid-left','mid-center','mid-right','bot-left','bot-center','bot-right']
const rInt  = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const rFrom = (arr) => arr[Math.floor(Math.random() * arr.length)]

const PositionIcon = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    {[0,1,2].flatMap(row => [0,1,2].map(col => (
      <circle key={`${row}-${col}`} cx={2.5 + col * 4} cy={2.5 + row * 4} r="1.1"
        fill="currentColor" opacity={row === 1 && col === 1 ? 0.9 : 0.4}/>
    )))}
  </svg>
)

// ─── Primitives ───────────────────────────────────────────────────────────────

function Sep() {
  return <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.07)', flexShrink: 0, margin: '0 6px' }} />
}

function ToolbarBtn({ children, active, onClick, style, title, hoverColor, hoverBg }) {
  const base = active ? 'var(--text-primary)' : 'var(--text-secondary)'
  return (
    <button onClick={onClick} title={title} style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 13px', height: '100%',
      borderRadius: 'var(--radius-md)',
      color: base,
      background: active ? 'rgba(255,255,255,0.06)' : 'transparent',
      fontSize: 11, fontWeight: 500,
      letterSpacing: '0.04em', textTransform: 'uppercase',
      transition: 'color 140ms cubic-bezier(0.25,0,0,1), background 140ms cubic-bezier(0.25,0,0,1), transform 80ms cubic-bezier(0.25,0,0,1), opacity 80ms cubic-bezier(0.25,0,0,1)',
      whiteSpace: 'nowrap', ...style,
    }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.color = hoverColor ?? 'var(--text-primary)'; e.currentTarget.style.background = hoverBg ?? 'rgba(255,255,255,0.05)' } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.color = base; e.currentTarget.style.background = active ? 'rgba(255,255,255,0.06)' : 'transparent' } }}>
      {children}
    </button>
  )
}

function IconBtn({ children, onClick, title, disabled }) {
  return (
    <button onClick={onClick} title={title} disabled={disabled} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: 28, height: '100%',
      borderRadius: 'var(--radius-md)',
      color: disabled ? 'rgba(255,255,255,0.18)' : 'var(--text-secondary)',
      background: 'transparent',
      transition: 'color 140ms cubic-bezier(0.25,0,0,1), background 140ms cubic-bezier(0.25,0,0,1), transform 80ms cubic-bezier(0.25,0,0,1), opacity 80ms cubic-bezier(0.25,0,0,1)',
    }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)' } }}
      onMouseLeave={e => { if (!disabled) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent' } }}>
      {children}
    </button>
  )
}

// ─── Position picker popup ────────────────────────────────────────────────────

function PositionPopup({ selected, onSelect, onClose }) {
  return (
    <div
      style={{
        position: 'absolute', bottom: 'calc(100% + 10px)', left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(16,16,20,0.95)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--radius-xl)',
        padding: '12px',
        width: 160,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(255,255,255,0.04) inset',
        zIndex: 50,
        pointerEvents: 'all',
        animation: 'popupIn 160ms cubic-bezier(0.25,0,0,1) both',
      }}
    >
      <div style={{ marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
          Anchor Point
        </span>
      </div>
      <PositionPicker selected={selected} onSelect={(v) => { onSelect(v); onClose() }} />
    </div>
  )
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

export default function BottomToolbar() {
  const {
    display, toggleDisplay,
    logo, setLogoFile, setLogoParam, clearLogo,
    grid, setGridParam, setDotParam, advanced,
  } = useComposition()

  const fileInputRef       = useRef(null)
  const [posOpen, setPosOpen] = useState(false)
  const posAnchorRef       = useRef(null)

  const handleFileChange = e => {
    const file = e.target.files?.[0]
    if (file) setLogoFile(file)
    e.target.value = ''
  }

  const logoLoaded = !!logo.url

  const handleShuffle = useCallback(() => {
    triggerTransition(() => {
      const outW   = advanced.outputW
      const outH   = advanced.outputH
      const margin = rInt(60, 220)
      const cols   = rInt(6, 28)
      const availW = outW - 2 * margin
      const availH = outH - 2 * margin
      let idealRows = Math.max(2, Math.round((cols - 1) * availH / availW) + 1)
      let bestRows = idealRows, bestRel = Infinity
      for (let r = Math.max(2, idealRows - 2); r <= idealRows + 2; r++) {
        const l = computeGridLayout({ cols, rows: r, margin }, { outputW: outW, outputH: outH })
        if (l.relDiff < bestRel) { bestRel = l.relDiff; bestRows = r }
      }
      setGridParam('cols',   cols)
      setGridParam('rows',   bestRows)
      setGridParam('margin', margin)
      setDotParam('size',    rInt(2, 9))
      setDotParam('shape',   rFrom(SHAPES))
      setDotParam('opacity', Math.round((0.5 + Math.random() * 0.5) * 100) / 100)
      if (logo.url) {
        setLogoParam('position', rFrom(POSITIONS))
        setLogoParam('sizeDots', rInt(1, 6))
        setLogoParam('offsetX',  0)
        setLogoParam('offsetY',  0)
      }
    })
  }, [advanced, logo.url, setGridParam, setDotParam, setLogoParam])

  // Logo size: increment / decrement sizeDots
  const decSize = useCallback(() => {
    setLogoParam('sizeDots', Math.max(0.1, Math.round((logo.sizeDots - 0.1) * 10) / 10))
  }, [logo.sizeDots, setLogoParam])

  const incSize = useCallback(() => {
    setLogoParam('sizeDots', Math.min(20, Math.round((logo.sizeDots + 0.1) * 10) / 10))
  }, [logo.sizeDots, setLogoParam])

  return (
    <div style={{
      position: 'absolute',
      bottom: 'max(24px, calc(env(safe-area-inset-bottom, 0px) + 12px))',
      left: '50%', transform: 'translateX(-50%)',
      zIndex: 30, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 10,
    }}>

      {/* Toolbar pill */}
      <div style={{
        display: 'flex', alignItems: 'center',
        height: 46, padding: '0 10px',
        background: 'rgba(16,16,20,0.88)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.04) inset',
        pointerEvents: 'all', position: 'relative',
      }}>

        {/* UPLOAD LOGO — glow only when no logo is loaded; plain when replacing */}
        {logoLoaded ? (
          <>
            <ToolbarBtn onClick={() => fileInputRef.current?.click()} title="Replace logo">
              <UploadIcon /> Replace
            </ToolbarBtn>
            <Sep />
            <ToolbarBtn onClick={clearLogo} title="Remove logo"
              hoverColor="rgba(232,84,84,0.9)" hoverBg="rgba(232,84,84,0.08)">
              Remove
            </ToolbarBtn>
            {!display.showGuides && <Sep />}
          </>
        ) : (
          <button
            onClick={() => fileInputRef.current?.click()}
            title="Upload logo (SVG or PNG)"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '0 17px',
              height: 46, margin: '0 -10px',
              borderRadius: 999,
              fontSize: 11, fontWeight: 500,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              background: 'transparent',
              border: '1px solid transparent',
              cursor: 'pointer',
              transition: 'color 140ms cubic-bezier(0.25,0,0,1), border-color 140ms cubic-bezier(0.25,0,0,1), background 140ms cubic-bezier(0.25,0,0,1), box-shadow 160ms cubic-bezier(0.25,0,0,1)',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.92)'
              e.currentTarget.style.borderColor = 'rgba(79,127,217,0.7)'
              e.currentTarget.style.background = 'rgba(79,127,217,0.08)'
              e.currentTarget.style.boxShadow = '0 0 0 1px rgba(79,127,217,0.2), 0 0 14px 3px rgba(79,127,217,0.2), 0 0 32px 6px rgba(79,127,217,0.08)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--text-secondary)'
              e.currentTarget.style.borderColor = 'transparent'
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            <UploadIcon /> Upload Logo
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp"
          style={{ display: 'none' }} onChange={handleFileChange} />

        {/* Logo-specific controls — only visible when a logo is loaded */}
        {logoLoaded && (
          <>
            {/* SNAP — controls logo alignment guide overlay */}
            <ToolbarBtn
              active={display.showGuides}
              onClick={() => toggleDisplay('showGuides')}
              title={display.showGuides ? 'Snap off' : 'Snap on'}
            >
              <div style={{
                width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                background: display.showGuides ? 'var(--accent-blue)' : 'rgba(79,127,217,0.4)',
                boxShadow: display.showGuides ? '0 0 6px var(--accent-blue-glow)' : 'none',
                transition: 'background 0.2s, box-shadow 0.2s',
              }} />
              Snap
            </ToolbarBtn>

            {!display.showGuides && <Sep />}

            {/* LOGO SIZE — minus / value / plus */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, height: '100%' }}>
              <IconBtn onClick={decSize} title="Decrease size" disabled={logo.sizeDots <= 0.1}>
                <MinusIcon />
              </IconBtn>

              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 4,
                padding: '0 4px',
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
                  {logo.sizeDots}
                </span>
                <span style={{ fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  {logo.sizeDots === 1 ? 'dot' : 'dots'}
                </span>
              </div>

              <IconBtn onClick={incSize} title="Increase size" disabled={logo.sizeDots >= 20}>
                <PlusIcon />
              </IconBtn>
            </div>

            <Sep />

            {/* POSITION — opens 3×3 picker popup */}
            <div ref={posAnchorRef} style={{ position: 'relative', height: '100%', display: 'flex', alignItems: 'center' }}>
              <ToolbarBtn
                active={posOpen}
                onClick={() => setPosOpen(o => !o)}
                title="Logo position"
              >
                <span style={{ fontSize: 10, letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
                  Position
                </span>
                <PositionIcon />
              </ToolbarBtn>

              {posOpen && (
                <>
                  {/* Invisible backdrop — closes popup on click/tap outside */}
                  <div
                    onMouseDown={() => setPosOpen(false)}
                    onTouchStart={() => setPosOpen(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 45 }}
                  />
                  <div style={{ position: 'relative', zIndex: 50 }}>
                    <PositionPopup
                      selected={logo.position}
                      onSelect={v => setLogoParam('position', v)}
                      onClose={() => setPosOpen(false)}
                    />
                  </div>
                </>
              )}
            </div>
          </>
        )}

      </div>

      {/* Standalone shuffle button */}
      <button
        onClick={handleShuffle}
        title="Shuffle — randomise grid, dots and logo"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 46, height: 46, flexShrink: 0,
          borderRadius: 'var(--radius-xl)',
          background: '#4F7FD9',
          border: '1px solid #6E9AE8',
          color: '#fff',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          pointerEvents: 'all',
          transition: 'background 140ms, transform 120ms',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = '#6090E4' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#4F7FD9' }}
        onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.88) rotate(20deg)' }}
        onMouseUp={e => { e.currentTarget.style.transform = 'scale(1) rotate(0deg)' }}
      >
        <DiceIcon />
      </button>
    </div>
  )
}
