import { useSyncExternalStore } from 'react'

type CanvasSnapshot = { active: boolean; zoom: number; panX: number; panY: number }

const DEFAULT: CanvasSnapshot = { active: false, zoom: 1, panX: 0, panY: 0 }

let snapshot: CanvasSnapshot = DEFAULT
const listeners = new Set<() => void>()

let bodyOffset = { x: 0, y: 0 }
export function getBodyOffset() { return bodyOffset }
export function setBodyOffset(o: { x: number; y: number }) { bodyOffset = o }

export function getCanvasSnapshot(): CanvasSnapshot {
  return snapshot
}

export function setCanvasSnapshot(next: CanvasSnapshot) {
  snapshot = next
  listeners.forEach((cb) => cb())
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** Synchronous canvas state — no rAF lag. Use for overlays that must track the DOM transform exactly. */
export function useCanvasSnapshot(): CanvasSnapshot {
  return useSyncExternalStore(subscribe, getCanvasSnapshot, () => DEFAULT)
}
