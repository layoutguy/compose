import { useRef, useEffect, useState, useCallback } from 'react'
import { renderArtboard } from '../canvas/artboard'
import { renderGrid, computeGridLayout } from '../canvas/grid'
import { renderLogo, applyLogoMask, computeLogoGeometry } from '../canvas/logo'
import { useViewport } from '../hooks/useViewport'
import { useComposition } from '../hooks/useComposition'
import { registerTransition } from '../hooks/useCanvasTransition'

// ─── Handle definitions ───────────────────────────────────────────────────────

const HANDLES = [
  { id: 'tl', cursor: 'nw-resize', fx: 0,   fy: 0,   dx: -1, dy: -1 },
  { id: 'tc', cursor: 'n-resize',  fx: 0.5, fy: 0,   dx:  0, dy: -1 },
  { id: 'tr', cursor: 'ne-resize', fx: 1,   fy: 0,   dx:  1, dy: -1 },
  { id: 'ml', cursor: 'w-resize',  fx: 0,   fy: 0.5, dx: -1, dy:  0 },
  { id: 'mr', cursor: 'e-resize',  fx: 1,   fy: 0.5, dx:  1, dy:  0 },
  { id: 'bl', cursor: 'sw-resize', fx: 0,   fy: 1,   dx: -1, dy:  1 },
  { id: 'bc', cursor: 's-resize',  fx: 0.5, fy: 1,   dx:  0, dy:  1 },
  { id: 'br', cursor: 'se-resize', fx: 1,   fy: 1,   dx:  1, dy:  1 },
]

// ─── Logo resize handles overlay ──────────────────────────────────────────────

function LogoHandles({ rect, visible, onHandleMouseDown, touch = false }) {
  if (!visible || !rect) return null
  // On touch devices, use larger visible handles (12px) with a bigger invisible hit area
  const visSize   = touch ? 12 : 8
  const hitPad    = touch ? 14 : 0  // extra transparent padding around each handle
  return (
    <div style={{
      position: 'absolute',
      left: rect.x, top: rect.y,
      width: rect.w, height: rect.h,
      pointerEvents: 'none', zIndex: 20,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        outline: '1px dashed rgba(0,87,200,0.55)',
        pointerEvents: 'none',
      }} />
      {HANDLES.map(h => (
        <div
          key={h.id}
          onMouseDown={e => { e.stopPropagation(); e.preventDefault(); onHandleMouseDown(h, e) }}
          onTouchStart={e => { e.stopPropagation(); e.preventDefault(); onHandleMouseDown(h, { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY }) }}
          style={{
            position: 'absolute',
            left: `${h.fx * 100}%`, top: `${h.fy * 100}%`,
            transform: 'translate(-50%, -50%)',
            // Hit area includes invisible padding for touch
            width:  visSize + hitPad * 2,
            height: visSize + hitPad * 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: h.cursor,
            pointerEvents: 'all',
          }}
        >
          <div style={{
            width: visSize, height: visSize,
            border: '1.5px solid rgba(0,87,200,0.9)',
            background: 'var(--bg-handle)',
            borderRadius: 2,
            boxShadow: '0 1px 4px rgba(0,0,0,0.6)',
            flexShrink: 0,
          }} />
        </div>
      ))}
    </div>
  )
}

// ─── Overlays ─────────────────────────────────────────────────────────────────

const UndoIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M2 5H8.5C10.433 5 12 6.567 12 8.5S10.433 12 8.5 12H5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    <path d="M4.5 2.5L2 5l2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const RedoIcon = () => (
  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
    <path d="M12 5H5.5C3.567 5 2 6.567 2 8.5S3.567 12 5.5 12H9" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    <path d="M9.5 2.5L12 5l-2.5 2.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

function UndoRedoControls({ onUndo, onRedo, canUndo, canRedo }) {
  const btnStyle = (enabled) => ({
    width: 30, height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: enabled ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.2)',
    background: 'transparent',
    transition: 'color 120ms, background 120ms',
    cursor: enabled ? 'pointer' : 'default',
  })
  return (
    <div style={{
      position: 'absolute', top: 14, right: 14,
      display: 'flex', alignItems: 'center',
      height: 30,
      background: 'var(--bg-overlay)',
      backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.10)',
      borderRadius: 'var(--radius-md)',
      boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      <button onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)" style={btnStyle(canUndo)}
        onMouseEnter={e => { if (canUndo) { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}}
        onMouseLeave={e => { e.currentTarget.style.color = canUndo ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.2)'; e.currentTarget.style.background = 'transparent' }}>
        <UndoIcon />
      </button>
      <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />
      <button onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)" style={btnStyle(canRedo)}
        onMouseEnter={e => { if (canRedo) { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}}
        onMouseLeave={e => { e.currentTarget.style.color = canRedo ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.2)'; e.currentTarget.style.background = 'transparent' }}>
        <RedoIcon />
      </button>
    </div>
  )
}

const pillStyle = {
  display: 'flex', alignItems: 'center',
  height: 30,
  background: 'var(--bg-overlay)',
  backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
  overflow: 'hidden',
  userSelect: 'none',
}

const zoomBtnStyle = {
  width: 28, height: '100%',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: 'rgba(255,255,255,0.6)',
  background: 'transparent',
  fontSize: 15, lineHeight: 1, fontWeight: 300,
  transition: 'color 120ms, background 120ms',
}

function ZoomControls({ percent, onZoomIn, onZoomOut, onFit, isMobile }) {
  const hover = {
    onMouseEnter: e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)' },
    onMouseLeave: e => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.background = 'transparent' },
  }

  return (
    <div style={{
      position: 'absolute',
      bottom: isMobile ? 'max(24px, calc(env(safe-area-inset-bottom, 0px) + 12px))' : 14,
      ...(isMobile ? { left: 14 } : { right: 14 }),
      display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {/* Fit pill — standalone */}
      <div style={pillStyle}>
        <button onClick={onFit} title="Fit to screen" style={{ ...zoomBtnStyle }} {...hover}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 5V1.5A.5.5 0 0 1 1.5 1H5"/>
            <path d="M8 1h3.5a.5.5 0 0 1 .5.5V5"/>
            <path d="M12 8v3.5a.5.5 0 0 1-.5.5H8"/>
            <path d="M5 12H1.5a.5.5 0 0 1-.5-.5V8"/>
          </svg>
        </button>
      </div>

      {/* Zoom − pct + pill */}
      <div style={pillStyle}>
        <button onClick={onZoomOut} title="Zoom out" style={{ ...zoomBtnStyle, borderRight: '1px solid rgba(255,255,255,0.08)' }} {...hover}>−</button>

        <div style={{
          padding: '0 9px', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 500, letterSpacing: '0.04em',
          fontVariantNumeric: 'tabular-nums',
          color: 'rgba(255,255,255,0.7)',
          borderRight: '1px solid rgba(255,255,255,0.08)',
          minWidth: 44,
        }}>{percent}%</div>

        <button onClick={onZoomIn} title="Zoom in" style={zoomBtnStyle} {...hover}>+</button>
      </div>
    </div>
  )
}

function DimensionLabel({ w, h }) {
  function gcd(a, b) { return b === 0 ? a : gcd(b, a % b) }
  const d   = gcd(w, h)
  const arW = w / d
  const arH = h / d
  const arLabel = (arW <= 64 && arH <= 64) ? ` — ${arW}:${arH}` : ''
  return (
    <div style={{
      position: 'absolute', top: -24, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 10, color: 'var(--text-tertiary)',
      letterSpacing: '0.06em', whiteSpace: 'nowrap',
      pointerEvents: 'none', userSelect: 'none',
    }}>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{w} × {h}</span>
      {arLabel && <span style={{ opacity: 0.5 }}>{arLabel}</span>}
    </div>
  )
}

function DropOverlay() {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 40,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-overlay-dim)',
      backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
      pointerEvents: 'none',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        padding: '36px 56px',
        border: '1.5px dashed rgba(0,87,200,0.55)',
        borderRadius: 'var(--radius-xl)',
      }}>
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <path d="M14 20V8M14 8L9 13M14 8L19 13"
            stroke="rgba(0,87,200,0.9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M4 22v1.5h20V22" stroke="rgba(0,87,200,0.9)" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span style={{ fontSize: 12, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(0,87,200,0.9)' }}>
          Drop logo here
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em' }}>SVG or PNG</span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

const ACCEPTED_TYPES = new Set(['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'])

// Detect touch capability once (not reactive — device capability doesn't change)
const isTouchDevice = typeof window !== 'undefined' &&
  ('ontouchstart' in window || navigator.maxTouchPoints > 0)

export default function CanvasArea() {
  const containerRef  = useRef(null)
  const canvasRef     = useRef(null)
  const rafRef        = useRef(null)
  const wrapperRef    = useRef(null)

  const { computeLayout, zoom, zoomBy, zoomIn, zoomOut, resetView }  = useViewport()
  const { grid, display, dot, logo, advanced, setLogoFile, setLogoParam, clearLogo, undo, redo, canUndo, canRedo } = useComposition()

  // ─── Canvas frame dimensions — React-controlled so layout changes immediately ──
  // These drive the canvas element's CSS width/height via JSX (not imperative DOM).
  // When outputW/H changes, React re-renders and the frame reshapes before any drawing.
  const [frameW,   setFrameW]   = useState(0)
  const [frameH,   setFrameH]   = useState(0)
  const [percent,  setPercent]  = useState(100)

  const [isDragOver,    setIsDragOver]    = useState(false)
  const [logoSelected,  setLogoSelected]  = useState(false)
  const [logoRect,      setLogoRect]      = useState(null)

  // ── Stable refs for drawing ──────────────────────────────────────────────────
  const gridRef     = useRef(grid)
  const displayRef  = useRef(display)
  const dotRef      = useRef(dot)
  const logoRef     = useRef(logo)
  const advancedRef = useRef(advanced)
  useEffect(() => { gridRef.current     = grid    }, [grid])
  useEffect(() => { displayRef.current  = display }, [display])
  useEffect(() => { dotRef.current      = dot     }, [dot])
  useEffect(() => { logoRef.current     = logo    }, [logo])
  useEffect(() => { advancedRef.current = advanced }, [advanced])

  // Layout ref — drawing function reads current frame size without stale closures
  const layoutRef = useRef({ displayW: 0, displayH: 0, fitScale: 1, finalScale: 1 })

  // ── Loaded image elements ────────────────────────────────────────────────────
  const logoImgRef = useRef(null)
  const bgImgRef   = useRef(null)

  // ── Offscreen canvas ─────────────────────────────────────────────────────────
  const offscreenRef = useRef(null)

  // ── Resize drag state ────────────────────────────────────────────────────────
  const resizeDragRef = useRef(null)

  // ── Logo body drag state ─────────────────────────────────────────────────────
  // { startX, startY, startOffsetX, startOffsetY, fitScale, moved }
  const logoDragRef      = useRef(null)
  const logoDragMovedRef = useRef(false) // survives mouseup so click handler can check

  // ─────────────────────────────────────────────────────────────────────────────
  // LAYOUT COMPUTATION — completely separate from drawing.
  //
  // This is called any time the container size OR the artboard dimensions change.
  // It updates React state (frameW/H), which causes React to set canvas CSS
  // width/height via JSX props — guaranteeing the frame physically reshapes.
  // ─────────────────────────────────────────────────────────────────────────────

  const computeCanvasLayout = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const { width, height } = container.getBoundingClientRect()
    if (!width || !height) return
    const adv = advancedRef.current
    const result = computeLayout(width, height, adv.outputW, adv.outputH)
    layoutRef.current = result
    setFrameW(result.displayW)
    setFrameH(result.displayH)
    setPercent(Math.round(result.finalScale * 100))
  }, [computeLayout])

  // Recompute layout whenever outputW, outputH, or zoom changes
  // (zoom is captured inside computeLayout's closure)
  useEffect(() => {
    computeCanvasLayout()
  }, [advanced.outputW, advanced.outputH, zoom, computeCanvasLayout])

  // ResizeObserver for container size changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    computeCanvasLayout() // initial
    const ro = new ResizeObserver(computeCanvasLayout)
    ro.observe(container)
    return () => { ro.disconnect(); if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [computeCanvasLayout])

  // ─────────────────────────────────────────────────────────────────────────────
  // DRAWING — reads layout from layoutRef, never sets canvas CSS dimensions.
  // ─────────────────────────────────────────────────────────────────────────────

  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { displayW, displayH, finalScale: fitScale } = layoutRef.current
    if (!displayW || !displayH) return

    const adv = advancedRef.current
    const dpr = adv.retinaPreview ? (window.devicePixelRatio || 1) : 1

    const physW = Math.round(displayW * dpr)
    const physH = Math.round(displayH * dpr)
    if (canvas.width !== physW || canvas.height !== physH) {
      canvas.width  = physW
      canvas.height = physH
    }
    // CSS dimensions are owned by React (frameW/H state → JSX props).
    // Do NOT set canvas.style.width/height here.

    const bgOpts = {
      bgType:          adv.bgType,
      bgColor:         adv.bgColor,
      bgGradientFrom:  adv.bgGradientFrom,
      bgGradientTo:    adv.bgGradientTo,
      bgGradientAngle: adv.bgGradientAngle,
      bgImageEl:       bgImgRef.current,
    }

    renderArtboard(canvas, displayW, displayH, dpr, fitScale, false, bgOpts)

    const ctx    = canvas.getContext('2d')
    const offCtx = offscreenRef.current?.getContext('2d')
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const hasLogo   = !!logoImgRef.current
    const dims      = { outputW: adv.outputW, outputH: adv.outputH }
    const layout    = computeGridLayout(gridRef.current, dims)
    const blendMode = adv.blendMode ?? 'normal'

    const gridOpts = {
      showGuides: false,
      showDots:   displayRef.current.showDots,
      dot:        dotRef.current,
      jitter:     adv.jitter,
      seed:       adv.seed,
      outputW:    adv.outputW,
      outputH:    adv.outputH,
    }

    if (hasLogo && offCtx) {
      const off = offscreenRef.current
      if (off.width !== physW || off.height !== physH) {
        off.width  = physW
        off.height = physH
      }
      offCtx.clearRect(0, 0, physW, physH)
      offCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
      renderGrid(offCtx, dpr, fitScale, gridRef.current, gridOpts)
      applyLogoMask(offCtx, fitScale, gridRef.current, layout, logoImgRef.current, logoRef.current, dotRef.current.size)

      ctx.save()
      if (blendMode !== 'normal') ctx.globalCompositeOperation = blendMode
      ctx.drawImage(off, 0, 0, displayW, displayH)
      ctx.restore()

      renderLogo(ctx, dpr, fitScale, gridRef.current, layout, logoImgRef.current, logoRef.current)

      const geom = computeLogoGeometry(gridRef.current, layout, logoImgRef.current, logoRef.current)
      setLogoRect({
        x:        geom.logoX    * fitScale,
        y:        geom.logoY    * fitScale,
        w:        geom.logoWOut * fitScale,
        h:        geom.logoHOut * fitScale,
        spacingX: layout.spacingX,
        fitScale,
        aspect:   geom.logoHOut / geom.logoWOut,
      })
    } else {
      ctx.save()
      if (blendMode !== 'normal') ctx.globalCompositeOperation = blendMode
      renderGrid(ctx, dpr, fitScale, gridRef.current, gridOpts)
      ctx.restore()
      setLogoRect(null)
    }
  }, []) // stable — all state read from refs

  const scheduleRender = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(render)
  }, [render])

  // Re-draw when frame dimensions update (layout changed) or content changes
  useEffect(() => { scheduleRender() }, [frameW, frameH,   scheduleRender])
  useEffect(() => { scheduleRender() }, [grid,              scheduleRender])
  useEffect(() => { scheduleRender() }, [display,           scheduleRender])
  useEffect(() => { scheduleRender() }, [dot,               scheduleRender])
  useEffect(() => { scheduleRender() }, [logo,              scheduleRender])
  useEffect(() => { scheduleRender() }, [advanced,          scheduleRender])

  // ── Load logo image ───────────────────────────────────────────────────────────
  useEffect(() => {
    // Clear immediately so the old image never renders during the loading gap
    logoImgRef.current = null
    setLogoRect(null)
    setLogoSelected(false)
    scheduleRender()   // redraw now (without any logo) to remove trail

    if (!logo.url) return

    const img = new Image()
    img.onload  = () => {
      logoImgRef.current = img
      if (!offscreenRef.current) offscreenRef.current = document.createElement('canvas')
      setLogoSelected(true)
      scheduleRender()
    }
    img.onerror = () => { logoImgRef.current = null; scheduleRender() }
    img.src = logo.url
  }, [logo.url, scheduleRender])

  // ── Canvas blur transition (used by suggestion Apply) ────────────────────────
  useEffect(() => {
    registerTransition((callback) => {
      const el = wrapperRef.current
      if (!el) { callback(); return }

      // Blur out
      el.style.transition = 'filter 100ms ease, opacity 100ms ease'
      el.style.filter     = 'blur(5px)'
      el.style.opacity    = '0.55'

      setTimeout(() => {
        callback() // apply new grid values

        // Tiny delay so React flushes the new state before unblurring
        requestAnimationFrame(() => {
          el.style.filter  = 'blur(0px)'
          el.style.opacity = '1'

          // Clean up inline styles after transition ends
          setTimeout(() => {
            el.style.transition = ''
            el.style.filter     = ''
            el.style.opacity    = ''
          }, 180)
        })
      }, 120)
    })
  }, [])

  // ── Scroll-to-zoom ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      // Normalise delta across trackpads and mouse wheels
      const raw    = e.deltaY ?? e.detail ?? 0
      const factor = raw < 0 ? 1.08 : 1 / 1.08
      zoomBy(factor)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomBy])

  // ── Delete logo with keyboard ─────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e) => {
      if (!logoSelected) return
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      // Don't intercept when user is typing in an input / textarea
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      e.preventDefault()
      clearLogo()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [logoSelected, clearLogo])

  // ── Load background image ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!advanced.bgImageUrl) { bgImgRef.current = null; scheduleRender(); return }
    const img = new Image()
    img.onload  = () => { bgImgRef.current = img; scheduleRender() }
    img.onerror = () => { bgImgRef.current = null }
    img.src = advanced.bgImageUrl
  }, [advanced.bgImageUrl, scheduleRender])

  // ── Snap helper — find nearest grid dot and return snapped offsetX/Y ───────────
  // Snaps the logo's handle point (defined by position/alignX/Y) to the nearest dot.
  // offsetX/Y are relative to grid center, so the handle = gridCenter + offset.
  const snapToNearestDot = useCallback((freeOffX, freeOffY) => {
    const grid = gridRef.current
    const adv  = advancedRef.current
    if (!grid) return { offsetX: freeOffX, offsetY: freeOffY }

    const layout = computeGridLayout(grid, { outputW: adv.outputW, outputH: adv.outputH })
    const { originX, originY, spacingX, spacingY } = layout
    const { cols, rows } = grid

    // Grid center (handle base)
    const gridCX = originX + (cols - 1) / 2 * spacingX
    const gridCY = originY + (rows - 1) / 2 * spacingY

    // Handle position in output space
    const handleX = gridCX + freeOffX
    const handleY = gridCY + freeOffY

    // Nearest dot (clamped to grid)
    const col  = Math.max(0, Math.min(cols - 1, Math.round((handleX - originX) / spacingX)))
    const row  = Math.max(0, Math.min(rows - 1, Math.round((handleY - originY) / spacingY)))
    const dotX = originX + col * spacingX
    const dotY = originY + row * spacingY

    // Offset = dot position relative to grid center
    return {
      offsetX: Math.round(dotX - gridCX),
      offsetY: Math.round(dotY - gridCY),
    }
  }, []) // reads only from stable refs

  // ── Re-snap when Snap is toggled ON or logo position changes ─────────────────
  useEffect(() => {
    if (!display.showGuides) return
    if (!logoImgRef.current || !logoRef.current?.url) return
    const lo = logoRef.current
    const snapped = snapToNearestDot(lo.offsetX, lo.offsetY)
    setLogoParam('offsetX', snapped.offsetX)
    setLogoParam('offsetY', snapped.offsetY)
  }, [display.showGuides, logo.position]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Global mouse + touch listeners for logo resize drag + logo body drag ───────
  useEffect(() => {
    const handleMove = (clientX, clientY) => {
      // ── Resize handle drag ──────────────────────────────────────────────────
      const drag = resizeDragRef.current
      if (drag) {
        const deltaX = clientX - drag.startX
        const deltaY = clientY - drag.startY
        let rawDelta = 0
        if (drag.dx !== 0 && drag.dy !== 0) {
          rawDelta = (deltaX * drag.dx + deltaY * drag.dy) / 2
        } else if (drag.dx !== 0) {
          rawDelta = deltaX * drag.dx
        } else {
          const deltaHDisplay = deltaY * drag.dy
          const deltaHOut     = deltaHDisplay / drag.fitScale
          const newLogoHOut   = drag.startLogoHOut + deltaHOut
          const newLogoWOut   = Math.max(1, newLogoHOut / drag.aspect)
          const newSizeDots   = Math.max(0.25, newLogoWOut / drag.spacingX)
          setLogoParam('sizeDots', Math.round(newSizeDots * 10) / 10)
          return
        }
        const deltaWOut   = rawDelta / drag.fitScale
        const newLogoWOut = Math.max(1, drag.startLogoWOut + deltaWOut)
        const newSizeDots = Math.max(0.25, newLogoWOut / drag.spacingX)
        setLogoParam('sizeDots', Math.round(newSizeDots * 10) / 10)
        return
      }

      // ── Logo body drag ──────────────────────────────────────────────────────
      const ld = logoDragRef.current
      if (!ld) return
      const dx = clientX - ld.startX
      const dy = clientY - ld.startY
      if (!ld.moved && Math.abs(dx) + Math.abs(dy) > 3) {
        ld.moved = true
        logoDragMovedRef.current = true
      }
      if (ld.moved) {
        const freeOffX = Math.round(ld.startOffsetX + dx / ld.fitScale)
        const freeOffY = Math.round(ld.startOffsetY + dy / ld.fitScale)
        if (displayRef.current.showGuides) {
          const snapped = snapToNearestDot(freeOffX, freeOffY)
          setLogoParam('offsetX', snapped.offsetX)
          setLogoParam('offsetY', snapped.offsetY)
        } else {
          setLogoParam('offsetX', freeOffX)
          setLogoParam('offsetY', freeOffY)
        }
      }
    }

    const onMouseMove = (e) => handleMove(e.clientX, e.clientY)

    const onTouchMove = (e) => {
      if (e.touches.length !== 1) return
      // Prevent page scroll while dragging logo
      if (resizeDragRef.current || logoDragRef.current) e.preventDefault()
      const t = e.touches[0]
      handleMove(t.clientX, t.clientY)
    }

    const onUp = () => {
      resizeDragRef.current = null
      logoDragRef.current   = null
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup',   onUp)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend',  onUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup',   onUp)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend',  onUp)
    }
  }, [setLogoParam, snapToNearestDot])

  const handleHandleMouseDown = useCallback((handle, e) => {
    if (!logoRect) return
    resizeDragRef.current = {
      dx:           handle.dx,
      dy:           handle.dy,
      startX:       e.clientX,
      startY:       e.clientY,
      startLogoWOut: logo.sizeDots * logoRect.spacingX,
      startLogoHOut: logo.sizeDots * logoRect.spacingX * logoRect.aspect,
      spacingX:     logoRect.spacingX,
      fitScale:     logoRect.fitScale,
      aspect:       logoRect.aspect,
    }
  }, [logoRect, logo.sizeDots])

  // ── Shared drag start — used by both mouse and touch ─────────────────────────
  const startLogoDrag = useCallback((clientX, clientY) => {
    logoDragMovedRef.current = false
    logoDragRef.current = {
      startX:       clientX,
      startY:       clientY,
      startOffsetX: logoRef.current.offsetX,
      startOffsetY: logoRef.current.offsetY,
      fitScale:     logoRect.fitScale,
      moved:        false,
    }
  }, [logoRect])

  // ── Canvas mousedown — start logo body drag ──────────────────────────────────
  const handleCanvasMouseDown = useCallback((e) => {
    if (!logoRect || !logoSelected) return
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const rect  = canvasEl.getBoundingClientRect()
    const cssX  = e.clientX - rect.left
    const cssY  = e.clientY - rect.top
    const inside = cssX >= logoRect.x && cssX <= logoRect.x + logoRect.w &&
                   cssY >= logoRect.y && cssY <= logoRect.y + logoRect.h
    if (!inside) return
    e.preventDefault()
    startLogoDrag(e.clientX, e.clientY)
  }, [logoRect, logoSelected, startLogoDrag])

  // ── Canvas touchstart — tap to select logo, drag to move ─────────────────────
  const handleCanvasTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return
    const touch   = e.touches[0]
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const rect  = canvasEl.getBoundingClientRect()
    const cssX  = touch.clientX - rect.left
    const cssY  = touch.clientY - rect.top

    if (!logoRect) { setLogoSelected(false); return }

    const inside = cssX >= logoRect.x && cssX <= logoRect.x + logoRect.w &&
                   cssY >= logoRect.y && cssY <= logoRect.y + logoRect.h

    if (!inside) { setLogoSelected(false); return }

    // Tap/drag on logo — select it and start drag
    e.preventDefault()
    setLogoSelected(true)
    startLogoDrag(touch.clientX, touch.clientY)
  }, [logoRect, startLogoDrag])

  // ── Canvas mousemove — update cursor when hovering logo body ─────────────────
  const handleCanvasMouseMove = useCallback((e) => {
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    // While dragging (body or handle), cursor is handled globally
    if (logoDragRef.current || resizeDragRef.current) return
    if (!logoRect || !logoSelected) { canvasEl.style.cursor = 'default'; return }
    const rect   = canvasEl.getBoundingClientRect()
    const cssX   = e.clientX - rect.left
    const cssY   = e.clientY - rect.top
    const inside = cssX >= logoRect.x && cssX <= logoRect.x + logoRect.w &&
                   cssY >= logoRect.y && cssY <= logoRect.y + logoRect.h
    canvasEl.style.cursor = inside ? 'move' : 'default'
  }, [logoRect, logoSelected])

  // ── Canvas click — select / deselect logo ─────────────────────────────────────
  const handleCanvasClick = useCallback((e) => {
    // If the mousedown turned into a drag, ignore the synthetic click
    if (logoDragMovedRef.current) { logoDragMovedRef.current = false; return }
    if (!logoRect) { setLogoSelected(false); return }
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const rect   = canvasEl.getBoundingClientRect()
    const cssX   = e.clientX - rect.left
    const cssY   = e.clientY - rect.top
    const inside = cssX >= logoRect.x && cssX <= logoRect.x + logoRect.w &&
                   cssY >= logoRect.y && cssY <= logoRect.y + logoRect.h
    setLogoSelected(inside)
  }, [logoRect])

  // ── Drag / drop ───────────────────────────────────────────────────────────────
  const handleDragOver = useCallback(e => {
    e.preventDefault(); e.stopPropagation()
    if ([...(e.dataTransfer?.types ?? [])].includes('Files')) setIsDragOver(true)
  }, [])
  const handleDragLeave = useCallback(e => {
    e.preventDefault(); e.stopPropagation()
    if (!e.currentTarget.contains(e.relatedTarget)) setIsDragOver(false)
  }, [])
  const handleDrop = useCallback(e => {
    e.preventDefault(); e.stopPropagation()
    setIsDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (!file || !ACCEPTED_TYPES.has(file.type)) return
    setLogoFile(file)
  }, [setLogoFile])

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse 80% 70% at 50% 50%, hsl(var(--hue),13%,9%) 0%, hsl(var(--hue),9%,4%) 100%)',
        overflow: 'hidden',
        minHeight: 0,
        position: 'relative',
      }}
    >
      {/* Canvas wrapper — sized by React to match the artboard frame exactly */}
      <div ref={wrapperRef} style={{ position: 'relative', flexShrink: 0 }}>

        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onTouchStart={handleCanvasTouchStart}
          style={{
            display: 'block',
            touchAction: 'none',   // prevent browser scroll/zoom while interacting with canvas
            // React owns these — they are the artboard frame dimensions.
            // Changed whenever outputW/H or zoom changes, BEFORE drawing.
            width:  frameW > 0 ? frameW  : undefined,
            height: frameH > 0 ? frameH : undefined,
            cursor: 'default',
            willChange: 'transform',          // GPU raster layer — avoids composite on resize
            imageRendering: 'crisp-edges',
            transition: 'width 180ms cubic-bezier(0.25,0,0,1), height 180ms cubic-bezier(0.25,0,0,1)',
            boxShadow: [
              '0 0 0 1px rgba(255,255,255,0.05)',
              '0 4px 16px rgba(0,0,0,0.45)',
              '0 24px 80px rgba(0,0,0,0.65)',
            ].join(', '),
          }}
        />

        <LogoHandles
          rect={logoRect}
          visible={logoSelected && !!logoRect}
          onHandleMouseDown={handleHandleMouseDown}
          touch={isTouchDevice}
        />


      </div>

      <UndoRedoControls onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo} />
      <ZoomControls percent={percent} onZoomIn={zoomIn} onZoomOut={zoomOut} onFit={resetView} isMobile={isTouchDevice} />
      {isDragOver && <DropOverlay />}
    </div>
  )
}
