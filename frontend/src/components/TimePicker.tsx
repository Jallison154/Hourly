import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  toLocalDateInputValue,
  toLocalTimeInputValue,
  fromLocalDateAndTime,
} from '../utils/date'

interface TimePickerProps {
  value: Date
  onChange: (date: Date) => void
  label: string
}

function useIsMinSm() {
  const [isSm, setIsSm] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px)')
    const sync = () => setIsSm(mq.matches)
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])
  return isSm
}

export default function TimePicker({ value, onChange, label }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [date, setDate] = useState(() => toLocalDateInputValue(value))
  const [time, setTime] = useState(() => toLocalTimeInputValue(value))
  const isDesktop = useIsMinSm()
  const headingId = useRef(`time-picker-${Math.random().toString(36).slice(2, 9)}`).current

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isOpen])

  const handleToggle = () => {
    if (!isOpen) {
      setDate(toLocalDateInputValue(value))
      setTime(toLocalTimeInputValue(value))
    }
    setIsOpen((o) => !o)
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setDate(next)
    onChange(fromLocalDateAndTime(next, time))
  }

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value
    setTime(next)
    onChange(fromLocalDateAndTime(date, next))
  }

  const useNow = () => {
    const now = new Date()
    setDate(toLocalDateInputValue(now))
    setTime(toLocalTimeInputValue(now))
    onChange(now)
  }

  const display = value.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const sheet = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/45 sm:bg-black/35"
            onClick={() => setIsOpen(false)}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={headingId}
            initial={
              isDesktop
                ? { opacity: 0, scale: 0.96, y: 8 }
                : { opacity: 1, y: '100%' }
            }
            animate={isDesktop ? { opacity: 1, scale: 1, y: 0 } : { opacity: 1, y: 0 }}
            exit={
              isDesktop
                ? { opacity: 0, scale: 0.96, y: 8 }
                : { opacity: 1, y: '100%' }
            }
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed inset-x-0 bottom-0 z-[61] max-h-[85vh] overflow-y-auto rounded-t-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-600 dark:bg-gray-800 sm:inset-x-auto sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-h-[min(90vh,520px)] sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-100 px-4 py-3 dark:border-gray-700 sm:rounded-t-2xl">
              <h2 id={headingId} className="text-base font-semibold text-gray-900 dark:text-white">
                {label}
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-[44px] min-w-[44px] rounded-lg text-sm font-medium text-blue-600 dark:text-blue-400"
              >
                Done
              </button>
            </div>

            <div className="space-y-5 p-4 sm:p-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={handleDateChange}
                  className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Time
                </label>
                <input
                  type="time"
                  value={time}
                  onChange={handleTimeChange}
                  className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <button
                type="button"
                onClick={useNow}
                className="min-h-[48px] w-full rounded-xl bg-blue-600 py-3 text-base font-semibold text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
              >
                Use current date &amp; time
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return (
    <div className="relative">
      <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-left text-base text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-white"
      >
        {display}
      </button>
      {typeof document !== 'undefined' && createPortal(sheet, document.body)}
    </div>
  )
}
