import { OUTPUT_W, OUTPUT_H } from '../canvas/artboard'
import { computeGridLayout, mulberry32 } from '../canvas/grid'
import { computeLogoGeometry } from '../canvas/logo'

// ─── Shared helpers ───────────────────────────────────────────────────────────

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, quality))
}

function hexToRgba(hex, alpha) {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, alpha))})`
}

async function blobUrlToDataUrl(blobUrl) {
  const res    = await fetch(blobUrl)
  const blob   = await res.blob()
  return new Promise((resolve, reject) => {
    const reader   = new FileReader()
    reader.onload  = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// ─── Raster exports ───────────────────────────────────────────────────────────

export async function exportAsPNG(canvas, filename) {
  const blob = await canvasToBlob(canvas, 'image/png')
  downloadBlob(blob, filename)
}

export async function exportAsJPG(canvas, filename) {
  // Flatten alpha to black before JPEG
  const flat    = document.createElement('canvas')
  flat.width    = canvas.width
  flat.height   = canvas.height
  const ctx     = flat.getContext('2d')
  ctx.fillStyle = '#000000'
  ctx.fillRect(0, 0, flat.width, flat.height)
  ctx.drawImage(canvas, 0, 0)
  const blob = await canvasToBlob(flat, 'image/jpeg', 0.94)
  downloadBlob(blob, filename)
}

export async function exportAsWEBP(canvas, filename) {
  const blob = await canvasToBlob(canvas, 'image/webp', 0.94)
  downloadBlob(blob, filename)
}

// ─── SVG export ───────────────────────────────────────────────────────────────

/**
 * Generate a native SVG that exactly replicates the composition.
 *
 * Supports:
 *   - Solid / gradient / image backgrounds
 *   - Dot jitter (deterministic, matches canvas rendering)
 *   - Custom artboard dimensions
 *   - Logo masking via feColorMatrix alpha-inversion
 */
export async function exportAsSVG(grid, dot, logo, advanced = {}, filename) {
  const W = advanced.outputW ?? OUTPUT_W
  const H = advanced.outputH ?? OUTPUT_H

  const dims   = { outputW: W, outputH: H }
  const layout = computeGridLayout(grid, dims)
  const { originX, originY, spacingX, spacingY } = layout
  const { cols, rows } = grid
  const { shape, size, opacity, color } = dot
  const fillColor = hexToRgba(color, opacity)
  const half = size / 2

  // Jitter config
  const jitter = advanced.jitter ?? 0
  const seed   = advanced.seed   ?? 42
  const rng    = (jitter > 0) ? mulberry32(seed) : null

  // ── Background data URLs ─────────────────────────────────────────────────
  let bgImageDataUrl = null
  if (advanced.bgType === 'image' && advanced.bgImageUrl) {
    bgImageDataUrl = await blobUrlToDataUrl(advanced.bgImageUrl)
  }

  // ── Logo geometry & data URL ─────────────────────────────────────────────
  let logoDataUrl = null
  let logoGeom    = null
  if (logo.url) {
    logoDataUrl = await blobUrlToDataUrl(logo.url)
    const img = await new Promise((resolve, reject) => {
      const i = new Image()
      i.onload  = () => resolve(i)
      i.onerror = reject
      i.src = logoDataUrl
    })
    logoGeom = computeLogoGeometry(grid, layout, img, logo)
  }

  // ── Build SVG ────────────────────────────────────────────────────────────
  const lines = []
  lines.push(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`)
  lines.push('  <defs>')

  // Vignette gradient
  lines.push(`    <radialGradient id="vignette" cx="50%" cy="50%" r="95%" fx="50%" fy="50%">`)
  lines.push(`      <stop offset="25%" stop-color="black" stop-opacity="0"/>`)
  lines.push(`      <stop offset="100%" stop-color="black" stop-opacity="0.18"/>`)
  lines.push(`    </radialGradient>`)

  // Gradient background def (when applicable)
  if (advanced.bgType === 'gradient') {
    const angle  = advanced.bgGradientAngle ?? 135
    const rad    = (angle - 90) * Math.PI / 180
    const len    = Math.sqrt(W * W + H * H) / 2
    const cx     = W / 2, cy = H / 2
    const x1pct  = ((cx - Math.cos(rad) * len) / W * 100).toFixed(2)
    const y1pct  = ((cy - Math.sin(rad) * len) / H * 100).toFixed(2)
    const x2pct  = ((cx + Math.cos(rad) * len) / W * 100).toFixed(2)
    const y2pct  = ((cy + Math.sin(rad) * len) / H * 100).toFixed(2)
    lines.push(`    <linearGradient id="bgGradient" x1="${x1pct}%" y1="${y1pct}%" x2="${x2pct}%" y2="${y2pct}%" gradientUnits="userSpaceOnUse">`)
    lines.push(`      <stop offset="0%" stop-color="${advanced.bgGradientFrom ?? '#0E0E12'}"/>`)
    lines.push(`      <stop offset="100%" stop-color="${advanced.bgGradientTo ?? '#1A1A2E'}"/>`)
    lines.push(`    </linearGradient>`)
  }

  // Logo mask defs
  if (logoGeom) {
    lines.push(`    <filter id="logoAlphaInvert" x="0%" y="0%" width="100%" height="100%">`)
    lines.push(`      <feColorMatrix type="matrix"`)
    lines.push(`        values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 -1 1"/>`)
    lines.push(`    </filter>`)
    lines.push(`    <mask id="dotMask" maskUnits="userSpaceOnUse">`)
    lines.push(`      <rect width="${W}" height="${H}" fill="white"/>`)
    lines.push(`      <image href="${logoDataUrl}"`)
    lines.push(`        x="${logoGeom.logoX.toFixed(3)}" y="${logoGeom.logoY.toFixed(3)}"`)
    lines.push(`        width="${logoGeom.logoWOut.toFixed(3)}" height="${logoGeom.logoHOut.toFixed(3)}"`)
    lines.push(`        filter="url(#logoAlphaInvert)"/>`)
    lines.push(`    </mask>`)
  }

  lines.push('  </defs>')

  // ── Background layer ─────────────────────────────────────────────────────
  if (advanced.bgType === 'image' && bgImageDataUrl) {
    lines.push(`  <image href="${bgImageDataUrl}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`)
  } else if (advanced.bgType === 'gradient') {
    lines.push(`  <rect width="${W}" height="${H}" fill="url(#bgGradient)"/>`)
  } else {
    lines.push(`  <rect width="${W}" height="${H}" fill="${advanced.bgColor ?? '#0E0E12'}"/>`)
  }

  // Vignette overlay
  lines.push(`  <rect width="${W}" height="${H}" fill="url(#vignette)"/>`)

  // ── Corner registration marks ────────────────────────────────────────────
  const armLen = Math.round(W * 0.008)
  const inset  = Math.round(armLen * 0.7)
  const corners = [
    [inset,     inset,      1,  1],
    [W - inset, inset,     -1,  1],
    [inset,     H - inset,  1, -1],
    [W - inset, H - inset, -1, -1],
  ]
  lines.push(`  <g stroke="rgba(255,255,255,0.18)" stroke-width="1" stroke-linecap="round" fill="none">`)
  for (const [x, y, dx, dy] of corners) {
    lines.push(`    <polyline points="${x + dx * armLen},${y} ${x},${y} ${x},${y + dy * armLen}"/>`)
  }
  lines.push(`  </g>`)

  // ── Dot grid ─────────────────────────────────────────────────────────────
  const maskAttr = logoGeom ? ' mask="url(#dotMask)"' : ''
  lines.push(`  <g fill="${fillColor}"${maskAttr}>`)

  for (let i = 0; i < cols; i++) {
    const bx = originX + i * spacingX
    for (let j = 0; j < rows; j++) {
      const by = originY + j * spacingY
      const jx = rng ? (rng() - 0.5) * 2 * jitter * spacingX : 0
      const jy = rng ? (rng() - 0.5) * 2 * jitter * spacingY : 0
      const cx = bx + jx
      const cy = by + jy

      if (shape === 'square') {
        lines.push(`    <rect x="${(cx - half).toFixed(2)}" y="${(cy - half).toFixed(2)}" width="${size}" height="${size}"/>`)
      } else if (shape === 'circle') {
        lines.push(`    <circle cx="${cx.toFixed(2)}" cy="${cy.toFixed(2)}" r="${half}"/>`)
      } else if (shape === 'diamond') {
        lines.push(`    <polygon points="${cx.toFixed(2)},${(cy - half).toFixed(2)} ${(cx + half).toFixed(2)},${cy.toFixed(2)} ${cx.toFixed(2)},${(cy + half).toFixed(2)} ${(cx - half).toFixed(2)},${cy.toFixed(2)}"/>`)
      }
    }
  }
  lines.push(`  </g>`)

  // ── Logo on top ──────────────────────────────────────────────────────────
  if (logoGeom && logoDataUrl) {
    lines.push(`  <image href="${logoDataUrl}"`)
    lines.push(`    x="${logoGeom.logoX.toFixed(3)}" y="${logoGeom.logoY.toFixed(3)}"`)
    lines.push(`    width="${logoGeom.logoWOut.toFixed(3)}" height="${logoGeom.logoHOut.toFixed(3)}"/>`)
  }

  lines.push('</svg>')

  const svgString = lines.join('\n')
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
  downloadBlob(blob, filename)
}

// ─── PDF export ───────────────────────────────────────────────────────────────

export async function exportAsPDF(canvas, filename) {
  const jpegBlob  = await canvasToBlob(canvas, 'image/jpeg', 0.94)
  const jpegBuf   = await jpegBlob.arrayBuffer()
  const jpegBytes = new Uint8Array(jpegBuf)

  const W = canvas.width
  const H = canvas.height
  const enc = s => new TextEncoder().encode(s)

  const stream4 = `q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`

  const o1 = `1 0 obj\n<</Type /Catalog /Pages 2 0 R>>\nendobj\n`
  const o2 = `2 0 obj\n<</Type /Pages /Kids [3 0 R] /Count 1>>\nendobj\n`
  const o3 = `3 0 obj\n<</Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents 4 0 R /Resources <</XObject <</Im0 5 0 R>>>>>>\nendobj\n`
  const o4 = `4 0 obj\n<</Length ${stream4.length}>>\nstream\n${stream4}\nendstream\nendobj\n`
  const o5h = `5 0 obj\n<</Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length}>>\nstream\n`
  const o5t = `\nendstream\nendobj\n`

  const header = `%PDF-1.4\n`
  const offsets = []
  let pos = header.length

  ;[o1, o2, o3, o4].forEach(s => { offsets.push(pos); pos += s.length })
  offsets.push(pos)
  pos += enc(o5h).length + jpegBytes.length + enc(o5t).length

  const xrefStart = pos
  let xref = `xref\n0 6\n0000000000 65535 f \n`
  for (const o of offsets) xref += String(o).padStart(10, '0') + ` 00000 n \n`
  xref += `trailer\n<</Size 6 /Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF\n`

  const parts  = [enc(header), enc(o1), enc(o2), enc(o3), enc(o4), enc(o5h), jpegBytes, enc(o5t), enc(xref)]
  const total  = parts.reduce((n, p) => n + p.length, 0)
  const result = new Uint8Array(total)
  let off = 0
  for (const p of parts) { result.set(p, off); off += p.length }

  downloadBlob(new Blob([result], { type: 'application/pdf' }), filename)
}

// ─── Metadata helpers ─────────────────────────────────────────────────────────

/**
 * Output dimensions for the given scale and advanced settings.
 * @param {number} scale
 * @param {object} [advanced]  – { outputW, outputH, exportPadding }
 */
export function exportDimensions(scale, advanced = {}) {
  const baseW = advanced.outputW    ?? OUTPUT_W
  const baseH = advanced.outputH    ?? OUTPUT_H
  const pad   = advanced.exportPadding ?? 0
  return {
    w: baseW * scale + 2 * pad,
    h: baseH * scale + 2 * pad,
  }
}

/** Rough file-size estimate (shown before export). */
export function estimateSize(format, scale, advanced = {}) {
  const { w, h } = exportDimensions(scale, advanced)
  const px = w * h
  switch (format) {
    case 'png':  return fmtBytes(px * 0.5)
    case 'jpg':  return fmtBytes(px * 0.14)
    case 'webp': return fmtBytes(px * 0.10)
    case 'pdf':  return fmtBytes(px * 0.14 + 50_000)
    case 'svg':  return '< 1 MB'
    default:     return '—'
  }
}

function fmtBytes(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + ' MB'
  return (n / 1_000).toFixed(0) + ' KB'
}
