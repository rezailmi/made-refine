export const SNAP_THRESHOLD_PX = 6

/**
 * Collect viewport-space edge positions from visible DOM elements.
 * Called once at drag start to avoid DOM access during pointermove.
 */
export function collectSnapTargets(orientation: 'horizontal' | 'vertical'): number[] {
  const edges: number[] = []
  const elements = document.body.querySelectorAll('*')
  const viewportW = window.innerWidth
  const viewportH = window.innerHeight

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i] as HTMLElement
    if (el === document.body || el === document.documentElement) continue
    if (el.closest('[data-direct-edit]') || el.closest('[data-direct-edit-host]')) continue
    // Skip display:none subtrees without calling getBoundingClientRect.
    // offsetParent is null for display:none elements (and position:fixed, which
    // we intentionally exclude — snap targets should be page content, not UI overlays).
    if (el.offsetParent === null && el !== document.body) continue

    const rect = el.getBoundingClientRect()
    if (rect.width < 4 || rect.height < 4) continue

    // Skip off-screen elements (200px buffer)
    if (
      rect.right < -200
      || rect.bottom < -200
      || rect.left > viewportW + 200
      || rect.top > viewportH + 200
    ) continue

    if (orientation === 'horizontal') {
      edges.push(rect.top, rect.bottom)
    } else {
      edges.push(rect.left, rect.right)
    }

    if (edges.length >= 2000) break
  }

  return edges
}

/**
 * Find the nearest snap edge within threshold.
 * Returns the snapped viewport position, or null if nothing is close enough.
 */
export function findSnap(
  viewportPos: number,
  snapEdges: number[],
  threshold: number,
): number | null {
  let best: number | null = null
  let bestDist = threshold + 1

  for (let i = 0; i < snapEdges.length; i++) {
    const dist = Math.abs(snapEdges[i] - viewportPos)
    if (dist < bestDist) {
      bestDist = dist
      best = snapEdges[i]
    }
  }

  return bestDist <= threshold ? best : null
}
