import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import OfflineBanner from './OfflineBanner'

describe('OfflineBanner', () => {
  beforeEach(() => {
    cleanup()
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: true,
    })
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('is hidden when online', () => {
    render(<OfflineBanner />)
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('shows offline warning', () => {
    Object.defineProperty(navigator, 'onLine', {
      configurable: true,
      value: false,
    })
    render(<OfflineBanner />)
    expect(screen.getByRole('status').textContent).toMatch(/offline/i)
  })

  it('reacts to offline event', () => {
    render(<OfflineBanner />)
    act(() => {
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getAllByRole('status').length).toBeGreaterThan(0)
  })
})
