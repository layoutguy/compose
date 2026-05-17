export const OUTPUT_W = 3840
export const OUTPUT_H = 2160

// ─── Noise texture (generated once, reused) ───────────────────────────────────

let noiseOffscreen = null

function ensureNoise() {
  if (noiseOffscreen) return noiseOffscreen
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(size, size)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) {
    const v = (Math.random() * 255) | 0
    d[i] = d[i + 1] = d[i + 2] = v
    d[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  noiseOffscreen = canvas
  return noiseOffscreen
}

// ─── Layer renderers ──────────────────────────────────────────────────────────

/**
 * Render the background layer.
 *
 * bgOpts = {
 *   bgType:          'solid' | 'gradient' | 'image'
 *   bgColor:         '#rrggbb'                (solid)
 *   bgGradientFrom:  '#rrggbb'                (gradient)
 *   bgGradientTo:    '#rrggbb'                (gradient)
 *   bgGradientAngle: number (degrees)         (gradient)
 *   bgImageEl:       HTMLImageElement | null  (image)
 * }
 */
function renderBackground(ctx, w, h, bgOpts = {}, forExport = false) {
  const {
    bgType          = 'solid',
    bgColor         = '#11100D',
    bgGradientFrom  = '#11100D',
    bgGradientTo    = '#1A1A2E',
    bgGradientAngle = 135,
    bgImageEl       = null,
  } = bgOpts

  if (bgType === 'image' && bgImageEl) {
    // Cover-fit: centre-crop the image to exactly fill the canvas
    const iw = bgImageEl.naturalWidth
    const ih = bgImageEl.naturalHeight
    const canvasAspect = w / h
    const imgAspect    = iw / ih
    let sx = 0, sy = 0, sw = iw, sh = ih
    if (imgAspect > canvasAspect) {
      sw = ih * canvasAspect
      sx = (iw - sw) / 2
    } else {
      sh = iw / canvasAspect
      sy = (ih - sh) / 2
    }
    ctx.drawImage(bgImageEl, sx, sy, sw, sh, 0, 0, w, h)

  } else if (bgType === 'gradient') {
    // Linear gradient along bgGradientAngle (0° = top-to-bottom, 90° = left-to-right)
    const rad = (bgGradientAngle - 90) * Math.PI / 180
    const len = Math.sqrt(w * w + h * h) / 2
    const cx = w / 2, cy = h / 2
    const grad = ctx.createLinearGradient(
      cx - Math.cos(rad) * len, cy - Math.sin(rad) * len,
      cx + Math.cos(rad) * len, cy + Math.sin(rad) * len,
    )
    grad.addColorStop(0, bgGradientFrom)
    grad.addColorStop(1, bgGradientTo)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

  } else {
    // Solid (default)
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, w, h)
  }

  if (!forExport) {
    // Noise grain (very subtle, always applied on top)
    const noise   = ensureNoise()
    const pattern = ctx.createPattern(noise, 'repeat')
    ctx.save()
    ctx.globalAlpha = 0.022
    ctx.globalCompositeOperation = 'screen'
    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, w, h)
    ctx.restore()

    // Vignette — darkens corners, draws focus to centre
    const vignette = ctx.createRadialGradient(
      w / 2, h / 2, h * 0.25,
      w / 2, h / 2, h * 0.95,
    )
    vignette.addColorStop(0, 'rgba(0,0,0,0)')
    vignette.addColorStop(1, 'rgba(0,0,0,0.18)')
    ctx.fillStyle = vignette
    ctx.fillRect(0, 0, w, h)
  }
}

function renderFrame(ctx, w, h, dpr, forExport) {
  const px = 1 / dpr

  // Hairline artboard border
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = px
  ctx.strokeRect(px / 2, px / 2, w - px, h - px)
  ctx.restore()

  // Corner registration marks — proportional at export res, compact for display
  const armLen = forExport
    ? Math.round(w * 0.008)
    : Math.max(10, Math.min(20, w * 0.012))
  const inset = Math.round(armLen * 0.7)

  const corners = [
    [inset,     inset,      1,  1],
    [w - inset, inset,     -1,  1],
    [inset,     h - inset,  1, -1],
    [w - inset, h - inset, -1, -1],
  ]

  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = px
  ctx.lineCap = 'round'
  corners.forEach(([x, y, dx, dy]) => {
    ctx.beginPath()
    ctx.moveTo(x + dx * armLen, y)
    ctx.lineTo(x, y)
    ctx.lineTo(x, y + dy * armLen)
    ctx.stroke()
  })
  ctx.restore()
}

function renderGuides(ctx, w, h, dpr, fitScale) {
  const px = 1 / dpr
  const safeInset = 120 * fitScale
  if (safeInset < 6) return

  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = px
  ctx.setLineDash([3 * px, 7 * px])
  ctx.strokeRect(safeInset, safeInset, w - safeInset * 2, h - safeInset * 2)
  ctx.setLineDash([])
  ctx.restore()
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * @param {boolean}  forExport  – skip safe-area guides; use proportional corner marks.
 * @param {object}   bgOpts     – background configuration (see renderBackground above).
 */
export function renderArtboard(canvas, displayW, displayH, dpr, fitScale, forExport = false, bgOpts = {}) {
  const ctx = canvas.getContext('2d')

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

  renderBackground(ctx, displayW, displayH, bgOpts)
  if (!forExport) renderGuides(ctx, displayW, displayH, dpr, fitScale)
  if (!forExport) renderFrame(ctx, displayW, displayH, dpr, forExport)
}
