import { OUTPUT_W, OUTPUT_H } from './artboard'

export const GRID_DEFAULTS = {
  cols:   10,
  rows:    5,
  margin: 120,
  // spacing is no longer a user param — it is derived from artboard geometry
}

// ─── Seeded PRNG ──────────────────────────────────────────────────────────────

/**
 * Mulberry32 — fast, high-quality 32-bit PRNG.
 * Returns a function that produces values in [0, 1).
 * Deterministic: same seed → same sequence.
 */
export function mulberry32(seed) {
  let s = seed >>> 0
  return () => {
    s += 0x6D2B79F5
    let t = Math.imul(s ^ (s >>> 15), s | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Layout computation ───────────────────────────────────────────────────────

/**
 * Compute all grid geometry in output-space coordinates.
 *
 * Spacing is no longer a user parameter. It is derived entirely from the
 * artboard dimensions, margin, columns and rows — so that the grid always
 * fills the available space. The engine then evaluates how close the resulting
 * horizontal and vertical intervals are to forming perfect squares.
 *
 * @param  {object} grid   – { cols, rows, margin }  (spacing field is ignored)
 * @param  {object} [dims] – { outputW, outputH } override
 * @returns {object} layout + square-integrity diagnostics
 */
export function computeGridLayout({ cols, rows, margin }, dims = {}) {
  const outW = dims.outputW ?? OUTPUT_W
  const outH = dims.outputH ?? OUTPUT_H

  const c = Math.max(cols,   1)
  const r = Math.max(rows,   1)
  // Clamp margin so each side ≤ 45% of the shorter dimension
  const m = Math.min(Math.max(margin ?? 0, 0), Math.floor(Math.min(outW, outH) * 0.45))

  const availW = outW - 2 * m
  const availH = outH - 2 * m

  // Spacing fills the available space exactly.
  // For a single column/row the dot sits at the centre of that axis.
  const sx = c > 1 ? availW / (c - 1) : availW
  const sy = r > 1 ? availH / (r - 1) : availH

  const ox = c > 1 ? m         : outW / 2
  const oy = r > 1 ? m         : outH / 2

  // ── Square-integrity evaluation ───────────────────────────────────────────
  // Requires at least 2 columns AND 2 rows to have a meaningful "cell".
  const canEval = c > 1 && r > 1
  const diff    = canEval ? Math.abs(sx - sy) : 0

  // Use a relative threshold: diff as a fraction of average spacing.
  // This makes the rating scale-aware — a 9px diff on 300px spacing cells
  // is far more "square" than a 9px diff on 20px spacing cells.
  let integrity = 'n/a'
  if (canEval) {
    const avgSpacing = (sx + sy) / 2
    const relDiff = diff / avgSpacing   // 0 = perfect square, 1 = wildly off
    if      (relDiff <= 0.06) integrity = 'excellent'
    else if (relDiff <= 0.15) integrity = 'acceptable'
    else                      integrity = 'poor'
  }

  return {
    originX:   ox,
    originY:   oy,
    spacingX:  sx,
    spacingY:  sy,
    dotCount:  c * r,
    // integrity diagnostics
    diff:      Math.round(diff),
    integrity,              // 'excellent' | 'acceptable' | 'poor' | 'n/a'
    // legacy shims — kept so existing callers don't crash
    isClamped:     false,
    actualSpacing: Math.round(Math.min(sx, sy)),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const a = Math.max(0, Math.min(1, alpha))
  return `rgba(${r},${g},${b},${a})`
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

/**
 * Render guide lines and dots.
 * Context must already have setTransform(dpr,0,0,dpr,0,0) applied.
 *
 * opts = {
 *   showGuides  – boolean
 *   showDots    – boolean
 *   dot         – { shape, size, opacity, color }
 *   jitter      – 0–0.5 fraction of spacing for positional randomisation
 *   seed        – integer seed for deterministic jitter
 *   outputW     – custom artboard width (defaults to OUTPUT_W)
 *   outputH     – custom artboard height (defaults to OUTPUT_H)
 * }
 */
export function renderGrid(ctx, dpr, fitScale, grid, opts = {}) {
  const {
    showGuides = false,
    showDots   = true,
    dot        = {},
    jitter     = 0,
    seed       = 42,
    outputW,
    outputH,
  } = opts

  const {
    shape   = 'square',
    size    = 5,
    opacity = 0.84,
    color   = '#FFFFFF',
  } = dot

  if (!showGuides && !showDots) return

  const dims = { outputW, outputH }
  const { cols, rows } = grid
  const { originX, originY, spacingX, spacingY } =
    computeGridLayout(grid, dims)

  const d  = v => v * fitScale   // output-space → display CSS-px
  const ox = d(originX)
  const oy = d(originY)
  const sx = d(spacingX)
  const sy = d(spacingY)

  // ── Guide lines ────────────────────────────────────────────────────────────
  if (showGuides && (cols > 1 || rows > 1)) {
    ctx.save()
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'
    ctx.lineWidth   = 0.5 / dpr

    ctx.beginPath()
    for (let i = 0; i < cols; i++) {
      const x = ox + i * sx
      ctx.moveTo(x, oy)
      ctx.lineTo(x, oy + (rows - 1) * sy)
    }
    for (let j = 0; j < rows; j++) {
      const y = oy + j * sy
      ctx.moveTo(ox,                   y)
      ctx.lineTo(ox + (cols - 1) * sx, y)
    }
    ctx.stroke()
    ctx.restore()
  }

  // ── Dots ──────────────────────────────────────────────────────────────────
  if (showDots) {
    const rawSize  = Math.max(1, size * fitScale)
    const snapSize = Math.max(1 / dpr, Math.round(rawSize * dpr) / dpr)
    const half     = snapSize / 2

    // Set up PRNG if jitter is active — must iterate cols×rows in the same
    // order as the drawing loops below so the sequence is deterministic.
    const rng = (jitter > 0) ? mulberry32(seed) : null

    ctx.save()
    ctx.fillStyle = hexToRgba(color, opacity)

    if (shape === 'square') {
      for (let i = 0; i < cols; i++) {
        const bx = ox + i * sx
        for (let j = 0; j < rows; j++) {
          const by = oy + j * sy
          const jx = rng ? (rng() - 0.5) * 2 * jitter * sx : 0
          const jy = rng ? (rng() - 0.5) * 2 * jitter * sy : 0
          const rx = Math.round((bx + jx - half) * dpr) / dpr
          const ry = Math.round((by + jy - half) * dpr) / dpr
          ctx.fillRect(rx, ry, snapSize, snapSize)
        }
      }

    } else if (shape === 'circle') {
      const r = half
      ctx.beginPath()
      for (let i = 0; i < cols; i++) {
        const bx = ox + i * sx
        for (let j = 0; j < rows; j++) {
          const by = oy + j * sy
          const jx = rng ? (rng() - 0.5) * 2 * jitter * sx : 0
          const jy = rng ? (rng() - 0.5) * 2 * jitter * sy : 0
          const cx = Math.round((bx + jx) * dpr) / dpr
          const cy = Math.round((by + jy) * dpr) / dpr
          ctx.moveTo(cx + r, cy)
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
        }
      }
      ctx.fill()

    } else if (shape === 'diamond') {
      ctx.beginPath()
      for (let i = 0; i < cols; i++) {
        const bx = ox + i * sx
        for (let j = 0; j < rows; j++) {
          const by = oy + j * sy
          const jx = rng ? (rng() - 0.5) * 2 * jitter * sx : 0
          const jy = rng ? (rng() - 0.5) * 2 * jitter * sy : 0
          const cx = Math.round((bx + jx) * dpr) / dpr
          const cy = Math.round((by + jy) * dpr) / dpr
          ctx.moveTo(cx,        cy - half)
          ctx.lineTo(cx + half, cy)
          ctx.lineTo(cx,        cy + half)
          ctx.lineTo(cx - half, cy)
          ctx.closePath()
        }
      }
      ctx.fill()
    }

    ctx.restore()
  }
}
