import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon } from '@heroicons/react/24/outline'
import Button from './Button'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  message: string
  type?: 'alert' | 'confirm' | 'info'
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  onCancel?: () => void
}

export default function Dialog({
  open,
  onClose,
  title,
  message,
  type = 'alert',
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: DialogProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && (type === 'alert' || type === 'info')) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, type, onClose])

  const handleConfirm = () => {
    if (onConfirm) onConfirm()
    onClose()
  }

  const handleCancel = () => {
    if (onCancel) onCancel()
    onClose()
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (type === 'alert' || type === 'info') onClose()
    }
  }

  // Danger phrasing for confirm dialogs whose primary action is destructive
  const destructive = /delete|remove|cancel/i.test(confirmText)
  const confirmVariant = type === 'confirm' && destructive ? 'danger' : 'primary'

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            onClick={handleBackdropClick}
          />

          <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onClick={handleBackdropClick}
          >
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="
                relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl
                dark:bg-gray-800
              "
              onClick={(e) => e.stopPropagation()}
            >
              {(type === 'alert' || type === 'info') && (
                <button
                  type="button"
                  aria-label="Close"
                  onClick={onClose}
                  className="absolute right-3 top-3 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700 dark:hover:text-gray-300 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}

              <h3 className="text-xl font-bold text-gray-900 dark:text-white pr-8">
                {title}
              </h3>

              <p className="mt-3 text-gray-600 dark:text-gray-300 whitespace-pre-line">
                {message}
              </p>

              <div
                className={`mt-6 flex gap-3 ${
                  type === 'confirm' ? 'flex-col-reverse sm:flex-row sm:justify-end' : 'justify-end'
                }`}
              >
                {type === 'confirm' && (
                  <Button
                    variant="secondary"
                    size="md"
                    onClick={handleCancel}
                    fullWidth
                    className="sm:!w-auto"
                  >
                    {cancelText}
                  </Button>
                )}
                <Button
                  variant={confirmVariant}
                  size="md"
                  onClick={type === 'confirm' ? handleConfirm : onClose}
                  fullWidth
                  className="sm:!w-auto"
                >
                  {confirmText}
                </Button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
