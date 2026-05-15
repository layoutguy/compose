import { useRef, useState, useEffect, useCallback } from 'react'
import PrecisionSlider from './ui/PrecisionSlider'
import PositionPicker from './ui/PositionPicker'
import ShapePicker from './ui/ShapePicker'
import { useComposition } from '../hooks/useComposition'
import { computeGridLayout } from '../canvas/grid'
import { renderExportCanvas } from '../export/renderExportCanvas'
import {
  exportAsPNG, exportAsJPG, exportAsWEBP, exportAsPDF, exportAsSVG,
  exportDimensions, estimateSize,
} from '../export/exportFormats'

// ─── Constants ────────────────────────────────────────────────────────────────

const ARTBOARD_PRESETS = [
  { label: '4K',  w: 3840, h: 2160 },
  { label: '2K',  w: 2560, h: 1440 },
  { label: 'FHD', w: 1920, h: 1080 },
  { label: 'UW',  w: 3440, h: 1440 },
]

// Aspect ratio presets — clicking keeps the current width and recalculates height
const RATIO_PRESETS = [
  { label: '16:9',  rw: 16, rh: 9  },
  { label: '21:9',  rw: 21, rh: 9  },
  { label: '4:3',   rw:  4, rh: 3  },
  { label: '1:1',   rw:  1, rh: 1  },
  { label: '9:16',  rw:  9, rh: 16 },
  { label: '3:2',   rw:  3, rh: 2  },
]

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b) }

const BLEND_MODES = [
  { label: 'Normal',   value: 'normal'     },
  { label: 'Screen',   value: 'screen'     },
  { label: 'Overlay',  value: 'overlay'    },
  { label: 'Soft Lt',  value: 'soft-light' },
  { label: 'Multiply', value: 'multiply'   },
]

// ─── Icons ────────────────────────────────────────────────────────────────────

const FileIcon = () => (
  <svg width="12" height="13" viewBox="0 0 12 13" fill="none">
    <path d="M2 2a1 1 0 011-1h4.586a.5.5 0 01.353.146l2.915 2.915A.5.5 0 0111 4.414V11a1 1 0 01-1 1H3a1 1 0 01-1-1V2z"
      stroke="currentColor" strokeWidth="0.85" fill="none"/>
    <path d="M7 1.5V4.5H10" stroke="currentColor" strokeWidth="0.85" strokeLinejoin="round"/>
  </svg>
)

const UploadIcon = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <path d="M5.5 8V2.5M5.5 2.5L3 5M5.5 2.5L8 5"
      stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M1.5 9h8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
  </svg>
)

const ArrowUpRight = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path d="M3 9L9 3M9 3H4.5M9 3v4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// ─── Shared styles ────────────────────────────────────────────────────────────

const labelStyle = { fontSize: 12, color: 'var(--text-secondary)' }

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ label, active, dot }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      height: 36, padding: '0 16px',
      borderBottom: '1px solid var(--border)', flexShrink: 0,
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
        {label}
      </span>
      {(active || dot) && (
        <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--accent-blue)', flexShrink: 0 }} />
      )}
    </div>
  )
}

function SliderRow({ label, displayValue, min, max, step = 1, value, onChange, clamped }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={labelStyle}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {clamped && (
            <span style={{ fontSize: 9, color: 'var(--accent-blue)', letterSpacing: '0.05em', textTransform: 'uppercase', opacity: 0.7 }}>
              auto-fit
            </span>
          )}
          <span style={{
            fontSize: 12, fontVariantNumeric: 'tabular-nums',
            color: clamped ? 'var(--text-secondary)' : 'var(--text-primary)',
            transition: 'color 140ms cubic-bezier(0.25,0,0,1)',
          }}>
            {displayValue}
          </span>
        </div>
      </div>
      <PrecisionSlider min={min} max={max} step={step} value={value} onChange={onChange} />
    </div>
  )
}

function OffsetInput({ axis, value, onChange }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => { setDraft(String(value)) }, [value])
  const commit = () => {
    const n = parseInt(draft, 10)
    if (!isNaN(n)) onChange?.(n); else setDraft(String(value))
  }
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', gap: 7,
      height: 32, padding: '0 10px',
      border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)',
      background: 'var(--bg-input)',
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', flexShrink: 0 }}>{axis}</span>
      <input value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { commit(); e.currentTarget.blur() } }}
        style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }} />
      <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>px</span>
    </div>
  )
}

function NumberInput({ axis, value, onChange, unit = '' }) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => { setDraft(String(value)) }, [value])
  const commit = () => {
    const n = parseInt(draft, 10)
    if (!isNaN(n) && n > 0) onChange?.(n); else setDraft(String(value))
  }
  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', gap: 7,
      height: 32, padding: '0 10px',
      border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)',
      background: 'var(--bg-input)',
    }}>
      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-tertiary)', letterSpacing: '0.04em', flexShrink: 0 }}>{axis}</span>
      <input value={draft} onChange={e => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={e => { if (e.key === 'Enter') { commit(); e.currentTarget.blur() } }}
        style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }} />
      {unit && <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>{unit}</span>}
    </div>
  )
}

/**
 * Artboard dimension input — live preview while typing + drag-to-scrub on the axis label.
 *
 * Interaction model:
 *  • Type a number → artboard updates after 220 ms debounce (no Enter needed)
 *  • Click axis label (W / H) and drag left/right → scrubs value live (1 px per drag-px)
 *  • Blur / Enter → commits immediately
 */
function ArtboardDimInput({ axis, value, onChange }) {
  const [draft,   setDraft]   = useState(String(value))
  const [focused, setFocused] = useState(false)
  const [dragging, setDragging] = useState(false)
  const debounceRef = useRef(null)
  const dragRef     = useRef(null) // { startX, startValue }

  // Keep draft in sync when value changes externally (e.g. preset click)
  useEffect(() => { if (!focused && !dragging) setDraft(String(value)) }, [value, focused, dragging])

  const apply = useCallback((n) => {
    const clamped = Math.max(1, Math.min(32000, n))
    onChange?.(clamped)
  }, [onChange])

  // ── Typing — live debounced update ──────────────────────────────────────────
  const handleChange = (e) => {
    const raw = e.target.value
    setDraft(raw)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const n = parseInt(raw, 10)
      if (!isNaN(n)) apply(n)
    }, 220)
  }

  const commit = () => {
    setFocused(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const n = parseInt(draft, 10)
    if (!isNaN(n)) apply(n); else setDraft(String(value))
  }

  // ── Drag scrub on axis label ─────────────────────────────────────────────────
  const handleLabelMouseDown = (e) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startValue: value }
    setDragging(true)

    const onMove = (me) => {
      const delta = Math.round((me.clientX - dragRef.current.startX) * 3)
      const next  = Math.max(1, Math.min(32000, dragRef.current.startValue + delta))
      setDraft(String(next))
      apply(next)
    }
    const onUp = () => {
      setDragging(false)
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return (
    <div style={{
      minWidth: 0, // grid cell must opt out of min-width:auto or it overflows
      display: 'flex', alignItems: 'center', gap: 5,
      height: 32, padding: '0 8px',
      border: `1px solid ${focused || dragging ? 'rgba(79,127,217,0.55)' : 'var(--border-input)'}`,
      borderRadius: 'var(--radius-sm)',
      background: focused || dragging ? 'rgba(79,127,217,0.06)' : 'var(--bg-input)',
      transition: 'border-color 140ms, background 0.12s',
      overflow: 'hidden',
    }}>
      {/* Drag-scrub label */}
      <span
        onMouseDown={handleLabelMouseDown}
        title={`Drag to scrub ${axis}`}
        style={{
          fontSize: 10, fontWeight: 700,
          color: focused || dragging ? 'rgba(79,127,217,0.9)' : 'var(--text-tertiary)',
          letterSpacing: '0.05em', flexShrink: 0,
          cursor: 'ew-resize', userSelect: 'none',
          transition: 'color 0.12s',
        }}>
        {axis}
      </span>
      <input
        value={draft}
        onChange={handleChange}
        onFocus={e => { setFocused(true); e.currentTarget.select() }}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { commit(); e.currentTarget.blur() } }}
        style={{
          flex: 1, minWidth: 0,
          background: 'none', border: 'none', outline: 'none',
          fontSize: 12, fontWeight: 500,
          color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      />
      <span style={{ fontSize: 9, color: 'var(--text-tertiary)', flexShrink: 0 }}>px</span>
    </div>
  )
}

/**
 * Inline scrub input — full-width row with a draggable label on the left.
 * Drag label left/right to scrub; click inside and type for precision; Enter/blur commits.
 */
function ScrubInput({ label, value, onChange, min = 0, max = 9999, step = 1, unit = '', dragMultiplier = 1 }) {
  const [draft,    setDraft]    = useState(String(value))
  const [focused,  setFocused]  = useState(false)
  const [dragging, setDragging] = useState(false)
  const debounceRef = useRef(null)
  const dragRef     = useRef(null)

  useEffect(() => { if (!focused && !dragging) setDraft(String(value)) }, [value, focused, dragging])

  const apply = useCallback((n) => {
    const snapped = step < 1 ? Math.round(n / step) * step : Math.round(n)
    const clamped = Math.max(min, Math.min(max, snapped))
    const decimals = step < 1 ? (String(step).split('.')[1]?.length ?? 0) : 0
    onChange?.(parseFloat(clamped.toFixed(decimals)))
  }, [onChange, min, max, step])

  const handleChange = (e) => {
    const raw = e.target.value
    setDraft(raw)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const n = parseFloat(raw)
      if (!isNaN(n)) apply(n)
    }, 220)
  }

  const commit = () => {
    setFocused(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const n = parseFloat(draft)
    if (!isNaN(n)) apply(n); else setDraft(String(value))
  }

  const handleLabelMouseDown = (e) => {
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startValue: value }
    setDragging(true)
    const decimals = step < 1 ? (String(step).split('.')[1]?.length ?? 0) : 0
    const onMove = (me) => {
      const raw     = dragRef.current.startValue + (me.clientX - dragRef.current.startX) * dragMultiplier
      const snapped = step < 1 ? Math.round(raw / step) * step : Math.round(raw)
      const clamped = Math.max(min, Math.min(max, snapped))
      const clean   = parseFloat(clamped.toFixed(decimals))
      setDraft(String(clean))
      apply(clean)
    }
    const onUp = () => {
      setDragging(false)
      dragRef.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  const active = focused || dragging
  return (
    <div style={{
      display: 'flex', alignItems: 'stretch',
      height: 32,
      border: `1px solid ${active ? 'rgba(79,127,217,0.55)' : 'var(--border-input)'}`,
      borderRadius: 'var(--radius-sm)',
      background: active ? 'rgba(79,127,217,0.06)' : 'var(--bg-input)',
      overflow: 'hidden',
      transition: 'border-color 140ms, background 0.12s',
    }}>
      {/* Draggable label */}
      <span
        onMouseDown={handleLabelMouseDown}
        title={`Drag to scrub ${label}`}
        style={{
          display: 'flex', alignItems: 'center',
          padding: '0 10px',
          fontSize: 11, fontWeight: 500, letterSpacing: '0.02em',
          color: active ? 'rgba(79,127,217,0.9)' : 'var(--text-secondary)',
          borderRight: `1px solid ${active ? 'rgba(79,127,217,0.2)' : 'var(--border)'}`,
          background: active ? 'rgba(79,127,217,0.05)' : 'rgba(255,255,255,0.015)',
          cursor: 'ew-resize', userSelect: 'none', flexShrink: 0,
          transition: 'color 140ms, background 140ms, border-color 0.12s',
        }}>
        {label}
      </span>
      {/* Numeric input */}
      <input
        value={draft}
        onChange={handleChange}
        onFocus={e => { setFocused(true); e.currentTarget.select() }}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { commit(); e.currentTarget.blur() } }}
        style={{
          flex: 1, minWidth: 0, padding: '0 8px',
          background: 'none', border: 'none', outline: 'none',
          fontSize: 12, fontWeight: 500,
          color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      />
      {unit && (
        <span style={{
          display: 'flex', alignItems: 'center',
          paddingRight: 9, fontSize: 10,
          color: active ? 'rgba(79,127,217,0.6)' : 'var(--text-tertiary)',
          flexShrink: 0,
          transition: 'color 0.12s',
        }}>
          {unit}
        </span>
      )}
    </div>
  )
}

function ColorSwatch({ value, onChange }) {
  return (
    <div style={{ position: 'relative', height: 32, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-input)' }}>
      <div style={{ position: 'absolute', inset: 0, background: value, transition: 'background 120ms cubic-bezier(0.25,0,0,1)' }} />
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', paddingLeft: 10,
        fontSize: 11, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase',
        color: 'rgba(0,0,0,0.4)', pointerEvents: 'none', userSelect: 'none',
      }}>
        {value}
      </div>
      <input type="color" value={value} onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer', border: 'none' }} />
    </div>
  )
}

function SegmentRow({ items, active, onSelect, cols }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols ?? items.length}, 1fr)`, gap: 4 }}>
      {items.map(item => {
        const isActive = active === (item.value ?? item)
        const label    = item.label ?? item
        const value    = item.value ?? item
        return (
          <button key={String(value)} onClick={() => onSelect(value)} style={{
            height: 28, borderRadius: 'var(--radius-sm)',
            fontSize: 10, fontWeight: isActive ? 600 : 400, letterSpacing: '0.04em',
            border: isActive ? '1px solid rgba(79,127,217,0.6)' : '1px solid var(--border-input)',
            background: isActive ? 'rgba(79,127,217,0.12)' : 'var(--bg-input)',
            color: isActive ? 'var(--accent-blue)' : 'var(--text-tertiary)',
            transition: 'color 0.1s, background 0.1s, border-color 0.1s', cursor: 'pointer',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
            onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)' } }}
            onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'var(--bg-input)' } }}>
            {label}
          </button>
        )
      })}
    </div>
  )
}

function SubDivider() {
  return <div style={{ height: 1, background: 'var(--border)', opacity: 0.5 }} />
}

// ─── Grid integrity display ───────────────────────────────────────────────────

const INTEGRITY_COLORS = {
  excellent:  '#34C463',   // green
  acceptable: '#E8B84B',  // amber
  poor:       '#E85454',  // red
  'n/a':      'var(--text-tertiary)',
}

const INTEGRITY_LABELS = {
  excellent:  'Excellent',
  acceptable: 'Acceptable',
  poor:       'Poor',
  'n/a':      '—',
}

function GridIntegrity({ layout }) {
  const { spacingX, spacingY, diff, integrity, dotCount } = layout
  const color = INTEGRITY_COLORS[integrity] ?? 'var(--text-tertiary)'
  const label = INTEGRITY_LABELS[integrity] ?? '—'
  const showMetrics = integrity !== 'n/a'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
    }}>

      {/* Interval rows */}
      {showMetrics && (
        <>
          <IntegrityRow label="H Interval" value={`${Math.round(spacingX)}px`} />
          <IntegrityRow label="V Interval" value={`${Math.round(spacingY)}px`} />
          <IntegrityRow label="Difference" value={`${diff}px`} />
        </>
      )}

      {/* Integrity status — always visible */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '7px 11px',
        background: showMetrics ? `color-mix(in srgb, ${color} 6%, transparent)` : 'transparent',
        borderTop: showMetrics ? '1px solid var(--border)' : 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {showMetrics && (
            <div style={{
              width: 5, height: 5, borderRadius: '50%',
              background: color,
              boxShadow: `0 0 6px ${color}`,
              flexShrink: 0,
            }} />
          )}
          <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Square Integrity</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color, letterSpacing: '0.03em' }}>
          {label}
        </span>
      </div>

      {/* Dot count */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '7px 11px',
        borderTop: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Total dots</span>
        <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
          {dotCount}
        </span>
      </div>

    </div>
  )
}

function IntegrityRow({ label, value }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '7px 11px',
      borderBottom: '1px solid var(--border)',
    }}>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </span>
    </div>
  )
}

// ─── Panel ────────────────────────────────────────────────────────────────────

export default function RightPanel({ sheetMode = false }) {
  const {
    grid,     setGridParam,
    dot,      setDotParam,
    logo,     setLogoFile, setLogoParam, clearLogo,
    xport,    setExportOption,
    advanced, setAdvancedParam, setBgImageFile, clearBgImage,
  } = useComposition()

  const [isExporting, setIsExporting] = useState(false)
  const [exportDone,  setExportDone]  = useState(false)

  const handleExport = useCallback(async () => {
    if (isExporting) return
    setIsExporting(true); setExportDone(false)
    await new Promise(r => setTimeout(r, 60))
    try {
      const { format, scale } = xport
      const { outputW, outputH } = advanced
      const dimTag   = (outputW !== 3840 || outputH !== 2160) ? `_${outputW}x${outputH}` : ''
      const basename = `dot-grid-${grid.cols}x${grid.rows}${dimTag}`
      if (format === 'svg') {
        await exportAsSVG(grid, dot, logo, advanced, `${basename}.svg`)
      } else {
        const canvas = await renderExportCanvas(grid, dot, logo, scale, advanced, format === 'png')
        const name   = scale > 1 ? `${basename}-${scale}x` : basename
        if (format === 'png')  await exportAsPNG(canvas,  `${name}.png`)
        if (format === 'jpg')  await exportAsJPG(canvas,  `${name}.jpg`)
        if (format === 'webp') await exportAsWEBP(canvas, `${name}.webp`)
        if (format === 'pdf')  await exportAsPDF(canvas,  `${name}.pdf`)
      }
      setExportDone(true)
      setTimeout(() => setExportDone(false), 2000)
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setIsExporting(false)
    }
  }, [isExporting, xport, grid, dot, logo, advanced])

  const logoFileRef = useRef(null)
  const bgFileRef   = useRef(null)

  const handleLogoFileChange = e => { const f = e.target.files?.[0]; if (f) setLogoFile(f); e.target.value = '' }
  const handleBgFileChange   = e => { const f = e.target.files?.[0]; if (f) setBgImageFile(f); e.target.value = '' }

  const layout          = computeGridLayout(grid, { outputW: advanced.outputW, outputH: advanced.outputH })
  const isCustomArtboard = !ARTBOARD_PRESETS.some(p => p.w === advanced.outputW && p.h === advanced.outputH)

  const expDims = xport.format === 'svg'
    ? { w: advanced.outputW, h: advanced.outputH }
    : exportDimensions(xport.scale, advanced)

  const hasNonDefaultAdvanced = advanced.blendMode !== 'normal' ||
    advanced.exportPadding > 0 || !advanced.retinaPreview

  return (
    <div style={{
      width: sheetMode ? '100%' : 'var(--panel-width)',
      flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      borderLeft: sheetMode ? 'none' : '1px solid var(--border)',
      background: 'var(--bg-panel)',
      overflowY: 'auto', overflowX: 'hidden',
      // iOS momentum scrolling
      WebkitOverflowScrolling: 'touch',
      // Safe area padding for home indicator
      paddingBottom: sheetMode ? 'env(safe-area-inset-bottom, 0px)' : 0,
    }}>

      {/* ══ 1. ARTBOARD SIZE ══ */}
      <SectionHeader label="Artboard" dot={isCustomArtboard} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px 18px', borderBottom: '1px solid var(--border)' }}>

        {/* W / H inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, minWidth: 0 }}>
          <ArtboardDimInput axis="W" value={advanced.outputW} onChange={v => setAdvancedParam('outputW', v)} />
          <ArtboardDimInput axis="H" value={advanced.outputH} onChange={v => setAdvancedParam('outputH', v)} />
        </div>

        {/* Size presets */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          {ARTBOARD_PRESETS.map(p => {
            const a = advanced.outputW === p.w && advanced.outputH === p.h
            return (
              <button key={p.label}
                onClick={() => { setAdvancedParam('outputW', p.w); setAdvancedParam('outputH', p.h) }}
                style={{
                  height: 26, borderRadius: 'var(--radius-sm)',
                  fontSize: 10, fontWeight: a ? 600 : 400, letterSpacing: '0.04em',
                  border: a ? '1px solid rgba(79,127,217,0.6)' : '1px solid var(--border-input)',
                  background: a ? 'rgba(79,127,217,0.12)' : 'var(--bg-input)',
                  color: a ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                  transition: 'all 0.1s', cursor: 'pointer',
                }}
                onMouseEnter={e => { if (!a) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)' } }}
                onMouseLeave={e => { if (!a) { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'var(--bg-input)' } }}>
                {p.label}
              </button>
            )
          })}
        </div>

        {/* Ratio presets — keeps current width, recalculates height */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
          {RATIO_PRESETS.map(p => {
            const d = gcd(advanced.outputW, advanced.outputH)
            const curRW = advanced.outputW / d
            const curRH = advanced.outputH / d
            const a = curRW === p.rw && curRH === p.rh
            return (
              <button key={p.label}
                onClick={() => setAdvancedParam('outputH', Math.round(advanced.outputW * p.rh / p.rw))}
                style={{
                  height: 26, borderRadius: 'var(--radius-sm)',
                  fontSize: 9, fontWeight: a ? 600 : 400, letterSpacing: '0.03em',
                  border: a ? '1px solid rgba(79,127,217,0.6)' : '1px solid var(--border-input)',
                  background: a ? 'rgba(79,127,217,0.12)' : 'var(--bg-input)',
                  color: a ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                  transition: 'all 0.1s', cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={e => { if (!a) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)' } }}
                onMouseLeave={e => { if (!a) { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'var(--bg-input)' } }}>
                {p.label}
              </button>
            )
          })}
        </div>

      </div>

      {/* ══ 2. BACKGROUND ══ */}
      <SectionHeader label="Background" dot={advanced.bgType !== 'solid'} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px 18px', borderBottom: '1px solid var(--border)' }}>

        <SegmentRow
          items={[{ label: 'Solid', value: 'solid' }, { label: 'Gradient', value: 'gradient' }, { label: 'Image', value: 'image' }]}
          active={advanced.bgType} onSelect={v => setAdvancedParam('bgType', v)} cols={3}
        />

        {advanced.bgType === 'solid' && (
          <ColorSwatch value={advanced.bgColor} onChange={v => setAdvancedParam('bgColor', v)} />
        )}

        {advanced.bgType === 'gradient' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>From</span>
                <ColorSwatch value={advanced.bgGradientFrom} onChange={v => setAdvancedParam('bgGradientFrom', v)} />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>To</span>
                <ColorSwatch value={advanced.bgGradientTo} onChange={v => setAdvancedParam('bgGradientTo', v)} />
              </div>
            </div>
            <SliderRow label="Angle" displayValue={`${advanced.bgGradientAngle}°`}
              min={0} max={360} step={1} value={advanced.bgGradientAngle}
              onChange={v => setAdvancedParam('bgGradientAngle', v)} />
          </div>
        )}

        {advanced.bgType === 'image' && (
          <>
            <input ref={bgFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBgFileChange} />
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px',
              border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
            }}>
              <span style={{ color: 'var(--text-tertiary)', flexShrink: 0, display: 'flex' }}><FileIcon /></span>
              <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: advanced.bgImageName ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
                {advanced.bgImageName ?? 'No image selected'}
              </span>
              {advanced.bgImageUrl ? (
                <button onClick={clearBgImage} style={{ fontSize: 15, lineHeight: 1, color: 'var(--text-tertiary)', padding: 2, flexShrink: 0 }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>×</button>
              ) : (
                <button onClick={() => bgFileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)', flexShrink: 0 }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
                  <UploadIcon /> Browse
                </button>
              )}
            </div>
          </>
        )}

      </div>

      {/* ══ 2. GRID ══ */}
      <SectionHeader label="Grid" active />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '14px 16px 18px', borderBottom: '1px solid var(--border)' }}>

        <ScrubInput label="Columns" value={grid.cols}   onChange={v => setGridParam('cols', Math.max(1, v))}   min={1} max={50}  step={1} dragMultiplier={0.25} />
        <ScrubInput label="Rows"    value={grid.rows}   onChange={v => setGridParam('rows', Math.max(1, v))}   min={1} max={30}  step={1} dragMultiplier={0.18} />
        <ScrubInput label="Margin"  value={grid.margin} onChange={v => setGridParam('margin', v)} min={0} max={500} step={1} unit="px" dragMultiplier={1.2} />

        {/* Square integrity — passive, read-only diagnostic */}
        <GridIntegrity layout={layout} />

      </div>

      {/* ══ 3. DOT ══ */}
      <SectionHeader label="Dot" active />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '14px 16px 18px', borderBottom: '1px solid var(--border)' }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={labelStyle}>Shape</span>
          <ShapePicker value={dot.shape} onChange={v => setDotParam('shape', v)} />
        </div>

        <SliderRow label="Size"    displayValue={`${dot.size}px`}                     min={2}  max={20}  step={1}    value={dot.size}    onChange={v => setDotParam('size', v)} />
        <SliderRow label="Opacity" displayValue={`${Math.round(dot.opacity * 100)}%`} min={0}  max={1}   step={0.01} value={dot.opacity} onChange={v => setDotParam('opacity', v)} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={labelStyle}>Color</span>
          <ColorSwatch value={dot.color} onChange={v => setDotParam('color', v)} />
        </div>

      </div>

      {/* ══ 4. LOGO ══ */}
      <SectionHeader label="Logo" active={!!logo.url} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '14px 16px 18px', borderBottom: '1px solid var(--border)' }}>

        <input ref={logoFileRef} type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp"
          style={{ display: 'none' }} onChange={handleLogoFileChange} />

        {/* File row */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, height: 32, padding: '0 10px',
          border: '1px solid var(--border-input)', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)',
        }}>
          <span style={{ color: 'var(--text-tertiary)', flexShrink: 0, display: 'flex' }}><FileIcon /></span>
          <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: logo.name ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
            {logo.name ?? 'No file selected'}
          </span>
          {logo.url ? (
            <button onClick={clearLogo} style={{ fontSize: 15, lineHeight: 1, color: 'var(--text-tertiary)', padding: 2, flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>×</button>
          ) : (
            <button onClick={() => logoFileRef.current?.click()} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-tertiary)', flexShrink: 0 }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--text-secondary)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--text-tertiary)'}>
              <UploadIcon /> Browse
            </button>
          )}
        </div>

        {!logo.url && (
          <p style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.5, margin: 0 }}>
            Drop an SVG or PNG onto the canvas, or browse to upload. Use the toolbar handles to resize the logo.
          </p>
        )}

        {logo.url && (
          <>
            {/* Size */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <ScrubInput
                label="Size"
                value={logo.sizeDots}
                onChange={v => setLogoParam('sizeDots', v)}
                min={0.1} max={20} step={0.1} unit="dots" dragMultiplier={0.08}
              />
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(logo.sizeDots * layout.spacingX)}px output width
              </span>
            </div>

            {/* Position */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={labelStyle}>Position</span>
              <PositionPicker selected={logo.position} onSelect={v => setLogoParam('position', v)} />
            </div>

            {/* Offset */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={labelStyle}>Offset</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <OffsetInput axis="X" value={logo.offsetX} onChange={v => setLogoParam('offsetX', v)} />
                <OffsetInput axis="Y" value={logo.offsetY} onChange={v => setLogoParam('offsetY', v)} />
              </div>
            </div>
          </>
        )}

      </div>

      {/* ══ 6. ADVANCED ══ */}
      <SectionHeader label="Advanced" dot={hasNonDefaultAdvanced} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '14px 16px 18px', borderBottom: '1px solid var(--border)' }}>

        {/* Blend mode */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={labelStyle}>Dot Blend Mode</span>
          <SegmentRow items={BLEND_MODES} active={advanced.blendMode} onSelect={v => setAdvancedParam('blendMode', v)} cols={5} />
        </div>

        <SubDivider />

        {/* Export padding */}
        <SliderRow label="Export Padding" displayValue={`${advanced.exportPadding}px`}
          min={0} max={400} step={4} value={advanced.exportPadding} onChange={v => setAdvancedParam('exportPadding', v)} />

        {/* Retina preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={labelStyle}>Preview Quality</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              {advanced.retinaPreview ? 'Full DPR' : '1× only'}
            </span>
          </div>
          <SegmentRow
            items={[{ label: 'Standard', value: false }, { label: 'Retina', value: true }]}
            active={advanced.retinaPreview} onSelect={v => setAdvancedParam('retinaPreview', v)} cols={2}
          />
        </div>

      </div>

      {/* ══ 7. EXPORT ══ */}
      <SectionHeader label="Export" active />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '14px 16px 20px' }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={labelStyle}>Format</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
            {['png','jpg','svg','webp','pdf'].map(fmt => {
              const a = xport.format === fmt
              return (
                <button key={fmt} onClick={() => setExportOption('format', fmt)} style={{
                  height: 28, borderRadius: 'var(--radius-sm)',
                  fontSize: 10, fontWeight: a ? 600 : 400, letterSpacing: '0.05em', textTransform: 'uppercase',
                  border: a ? '1px solid rgba(79,127,217,0.6)' : '1px solid var(--border-input)',
                  background: a ? 'rgba(79,127,217,0.12)' : 'var(--bg-input)',
                  color: a ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                  transition: 'all 0.1s', cursor: 'pointer',
                }}
                  onMouseEnter={e => { if (!a) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)' }}}
                  onMouseLeave={e => { if (!a) { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'var(--bg-input)' }}}>
                  {fmt}
                </button>
              )
            })}
          </div>
        </div>

        {xport.format !== 'svg' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={labelStyle}>Scale</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
              {[1, 2, 4].map(s => {
                const a = xport.scale === s
                return (
                  <button key={s} onClick={() => setExportOption('scale', s)} style={{
                    height: 28, borderRadius: 'var(--radius-sm)',
                    fontSize: 11, fontWeight: a ? 600 : 400,
                    border: a ? '1px solid rgba(79,127,217,0.6)' : '1px solid var(--border-input)',
                    background: a ? 'rgba(79,127,217,0.12)' : 'var(--bg-input)',
                    color: a ? 'var(--accent-blue)' : 'var(--text-tertiary)',
                    transition: 'all 0.1s', cursor: 'pointer',
                  }}
                    onMouseEnter={e => { if (!a) { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'var(--bg-hover)' }}}
                    onMouseLeave={e => { if (!a) { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.background = 'var(--bg-input)' }}}>
                    {s}×
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 10px',
          border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
          background: 'rgba(255,255,255,0.02)',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
            {xport.format === 'svg' ? `${expDims.w} × ${expDims.h} (vector)` : `${expDims.w} × ${expDims.h}`}
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', opacity: 0.7 }}>
            {estimateSize(xport.format, xport.scale, advanced)}
          </span>
        </div>

        <button onClick={handleExport} disabled={isExporting} style={{
          width: '100%', height: 40,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          borderRadius: 'var(--radius-sm)',
          background: exportDone ? 'rgba(42,122,74,0.85)' : isExporting ? 'rgba(226,217,194,0.55)' : 'var(--export-bg)',
          color: exportDone ? '#d4f0e0' : 'var(--export-text)',
          fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase',
          transition: 'background 220ms cubic-bezier(0.25,0,0,1), color 220ms cubic-bezier(0.25,0,0,1), transform 80ms cubic-bezier(0.25,0,0,1), opacity 140ms cubic-bezier(0.25,0,0,1)',
          opacity: isExporting ? 0.65 : 1, cursor: isExporting ? 'default' : 'pointer',
        }}
          onMouseEnter={e => { if (!isExporting && !exportDone) e.currentTarget.style.opacity = '0.84' }}
          onMouseLeave={e => { if (!isExporting && !exportDone) e.currentTarget.style.opacity = '1' }}
          onMouseDown={e => { if (!isExporting) e.currentTarget.style.transform = 'scale(0.978) translateY(1px)' }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(1) translateY(0)' }}>
          {exportDone ? '✓ Saved' : isExporting ? 'Exporting…' : <><span>Export</span><ArrowUpRight /></>}
        </button>

      </div>
    </div>
  )
}
