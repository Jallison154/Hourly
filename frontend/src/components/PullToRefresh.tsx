import { useState, useRef, useEffect, ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void
  children: ReactNode
  disabled?: boolean
}

export default function PullToRefresh({ onRefresh, children, disabled = false }: PullToRefreshProps) {
  const [isPulling, setIsPulling] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef<number>(0)
  const currentY = useRef<number>(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const threshold = 80 // Distance in pixels to trigger refresh

  useEffect(() => {
    if (disabled) return

    const container = containerRef.current
    if (!container) return

    const isAtTop = () => {
      // Check if we're at the top of any scrollable parent
      let element: HTMLElement | null = container
      while (element) {
        if (element.scrollTop === 0) {
          element = element.parentElement
        } else {
          return false
        }
      }
      // Also check window scroll
      return window.scrollY === 0
    }

    const handleTouchStart = (e: TouchEvent) => {
      // Only start pull if at the top of the scrollable area
      if (isAtTop()) {
        startY.current = e.touches[0].clientY
        currentY.current = e.touches[0].clientY
        setIsPulling(true)
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling) return

      currentY.current = e.touches[0].clientY
      const distance = Math.max(0, currentY.current - startY.current)
      
      // Only allow pull if we're at the top
      if (isAtTop() && distance > 0) {
        setPullDistance(distance)
        // Prevent default scrolling while pulling
        if (distance > 10) {
          e.preventDefault()
        }
      } else {
        setIsPulling(false)
        setPullDistance(0)
      }
    }

    const handleTouchEnd = async () => {
      if (!isPulling) return

      if (pullDistance >= threshold && !isRefreshing) {
        setIsRefreshing(true)
        setIsPulling(false)
        setPullDistance(0)
        
        try {
          await onRefresh()
        } catch (error) {
          console.error('Refresh error:', error)
        } finally {
          setIsRefreshing(false)
        }
      } else {
        setIsPulling(false)
        setPullDistance(0)
      }
    }

    // Use document for touch events to catch all touches
    document.addEventListener('touchstart', handleTouchStart, { passive: false })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd)

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isPulling, pullDistance, isRefreshing, onRefresh, disabled])

  const pullProgress = Math.min(pullDistance / threshold, 1)
  const shouldShowIndicator = isPulling || isRefreshing

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <AnimatePresence>
        {shouldShowIndicator && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ 
              opacity: 1, 
              y: isRefreshing ? 0 : -50 + (pullDistance * 0.5)
            }}
            exit={{ opacity: 0, y: -50 }}
            className="fixed top-0 left-0 right-0 flex items-center justify-center z-50 pointer-events-none"
            style={{ 
              height: isRefreshing ? 60 : Math.min(pullDistance, 100),
              paddingTop: 'env(safe-area-inset-top, 0px)'
            }}
          >
            {isRefreshing ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"
              />
            ) : (
              <motion.div
                animate={{ rotate: pullProgress * 360 }}
                className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"
                style={{ opacity: pullProgress }}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.div
        animate={{ 
          y: isRefreshing ? 60 : Math.min(pullDistance, 100)
        }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        {children}
      </motion.div>
    </div>
  )
}

