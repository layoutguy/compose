import { renderArtboard, OUTPUT_W, OUTPUT_H } from '../canvas/artboard'
import { renderGrid, computeGridLayout } from '../canvas/grid'
import { renderLogo, applyLogoMask } from '../canvas/logo'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = ()  => reject(new Error('Failed to load image: ' + url))
    img.src = url
  })
}

// ─── Main export renderer ─────────────────────────────────────────────────────

/**
 * Render the full composition to an offscreen canvas at the given pixel scale.
 *
 * Uses the same pipeline as the live preview but:
 *   - dpr = 1   (no screen pixel ratio)
 *   - fitScale  = scale
 *   - forExport = true (skips safe-area guide overlay)
 *
 * @param  {object}  grid     – { cols, rows, spacing, margin }
 * @param  {object}  dot      – { shape, size, opacity, color }
 * @param  {object}  logo     – logo state (logo.url may be null)
 * @param  {number}  scale    – 1 | 2 | 4
 * @param  {object}  advanced – advanced settings (outputW/H, bgType, blendMode, etc.)
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderExportCanvas(grid, dot, logo, scale = 1, advanced = {}, transparent = false) {
  const outW = Math.round((advanced.outputW ?? OUTPUT_W) * scale)
  const outH = Math.round((advanced.outputH ?? OUTPUT_H) * scale)

  // Always render the composition first at exact output size
  const artCanvas = document.createElement('canvas')
  artCanvas.width  = outW
  artCanvas.height = outH

  const dpr      = 1
  const fitScale = scale

  if (transparent) {
    // Transparent export: clear canvas only — no background, no frame, no vignette
    const ctx0 = artCanvas.getContext('2d')
    ctx0.clearRect(0, 0, outW, outH)
  } else {
    // Resolve background image element if needed
    const bgImageEl = (advanced.bgType === 'image' && advanced.bgImageUrl)
      ? await loadImage(advanced.bgImageUrl)
      : null

    const bgOpts = {
      bgType:          advanced.bgType          ?? 'solid',
      bgColor:         advanced.bgColor         ?? '#0E0E12',
      bgGradientFrom:  advanced.bgGradientFrom  ?? '#0E0E12',
      bgGradientTo:    advanced.bgGradientTo    ?? '#1A1A2E',
      bgGradientAngle: advanced.bgGradientAngle ?? 135,
      bgImageEl,
    }

    // Layer 1: artboard (background + noise + vignette + frame)
    renderArtboard(artCanvas, outW, outH, dpr, fitScale, /* forExport */ true, bgOpts)
  }

  const ctx = artCanvas.getContext('2d')
  ctx.setTransform(1, 0, 0, 1, 0, 0)  // identity (dpr = 1)

  const dims   = { outputW: advanced.outputW ?? OUTPUT_W, outputH: advanced.outputH ?? OUTPUT_H }
  const layout = computeGridLayout(grid, dims)

  const logoImg   = logo.url ? await loadImage(logo.url) : null
  const blendMode = advanced.blendMode ?? 'normal'

  const gridOpts = {
    showGuides: false,
    showDots:   true,
    dot,
    jitter:  advanced.jitter  ?? 0,
    seed:    advanced.seed    ?? 42,
    outputW: dims.outputW,
    outputH: dims.outputH,
  }

  if (logoImg) {
    // Dots → offscreen, masked by logo alpha
    const off    = document.createElement('canvas')
    off.width    = outW
    off.height   = outH
    const offCtx = off.getContext('2d')
    offCtx.setTransform(1, 0, 0, 1, 0, 0)
    renderGrid(offCtx, dpr, fitScale, grid, gridOpts)
    applyLogoMask(offCtx, fitScale, grid, layout, logoImg, logo)

    // Composite masked dots with blend mode
    ctx.save()
    if (blendMode !== 'normal') ctx.globalCompositeOperation = blendMode
    ctx.drawImage(off, 0, 0)
    ctx.restore()

    // Logo on top
    renderLogo(ctx, dpr, fitScale, grid, layout, logoImg, logo)
  } else {
    ctx.save()
    if (blendMode !== 'normal') ctx.globalCompositeOperation = blendMode
    renderGrid(ctx, dpr, fitScale, grid, gridOpts)
    ctx.restore()
  }

  // Handle export padding: if set, composite artCanvas into a larger padded canvas
  const padPx = Math.round((advanced.exportPadding ?? 0) * scale)
  if (padPx <= 0) return artCanvas

  const padCanvas    = document.createElement('canvas')
  padCanvas.width    = outW + 2 * padPx
  padCanvas.height   = outH + 2 * padPx
  const padCtx       = padCanvas.getContext('2d')
  padCtx.clearRect(0, 0, padCanvas.width, padCanvas.height)
  padCtx.drawImage(artCanvas, padPx, padPx)
  return padCanvas
}
