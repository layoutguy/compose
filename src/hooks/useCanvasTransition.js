/**
 * Lightweight module-level pub/sub for canvas blur transitions.
 *
 * CanvasArea registers a handler via `registerTransition`.
 * Any component calls `triggerTransition(callback)` to:
 *   1. Blur the canvas out
 *   2. Execute the callback (apply state change)
 *   3. Blur the canvas back in
 */

let _trigger = null

export function registerTransition(fn) {
  _trigger = fn
}

export function triggerTransition(callback) {
  if (_trigger) {
    _trigger(callback)
  } else {
    callback()
  }
}
