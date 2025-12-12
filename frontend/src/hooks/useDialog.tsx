import { useState, useCallback } from 'react'

interface DialogState {
  open: boolean
  title: string
  message: string
  type: 'alert' | 'confirm' | 'info'
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  onCancel?: () => void
}

export function useDialog() {
  const [dialog, setDialog] = useState<DialogState>({
    open: false,
    title: '',
    message: '',
    type: 'alert'
  })

  const showAlert = useCallback((title: string, message: string) => {
    return new Promise<void>((resolve) => {
      setDialog({
        open: true,
        title,
        message,
        type: 'alert',
        confirmText: 'OK',
        onConfirm: () => resolve(),
        onCancel: () => resolve()
      })
    })
  }, [])

  const showConfirm = useCallback((title: string, message: string, confirmText = 'Confirm', cancelText = 'Cancel') => {
    return new Promise<boolean>((resolve) => {
      setDialog({
        open: true,
        title,
        message,
        type: 'confirm',
        confirmText,
        cancelText,
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false)
      })
    })
  }, [])

  const showInfo = useCallback((title: string, message: string) => {
    return new Promise<void>((resolve) => {
      setDialog({
        open: true,
        title,
        message,
        type: 'info',
        confirmText: 'OK',
        onConfirm: () => resolve(),
        onCancel: () => resolve()
      })
    })
  }, [])

  const closeDialog = useCallback(() => {
    setDialog((prev) => ({ ...prev, open: false }))
  }, [])

  return {
    dialog,
    showAlert,
    showConfirm,
    showInfo,
    closeDialog
  }
}

