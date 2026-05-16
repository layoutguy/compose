// ─── Position map ─────────────────────────────────────────────────────────────
//
// ALIGN[position] = [alignX, alignY]
//   Defines which point ON THE LOGO is the anchor handle.
//   0 = left/top edge of logo is the anchor
//   0.5 = center of logo is the anchor
//   1 = right/bottom edge of logo is the anchor
//
//   offsetX/offsetY shift the handle from the grid center.
//   offsetX=0, offsetY=0 → handle sits on the center dot of the grid.
//
const ALIGN = {
  'top-left':   [0,   0  ],
  'top-center': [0.5, 0  ],
  'top-right':  [1,   0  ],
  'mid-left':   [0,   0.5],
  'mid-center': [0.5, 0.5],
  'mid-right':  [1,   0.5],
  'bot-left':   [0,   1  ],
  'bot-center': [0.5, 1  ],
  'bot-right':  [1,   1  ],
}

// ─── Shared geometry ──────────────────────────────────────────────────────────

/**
 * Compute all logo geometry in output-space coordinates.
 * Exported so the SVG/export pipeline can reuse the same math.
 */
export function computeLogoGeometry(grid, layout, img, logo) {
  const { originX, originY, spacingX, spacingY } = layout
  const { cols, rows } = grid
  const { sizeDots, position, offsetX, offsetY } = logo

  // Logo dimensions in output space
  const logoWOut = sizeDots * spacingX
  const aspect   = img.naturalHeight / img.naturalWidth
  const logoHOut = logoWOut * aspect

  // Which point on the logo is the anchor handle
  const [alignX, alignY] = ALIGN[position] ?? ALIGN['bot-right']

  // Handle point = grid center + offset
  // offsetX=0, offsetY=0 → handle sits on the center dot of the grid
  const anchorX = originX + (cols - 1) / 2 * spacingX + offsetX
  const anchorY = originY + (rows - 1) / 2 * spacingY + offsetY

  // Logo top-left in output space
  const logoX = anchorX - alignX * logoWOut
  const logoY = anchorY - alignY * logoHOut

  return {
    logoX, logoY, logoWOut, logoHOut,
    anchorX, anchorY,
    alignX,  alignY,
  }
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

/**
 * Draw the loaded logo image onto the canvas.
 * Context must have setTransform(dpr,0,0,dpr,0,0) applied.
 */
export function renderLogo(ctx, dpr, fitScale, grid, layout, img, logo) {
  if (!img || !logo?.url) return

  const { logoX, logoY, logoWOut, logoHOut } =
    computeLogoGeometry(grid, layout, img, logo)

  const d  = v => v * fitScale
  const dx = d(logoX), dy = d(logoY)
  const dw = d(logoWOut), dh = d(logoHOut)

  if (logo.tintColor) {
    // Draw to an offscreen canvas, then paint the tint color over opaque pixels only
    const off    = document.createElement('canvas')
    off.width    = Math.max(1, Math.ceil(dw))
    off.height   = Math.max(1, Math.ceil(dh))
    const oc     = off.getContext('2d')
    oc.drawImage(img, 0, 0, off.width, off.height)
    oc.globalCompositeOperation = 'source-atop'
    oc.fillStyle = logo.tintColor
    oc.fillRect(0, 0, off.width, off.height)
    ctx.drawImage(off, dx, dy, dw, dh)
  } else {
    ctx.drawImage(img, dx, dy, dw, dh)
  }
}

// ─── Masking ──────────────────────────────────────────────────────────────────

/**
 * Erase dot-grid pixels underneath the logo using destination-out compositing.
 *
 * Call this on the OFFSCREEN canvas after drawing the dot grid, before
 * compositing the offscreen result onto the main canvas.
 *
 * How it works:
 *   - globalCompositeOperation = 'destination-out' uses the SOURCE alpha
 *     channel to punch holes in the destination layer.
 *   - Fully opaque logo pixels → destination fully erased (alpha → 0).
 *   - Fully transparent logo pixels → destination untouched.
 *   - This means SVG/PNG transparency is respected automatically:
 *     dots peek through transparent regions of the logo.
 *
 * Context must have setTransform(dpr,0,0,dpr,0,0) applied.
 */
export function applyLogoMask(ctx, fitScale, grid, layout, img, logo, dotSize = 5) {
  if (!img || !logo?.url) return

  const { logoX, logoY, logoWOut, logoHOut } =
    computeLogoGeometry(grid, layout, img, logo)

  const d = v => v * fitScale

  // Extend the mask by exactly the dot's visual radius (dotSize/2 CSS pixels).
  // This clears any dot whose centre is inside the logo but whose body bleeds
  // past the edge — without touching dots that are fully outside.
  const pad = dotSize / 2

  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = 'rgba(0,0,0,1)'
  ctx.fillRect(
    d(logoX)      - pad,
    d(logoY)      - pad,
    d(logoWOut)   + pad * 2,
    d(logoHOut)   + pad * 2,
  )
  ctx.globalCompositeOperation = 'source-over'
}

// ─── Guide layer ──────────────────────────────────────────────────────────────

/**
 * Draw alignment guides for the logo:
 *   - Dashed bounding rectangle
 *   - Corner L-marks
 *   - Anchor ring (the grid intersection the logo is snapped to)
 *   - Crosshair hairlines through the anchor (when showGuides is true)
 *   - Offset displacement indicator (when offsetX/Y ≠ 0)
 *
 * Context must have setTransform(dpr,0,0,dpr,0,0) applied.
 */
export function renderLogoGuides(ctx, dpr, fitScale, grid, layout, img, logo, displayW, displayH, showGuides) {
  if (!img || !logo?.url) return

  const { logoX, logoY, logoWOut, logoHOut, anchorX, anchorY, alignX, alignY } =
    computeLogoGeometry(grid, layout, img, logo)

  const { offsetX, offsetY } = logo

  const d = v => v * fitScale

  // Display-space logo rect
  const lx = d(logoX),      ly = d(logoY)
  const lw = d(logoWOut),   lh = d(logoHOut)

  // Display-space anchor (pure grid snap, no offset)
  const ax = d(anchorX),    ay = d(anchorY)

  // Pixel sizing helpers (device-independent)
  const px = n => n / dpr

  ctx.save()

  // ── 3. Anchor ring ─────────────────────────────────────────────────────────
  // Outer ring (the grid snap point)
  ctx.strokeStyle = 'rgba(0,87,200,0.65)'
  ctx.lineWidth   = px(1)
  ctx.beginPath()
  ctx.arc(ax, ay, px(4), 0, Math.PI * 2)
  ctx.stroke()

  // Inner dot
  ctx.fillStyle = 'rgba(0,87,200,0.85)'
  ctx.beginPath()
  ctx.arc(ax, ay, px(1.5), 0, Math.PI * 2)
  ctx.fill()

  // ── 4. Crosshair hairlines through anchor (SNAP mode only) ────────────────
  if (showGuides) {
    ctx.strokeStyle = 'rgba(0,87,200,0.09)'
    ctx.lineWidth   = px(0.75)
    ctx.setLineDash([px(5), px(8)])

    ctx.beginPath()
    ctx.moveTo(0,        ay)
    ctx.lineTo(displayW, ay)
    ctx.moveTo(ax, 0)
    ctx.lineTo(ax, displayH)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // ── 6. Margin / safe-area tick on the nearest grid boundary ───────────────
  // Short perpendicular tick where each logo edge aligns to a grid boundary.
  // Only draw when the edge is exactly on the grid boundary (within 1px).
  const { originX, originY, spacingX, spacingY } = layout
  const { cols, rows } = grid

  const gridL = d(originX)
  const gridR = d(originX + (cols - 1) * spacingX)
  const gridT = d(originY)
  const gridB = d(originY + (rows - 1) * spacingY)

  const tickLen   = px(10)
  const tickGap   = px(2)
  const threshold = px(1.5)

  ctx.strokeStyle = 'rgba(0,87,200,0.30)'
  ctx.lineWidth   = px(0.75)
  ctx.beginPath()

  // Left edge ↔ gridL
  if (Math.abs(lx - gridL) < threshold) {
    ctx.moveTo(lx - tickGap,             ly + lh / 2 - tickLen / 2)
    ctx.lineTo(lx - tickGap,             ly + lh / 2 + tickLen / 2)
  }
  // Right edge ↔ gridR
  if (Math.abs(lx + lw - gridR) < threshold) {
    ctx.moveTo(lx + lw + tickGap,        ly + lh / 2 - tickLen / 2)
    ctx.lineTo(lx + lw + tickGap,        ly + lh / 2 + tickLen / 2)
  }
  // Top edge ↔ gridT
  if (Math.abs(ly - gridT) < threshold) {
    ctx.moveTo(lx + lw / 2 - tickLen / 2, ly - tickGap)
    ctx.lineTo(lx + lw / 2 + tickLen / 2, ly - tickGap)
  }
  // Bottom edge ↔ gridB
  if (Math.abs(ly + lh - gridB) < threshold) {
    ctx.moveTo(lx + lw / 2 - tickLen / 2, ly + lh + tickGap)
    ctx.lineTo(lx + lw / 2 + tickLen / 2, ly + lh + tickGap)
  }
  ctx.stroke()

  ctx.restore()
}
