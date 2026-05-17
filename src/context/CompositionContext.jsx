import { createContext, useState, useCallback, useRef, useEffect } from 'react'
import { GRID_DEFAULTS } from '../canvas/grid'

export const CompositionContext = createContext(null)

const DISPLAY_DEFAULTS = {
  showGuides: false,
  showDots:   true,
}

export const DOT_DEFAULTS = {
  shape:   'square',
  size:    5,
  opacity: 0.84,
  color:   '#FAEFE4',
}

export const XPORT_DEFAULTS = {
  format: 'png',
  scale:  1,
}

export const LOGO_DEFAULTS = {
  url:       null,
  name:      null,
  sizeDots:  2,
  position:  'bot-right',
  offsetX:   0,
  offsetY:   0,
  tintColor: null,   // null = original colors; hex string = tinted
}

export const ADVANCED_DEFAULTS = {
  outputW: 3840,
  outputH: 2160,
  bgType:          'solid',
  bgColor:         '#11100D',
  bgGradientFrom:  '#11100D',
  bgGradientTo:    '#1A1A2E',
  bgGradientAngle: 135,
  bgImageUrl:      null,
  bgImageName:     null,
  blendMode:       'normal',
  jitter:          0,
  seed:            42,
  exportPadding:   0,
  retinaPreview:   true,
}

// ─── History helpers ──────────────────────────────────────────────────────────

const MAX_HISTORY = 60

function makeSnap(grid, dot, logo, advanced) {
  return {
    grid:     { ...grid },
    dot:      { ...dot },
    logo:     { ...logo },
    advanced: { ...advanced },
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CompositionProvider({ children }) {
  const [grid,     setGrid]     = useState(GRID_DEFAULTS)
  const [display,  setDisplay]  = useState(DISPLAY_DEFAULTS)
  const [dot,      setDot]      = useState(DOT_DEFAULTS)
  const [logo,     setLogo]     = useState(LOGO_DEFAULTS)
  const [xport,    setXport]    = useState(XPORT_DEFAULTS)
  const [advanced, setAdvanced] = useState(ADVANCED_DEFAULTS)

  // Object URL refs for cleanup
  const logoUrlRef  = useRef(null)
  const bgImgUrlRef = useRef(null)

  // ── Undo / Redo ───────────────────────────────────────────────────────────
  const historyRef     = useRef([makeSnap(GRID_DEFAULTS, DOT_DEFAULTS, LOGO_DEFAULTS, ADVANCED_DEFAULTS)])
  const historyIdxRef  = useRef(0)
  const isRestoringRef = useRef(false)
  const debounceRef    = useRef(null)
  const [historyVersion, setHistoryVersion] = useState(0) // drives canUndo / canRedo

  // Auto-snapshot with 400 ms debounce after any state change
  useEffect(() => {
    if (isRestoringRef.current) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      const snap = makeSnap(grid, dot, logo, advanced)
      const h    = historyRef.current
      const i    = historyIdxRef.current

      // Skip if nothing changed
      if (JSON.stringify(snap) === JSON.stringify(h[i])) return

      // Trim redo stack and push
      h.splice(i + 1)
      h.push(snap)
      if (h.length > MAX_HISTORY) h.shift()
      else historyIdxRef.current++

      setHistoryVersion(v => v + 1)
    }, 400)
  }, [grid, dot, logo, advanced])

  const undo = useCallback(() => {
    const i = historyIdxRef.current
    if (i <= 0) return
    isRestoringRef.current = true
    historyIdxRef.current--
    const snap = historyRef.current[historyIdxRef.current]
    setGrid(snap.grid)
    setDot(snap.dot)
    setLogo(snap.logo)
    setAdvanced(snap.advanced)
    setHistoryVersion(v => v + 1)
    requestAnimationFrame(() => { isRestoringRef.current = false })
  }, [])

  const redo = useCallback(() => {
    const i = historyIdxRef.current
    const h = historyRef.current
    if (i >= h.length - 1) return
    isRestoringRef.current = true
    historyIdxRef.current++
    const snap = h[historyIdxRef.current]
    setGrid(snap.grid)
    setDot(snap.dot)
    setLogo(snap.logo)
    setAdvanced(snap.advanced)
    setHistoryVersion(v => v + 1)
    requestAnimationFrame(() => { isRestoringRef.current = false })
  }, [])

  // Computed from refs — historyVersion triggers re-evaluation
  const canUndo = historyIdxRef.current > 0
  const canRedo = historyIdxRef.current < historyRef.current.length - 1

  // ── Setters ───────────────────────────────────────────────────────────────
  const setGridParam     = useCallback((key, val) => setGrid(p => ({ ...p, [key]: val })), [])
  const toggleDisplay    = useCallback((key)       => setDisplay(p => ({ ...p, [key]: !p[key] })), [])
  const setDotParam      = useCallback((key, val)  => setDot(p => ({ ...p, [key]: val })), [])
  const setExportOption  = useCallback((key, val)  => setXport(p => ({ ...p, [key]: val })), [])
  const setAdvancedParam = useCallback((key, val)  => setAdvanced(p => ({ ...p, [key]: val })), [])

  const setLogoFile = useCallback((file) => {
    if (!file) return
    if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current)
    const url = URL.createObjectURL(file)
    logoUrlRef.current = url
    // Read natural dimensions so shuffle can constrain sizeDots
    const img = new Image()
    img.onload = () => {
      setLogo(p => ({ ...p, url, name: file.name, naturalW: img.naturalWidth, naturalH: img.naturalHeight }))
    }
    img.src = url
  }, [])

  const setLogoParam = useCallback((key, val) => setLogo(p => ({ ...p, [key]: val })), [])

  const clearLogo = useCallback(() => {
    if (logoUrlRef.current) URL.revokeObjectURL(logoUrlRef.current)
    logoUrlRef.current = null
    setLogo(LOGO_DEFAULTS)
  }, [])

  const setBgImageFile = useCallback((file) => {
    if (!file) return
    if (bgImgUrlRef.current) URL.revokeObjectURL(bgImgUrlRef.current)
    const url = URL.createObjectURL(file)
    bgImgUrlRef.current = url
    setAdvanced(p => ({ ...p, bgImageUrl: url, bgImageName: file.name, bgType: 'image' }))
  }, [])

  const clearBgImage = useCallback(() => {
    if (bgImgUrlRef.current) URL.revokeObjectURL(bgImgUrlRef.current)
    bgImgUrlRef.current = null
    setAdvanced(p => ({ ...p, bgImageUrl: null, bgImageName: null, bgType: 'solid' }))
  }, [])

  // suppress unused-warning — historyVersion drives canUndo/canRedo recomputation
  void historyVersion

  return (
    <CompositionContext.Provider value={{
      grid,     setGridParam,
      display,  toggleDisplay,
      dot,      setDotParam,
      logo,     setLogoFile, setLogoParam, clearLogo,
      xport,    setExportOption,
      advanced, setAdvancedParam, setBgImageFile, clearBgImage,
      undo, redo, canUndo, canRedo,
    }}>
      {children}
    </CompositionContext.Provider>
  )
}
