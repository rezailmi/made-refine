import * as React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import {
  getBodyOffset,
  getCanvasSnapshot,
  registerCanvasStoreOwner,
  setBodyOffset,
  setCanvasSnapshot,
  useCanvasSnapshot,
} from './canvas-store'

describe('canvas-store', () => {
  afterEach(() => {
    cleanup()
    setCanvasSnapshot({ active: false, zoom: 1, panX: 0, panY: 0 })
    setBodyOffset({ x: 0, y: 0 })
  })

  it('returns the default snapshot before any set', () => {
    expect(getCanvasSnapshot()).toEqual({ active: false, zoom: 1, panX: 0, panY: 0 })
  })

  it('round-trips canvas snapshots', () => {
    const next = { active: true, zoom: 1.5, panX: 24, panY: -8 }
    setCanvasSnapshot(next)

    expect(getCanvasSnapshot()).toBe(next)
  })

  it('notifies useCanvasSnapshot subscribers on updates', () => {
    function SnapshotReader() {
      const snapshot = useCanvasSnapshot()
      return (
        <output>{`${snapshot.active}:${snapshot.zoom}:${snapshot.panX}:${snapshot.panY}`}</output>
      )
    }

    render(<SnapshotReader />)
    expect(screen.getByText('false:1:0:0')).toBeTruthy()

    act(() => {
      setCanvasSnapshot({ active: true, zoom: 2, panX: 10, panY: 20 })
    })

    expect(screen.getByText('true:2:10:20')).toBeTruthy()
  })

  it('round-trips body offsets', () => {
    setBodyOffset({ x: 12, y: -4 })
    expect(getBodyOffset()).toEqual({ x: 12, y: -4 })
  })

  it('owner disposers are idempotent enough to avoid negative counts', () => {
    const disposeFirst = registerCanvasStoreOwner()
    const disposeSecond = registerCanvasStoreOwner()

    expect(() => {
      disposeSecond()
      disposeSecond()
      disposeFirst()
    }).not.toThrow()
  })
})
