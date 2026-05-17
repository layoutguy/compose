import { useState, useRef, useCallback } from 'react'
import { CompositionProvider } from './context/CompositionContext'
import TopBar from './components/TopBar'
import CanvasArea from './components/CanvasArea'
import BottomToolbar from './components/BottomToolbar'
import RightPanel from './components/RightPanel'
import { useIsMobile } from './hooks/useIsMobile'
import './index.css'

export default function App() {
  const isMobile  = useIsMobile()
  const [panelOpen, setPanelOpen] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const sheetRef  = useRef(null)

  const closeSheet = useCallback(() => {
    if (!sheetRef.current || isClosing) return
    setIsClosing(true)
    const el = sheetRef.current
    el.style.transition = 'transform 360ms cubic-bezier(0.16,1,0.3,1)'
    el.style.transform  = `translate3d(0,${window.innerHeight}px,0)`
    setTimeout(() => {
      setPanelOpen(false)
      setIsClosing(false)
    }, 360)
  }, [isClosing])

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
          <div style={{
            flex: 1,
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minWidth: 0,
          }}>
            <CanvasArea />
            <BottomToolbar />
          </div>

          {/* Desktop: side panel */}
          {!isMobile && <RightPanel />}
        </div>

        {/* Mobile: bottom sheet panel */}
        {isMobile && (panelOpen || isClosing) && (
          <>
            {/* Backdrop */}
            <div
              onClick={closeSheet}
              style={{
                position: 'fixed', inset: 0, zIndex: 90,
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(6px)',
                WebkitBackdropFilter: 'blur(6px)',
                animation: isClosing
                  ? 'backdropOut 360ms cubic-bezier(0.25,0,0,1) both'
                  : 'backdropIn 240ms cubic-bezier(0.25,0,0,1) both',
              }}
            />

            {/* Sheet */}
            <div ref={sheetRef} style={{
              position: 'fixed', bottom: 0, left: 0, right: 0,
              zIndex: 100,
              height: '82dvh',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
              overflow: 'hidden',
              boxShadow: '0 -8px 48px rgba(0,0,0,0.7)',
              animation: 'sheetSlideUp 320ms cubic-bezier(0.16,1,0.3,1) both',
              willChange: 'transform',
            }}>
              {/* Handle bar */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                height: 44, flexShrink: 0,
                background: 'var(--bg-panel)',
                borderBottom: '1px solid var(--border)',
                position: 'relative',
              }}>
                <div style={{
                  width: 32, height: 4,
                  borderRadius: 2,
                  background: 'rgba(255,255,255,0.15)',
                }} />
                <button
                  onClick={closeSheet}
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
