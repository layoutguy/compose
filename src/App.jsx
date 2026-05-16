import { useState, useRef, useCallback } from 'react'
import { CompositionProvider } from './context/CompositionContext'
import TopBar from './components/TopBar'
import CanvasArea from './components/CanvasArea'
import BottomToolbar from './components/BottomToolbar'
import RightPanel from './components/RightPanel'
import { useIsMobile } from './hooks/useIsMobile'
import './index.css'

export default function App() {
  const isMobile   = useIsMobile()
  const [panelOpen, setPanelOpen] = useState(false)
  const [sheetFull, setSheetFull] = useState(false)
  const sheetRef   = useRef(null)
  const dragRef    = useRef(null) // { startY, startFull }

  // Swipe-up on canvas to open panel
  const swipeStartY = useRef(null)
  const onTouchStart = useCallback((e) => {
    swipeStartY.current = e.touches[0].clientY
  }, [])
  const onTouchEnd = useCallback((e) => {
    if (swipeStartY.current === null) return
    const dy = swipeStartY.current - e.changedTouches[0].clientY
    if (dy > 60) setPanelOpen(true)
    swipeStartY.current = null
  }, [])

  // Sheet handle drag — uses RAF + translate3d for GPU-composited smoothness
  const rafRef = useRef(null)

  const setTranslate = useCallback((el, y, animated) => {
    el.style.transition = animated ? 'transform 380ms cubic-bezier(0.16,1,0.3,1)' : 'none'
    el.style.transform  = `translate3d(0,${y}px,0)`
  }, [])

  const onHandleTouchStart = useCallback((e) => {
    const el = sheetRef.current
    if (!el) return
    dragRef.current = { startY: e.touches[0].clientY, lastY: e.touches[0].clientY, vel: 0 }
    setTranslate(el, 0, false)
  }, [setTranslate])

  const onHandleTouchMove = useCallback((e) => {
    if (!dragRef.current) return
    const y = e.touches[0].clientY
    dragRef.current.vel  = y - dragRef.current.lastY
    dragRef.current.lastY = y
    const dy      = y - dragRef.current.startY
    const clamped = Math.max(-window.innerHeight * 0.18, dy)
    const el = sheetRef.current
    if (!el) return
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => setTranslate(el, clamped, false))
  }, [setTranslate])

  const onHandleTouchEnd = useCallback((e) => {
    if (!dragRef.current) return
    const el  = sheetRef.current
    const dy  = e.changedTouches[0].clientY - dragRef.current.startY
    const vel = dragRef.current.vel
    dragRef.current = null
    if (!el) return

    if (dy < -40 || vel < -6) {
      // Swiped up fast → full screen
      setTranslate(el, 0, true)
      setSheetFull(true)
    } else if (dy > 60 || vel > 8) {
      // Swiped down fast → dismiss
      setTranslate(el, window.innerHeight, true)
      setTimeout(() => { setPanelOpen(false); setSheetFull(false); setTranslate(el, 0, false) }, 360)
    } else {
      // Not enough → snap back
      setTranslate(el, 0, true)
    }
  }, [setTranslate])

  return (
    <CompositionProvider>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        background: 'var(--bg-base)',
      }}>
        <TopBar
          isMobile={isMobile}
          panelOpen={panelOpen}
          onTogglePanel={() => setPanelOpen(o => !o)}
        />

        <div style={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
        }}>
          <div
            style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minWidth: 0,
            }}
            onTouchStart={isMobile ? onTouchStart : undefined}
            onTouchEnd={isMobile ? onTouchEnd : undefined}
          >
            <CanvasArea />
            <BottomToolbar />
          </div>

          {/* Desktop: side panel */}
          {!isMobile && <RightPanel />}
        </div>

        {/* Mobile: bottom sheet panel */}
        {isMobile && panelOpen && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => { setPanelOpen(false); setSheetFull(false) }}
              style={{
                position: 'fixed', inset: 0, zIndex: 90,
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                animation: 'backdropIn 240ms cubic-bezier(0.25,0,0,1) both',
              }}
            />

            {/* Sheet */}
            <div ref={sheetRef} style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              zIndex: 100,
              height: sheetFull ? '100dvh' : '82dvh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: sheetFull ? 0 : 'var(--radius-xl) var(--radius-xl) 0 0',
              overflow: 'hidden',
              boxShadow: '0 -8px 48px rgba(0,0,0,0.7)',
              animation: 'sheetSlideUp 320ms cubic-bezier(0.16,1,0.3,1) both',
              transition: 'height 380ms cubic-bezier(0.16,1,0.3,1), border-radius 380ms cubic-bezier(0.16,1,0.3,1)',
              willChange: 'transform',
            }}>
              {/* Drag handle bar */}
              <div
                onTouchStart={onHandleTouchStart}
                onTouchMove={onHandleTouchMove}
                onTouchEnd={onHandleTouchEnd}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  height: 44, flexShrink: 0,
                  background: 'var(--bg-panel)',
                  borderBottom: '1px solid var(--border)',
                  position: 'relative',
                  cursor: 'grab',
                  touchAction: 'none',
                }}>
                <div style={{
                  width: 32, height: 4,
                  borderRadius: 2,
                  background: 'rgba(255,255,255,0.15)',
                }} />
                <button
                  onClick={() => { setPanelOpen(false); setSheetFull(false) }}
                  style={{
                    position: 'absolute', right: 14,
                    width: 30, height: 30,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    borderRadius: '50%',
                    background: 'rgba(255,255,255,0.06)',
                    color: 'var(--text-secondary)',
                    fontSize: 18, lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>

              <RightPanel sheetMode />
            </div>
          </>
        )}
      </div>
    </CompositionProvider>
  )
}
