import type { VisualAnnotation } from './types'

type UpdateListener = (annotation: VisualAnnotation) => void

const MAX_ANNOTATIONS = 500
/** Resolved/dismissed annotations are pruned after 5 minutes */
const RESOLVED_TTL_MS = 5 * 60 * 1000

class EditStore {
  private annotations: Map<string, VisualAnnotation> = new Map()
  private listeners: Set<UpdateListener> = new Set()

  add(annotation: VisualAnnotation): void {
    this.prune()
    if (this.annotations.size >= MAX_ANNOTATIONS) {
      // Evict oldest resolved/dismissed first, then oldest overall
      const evicted =
        this.findOldestByStatus(['applied', 'dismissed']) ?? this.findOldest()
      if (evicted) this.annotations.delete(evicted)
    }
    this.annotations.set(annotation.id, annotation)
    this.notify(annotation)
  }

  getAll(): VisualAnnotation[] {
    this.prune()
    return Array.from(this.annotations.values())
  }

  getPending(): VisualAnnotation[] {
    return this.getAll().filter((a) => a.status === 'pending')
  }

  getById(id: string): VisualAnnotation | undefined {
    return this.annotations.get(id)
  }

  updateStatus(id: string, status: VisualAnnotation['status']): boolean {
    const annotation = this.annotations.get(id)
    if (!annotation) return false
    annotation.status = status
    return true
  }

  onUpdate(callback: UpdateListener): () => void {
    this.listeners.add(callback)
    return () => {
      this.listeners.delete(callback)
    }
  }

  private notify(annotation: VisualAnnotation): void {
    for (const listener of this.listeners) {
      listener(annotation)
    }
  }

  /** Remove resolved/dismissed annotations older than TTL */
  private prune(): void {
    const cutoff = Date.now() - RESOLVED_TTL_MS
    for (const [id, annotation] of this.annotations) {
      if (
        (annotation.status === 'applied' || annotation.status === 'dismissed') &&
        annotation.timestamp < cutoff
      ) {
        this.annotations.delete(id)
      }
    }
  }

  private findOldestByStatus(statuses: string[]): string | null {
    let oldestId: string | null = null
    let oldestTime = Infinity
    for (const [id, annotation] of this.annotations) {
      if (statuses.includes(annotation.status) && annotation.timestamp < oldestTime) {
        oldestTime = annotation.timestamp
        oldestId = id
      }
    }
    return oldestId
  }

  private findOldest(): string | null {
    let oldestId: string | null = null
    let oldestTime = Infinity
    for (const [id, annotation] of this.annotations) {
      if (annotation.timestamp < oldestTime) {
        oldestTime = annotation.timestamp
        oldestId = id
      }
    }
    return oldestId
  }
}

export const store = new EditStore()
