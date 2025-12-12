import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon } from '@heroicons/react/24/outline'

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
  onCancel
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

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm()
    }
    onClose()
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
    onClose()
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      if (type === 'alert' || type === 'info') {
        onClose()
      }
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50"
            onClick={handleBackdropClick}
          />
          
          {/* Dialog */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative"
            >
              {/* Close button (only for alert/info, not confirm) */}
              {(type === 'alert' || type === 'info') && (
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              )}

              {/* Title */}
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 pr-8">
                {title}
              </h3>

              {/* Message */}
              <p className="text-gray-600 dark:text-gray-400 mb-6 whitespace-pre-line">
                {message}
              </p>

              {/* Actions */}
              <div className={`flex ${type === 'confirm' ? 'justify-end space-x-3' : 'justify-end'}`}>
                {type === 'confirm' && (
                  <motion.button
                    onClick={handleCancel}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors"
                  >
                    {cancelText}
                  </motion.button>
                )}
                <motion.button
                  onClick={type === 'confirm' ? handleConfirm : onClose}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    type === 'confirm'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : type === 'alert' || type === 'info'
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  {confirmText}
                </motion.button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}

