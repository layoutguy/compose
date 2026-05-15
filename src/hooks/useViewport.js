import { useState, useCallback, useRef } from 'react'
import { OUTPUT_W, OUTPUT_H } from '../canvas/artboard'

const PAD = 52 // workspace breathing room in px

export function useViewport() {
  const [zoom, setZoom] = useState(1.0)
  const [pan,  setPan]  = useState({ x: 0, y: 0 })

  // Last computed values — stable ref so render callbacks don't need to recreate
  const viewRef = useRef({ fitScale: 1, displayW: 0, displayH: 0 })

  /**
   * Compute display canvas dimensions for the given container size.
   *
   * @param {number} containerW
   * @param {number} containerH
   * @param {number} [outputW]  – artboard width in output-space px (default OUTPUT_W)
   * @param {number} [outputH]  – artboard height in output-space px (default OUTPUT_H)
   */
  const computeLayout = useCallback((containerW, containerH, outputW = OUTPUT_W, outputH = OUTPUT_H) => {
    const availW = containerW - PAD * 2
    const availH = containerH - PAD * 2
    const fitScale   = Math.min(availW / outputW, availH / outputH)
    const finalScale = fitScale * zoom

    const displayW = Math.round(outputW * finalScale)
    const displayH = Math.round(outputH * finalScale)

    viewRef.current = { fitScale, finalScale, displayW, displayH }
    return viewRef.current
  }, [zoom])

  const zoomIn   = useCallback(() => setZoom(z => Math.min(z * 1.25, 8)),   [])
  const zoomOut  = useCallback(() => setZoom(z => Math.max(z / 1.25, 0.1)), [])
  const resetView = useCallback(() => { setZoom(1.0); setPan({ x: 0, y: 0 }) }, [])

  return { zoom, pan, viewRef, computeLayout, zoomIn, zoomOut, resetView }
}
