import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  toLocalDateInputValue,
  toLocalTimeInputValue,
  fromLocalDateAndTime,
} from '../utils/date'
import Button from './Button'

interface TimePickerProps {
  value: Date
  onChange: (date: Date) => void
  label: string
}

export default function TimePicker({ value, onChange, label }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [date, setDate] = useState(() => toLocalDateInputValue(value))
  const [time, setTime] = useState(() => toLocalTimeInputValue(value))
  const headingId = useRef(`time-picker-${Math.random().toString(36).slice(2, 9)}`).current

  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
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
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm sm:bg-black/40"
            onClick={() => setIsOpen(false)}
          />
          {/* Flex center wrapper — avoid translate + framer y (they fight and break centering) */}
          <div className="fixed inset-0 z-[61] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby={headingId}
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="
                pointer-events-auto box-border flex w-full max-w-md
                max-h-[min(85dvh,560px)] flex-col overflow-hidden
                rounded-2xl border border-gray-200 bg-white shadow-2xl
                dark:border-gray-700 dark:bg-gray-800
              "
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 pt-4 pb-2">
                <h2
                  id={headingId}
                  className="text-base font-semibold text-gray-900 dark:text-white sm:text-lg"
                >
                  {label}
                </h2>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="
                    -mr-2 inline-flex min-h-[36px] items-center rounded-lg px-2.5
                    text-sm font-semibold text-blue-600 hover:bg-blue-50
                    active:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/30
                    dark:active:bg-blue-900/50 transition-colors
                  "
                >
                  Done
                </button>
              </div>

              {/* Body (scrolls if cramped) */}
              <div className="box-border flex-1 overflow-y-auto px-5 pb-5 pt-1">
                <div className="space-y-3">
                  <div className="min-w-0">
                    <label className="mb-1.5 block text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={handleDateChange}
                      className="
                        time-picker-input box-border block h-11 w-full min-w-0 max-w-full
                        appearance-none rounded-lg border border-gray-300 bg-gray-50 px-3
                        text-center text-base leading-none text-gray-900
                        focus:border-blue-500 focus:bg-white focus:outline-none
                        focus:ring-2 focus:ring-blue-500/40
                        dark:border-gray-600 dark:bg-gray-700/60 dark:text-white
                        dark:focus:bg-gray-700
                      "
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1.5 block text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Time
                    </label>
                    <input
                      type="time"
                      value={time}
                      onChange={handleTimeChange}
                      className="
                        time-picker-input box-border block h-11 w-full min-w-0 max-w-full
                        appearance-none rounded-lg border border-gray-300 bg-gray-50 px-3
                        text-center text-base leading-none text-gray-900
                        focus:border-blue-500 focus:bg-white focus:outline-none
                        focus:ring-2 focus:ring-blue-500/40
                        dark:border-gray-600 dark:bg-gray-700/60 dark:text-white
                        dark:focus:bg-gray-700
                      "
                    />
                  </div>

                  <Button
                    variant="primary"
                    size="md"
                    fullWidth
                    onClick={useNow}
                    className="mt-1"
                  >
                    Use current date &amp; time
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )

  return (
    <div className="relative">
      {label && (
        <span className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
      )}
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        className="
          flex min-h-[40px] w-full items-center justify-between rounded-lg border
          border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900
          transition-colors hover:border-gray-400 focus:outline-none
          focus-visible:ring-2 focus-visible:ring-blue-500
          dark:border-gray-600 dark:bg-gray-700 dark:text-white
          dark:hover:border-gray-500
        "
      >
        <span className="truncate">{display}</span>
        <svg
          aria-hidden="true"
          className="ml-2 h-4 w-4 flex-shrink-0 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
      {typeof document !== 'undefined' && createPortal(sheet, document.body)}
    </div>
  )
}
