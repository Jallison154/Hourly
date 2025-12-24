import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { importAPI, timeEntriesAPI } from '../services/api'
import Dialog from '../components/Dialog'
import PullToRefresh from '../components/PullToRefresh'
import { useDialog } from '../hooks/useDialog'

export default function Import() {
  const [file, setFile] = useState<File | null>(null)
  const [csvContent, setCsvContent] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    imported: number
    skipped: number
    total: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [clearStartDate, setClearStartDate] = useState('')
  const [clearEndDate, setClearEndDate] = useState('')
  const [clearing, setClearing] = useState(false)
  const [clearResult, setClearResult] = useState<{ deletedCount: number } | null>(null)
  const { dialog, showConfirm, closeDialog } = useDialog()

  // Set default dates to last year
  useEffect(() => {
    const today = new Date()
    const oneYearAgo = new Date(today)
    oneYearAgo.setFullYear(today.getFullYear() - 1)
    
    setStartDate(oneYearAgo.toISOString().split('T')[0])
    setEndDate(today.toISOString().split('T')[0])
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
      setResult(null)
      
      const reader = new FileReader()
      reader.onload = (event) => {
        const content = event.target?.result as string
        setCsvContent(content)
      }
      reader.readAsText(selectedFile)
    }
  }

  const handleImport = async () => {
    if (!csvContent) {
      setError('Please select a file first')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await importAPI.importHoursKeeper({
        csvContent,
        startDate: startDate || undefined,
        endDate: endDate || undefined
      })
      
      setResult(data)
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to import data')
    } finally {
      setLoading(false)
    }
  }

  const handleClearData = async () => {
    if (!clearStartDate || !clearEndDate) {
      setError('Please select both start and end dates for clearing data')
      return
    }

    const confirmed = await showConfirm(
      'Clear Imported Data',
      `Are you sure you want to delete ALL time entries between ${clearStartDate} and ${clearEndDate}? This action cannot be undone.`,
      'Delete',
      'Cancel'
    )

    if (!confirmed) return

    setClearing(true)
    setError(null)
    setClearResult(null)

    try {
      const data = await timeEntriesAPI.deleteBulk(clearStartDate, clearEndDate)
      setClearResult(data)
      // Clear the date fields after successful deletion
      setClearStartDate('')
      setClearEndDate('')
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } }
      setError(axiosError.response?.data?.error || 'Failed to clear data')
    } finally {
      setClearing(false)
    }
  }

  const handleRefresh = async () => {
    // Clear any results/errors on refresh
    setResult(null)
    setError(null)
    setClearResult(null)
  }

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:pb-8" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Import from Hours Keeper
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Upload Export File
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Select CSV File from Hours Keeper
              </label>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileSelect}
                className="block w-full text-sm text-gray-500 dark:text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100
                  dark:file:bg-gray-700 dark:file:text-gray-300"
              />
              {file && (
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Selected: {file.name}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Date (optional)
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Date (optional)
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="text-sm text-blue-800 dark:text-blue-300">
                <p className="mb-2">
                  <strong>Note:</strong> The import will:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Parse your Hours Keeper export file</li>
                  <li>Create time entries for each record</li>
                  <li>Skip entries that already exist (based on date)</li>
                  <li>Apply your time rounding settings</li>
                  <li>Filter by date range if provided (defaults to last year)</li>
                </ul>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
              </div>
            )}

            {result && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-800 dark:text-green-300 font-semibold mb-2">
                  Import Complete!
                </p>
                <ul className="text-sm text-green-700 dark:text-green-400 space-y-1">
                  <li>✓ Imported: {result.imported} entries</li>
                  <li>⊘ Skipped (duplicates): {result.skipped} entries</li>
                  <li>Total processed: {result.total} entries</li>
                </ul>
              </div>
            )}

            <motion.button
              onClick={handleImport}
              disabled={loading || !file}
              whileHover={{ scale: loading || !file ? 1 : 1.02 }}
              whileTap={{ scale: loading || !file ? 1 : 0.98 }}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-lg transition-colors"
            >
              {loading ? 'Importing...' : 'Import Data'}
            </motion.button>
          </div>
        </div>

        {/* Clear Imported Data Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Clear Imported Data
          </h2>
          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                <strong>Warning:</strong> This will permanently delete all time entries within the selected date range. This action cannot be undone.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={clearStartDate}
                  onChange={(e) => setClearStartDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={clearEndDate}
                  onChange={(e) => setClearEndDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>

            {clearResult && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <p className="text-sm text-green-800 dark:text-green-300 font-semibold">
                  Successfully deleted {clearResult.deletedCount} time entries
                </p>
              </div>
            )}

            <motion.button
              onClick={handleClearData}
              disabled={clearing || !clearStartDate || !clearEndDate}
              whileHover={{ scale: clearing || !clearStartDate || !clearEndDate ? 1 : 1.02 }}
              whileTap={{ scale: clearing || !clearStartDate || !clearEndDate ? 1 : 0.98 }}
              className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-lg transition-colors"
            >
              {clearing ? 'Deleting...' : 'Clear Data'}
            </motion.button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Supported Formats
          </h2>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>The import supports CSV files from Hours Keeper with columns such as:</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Date, Start Time, End Time, Duration, Notes</li>
              <li>Date, Clock In, Clock Out, Hours, Minutes</li>
              <li>Date, Duration (as "8:30"), Notes</li>
              <li>Any combination of date, time, and duration fields</li>
            </ul>
            <p className="mt-4">
              The importer will automatically detect and parse the available fields.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Dialog */}
      <Dialog
        open={dialog.open}
        onClose={closeDialog}
        title={dialog.title}
        message={dialog.message}
        type={dialog.type}
        confirmText={dialog.confirmText}
        cancelText={dialog.cancelText}
        onConfirm={dialog.onConfirm}
        onCancel={dialog.onCancel}
      />
      </div>
    </PullToRefresh>
  )
}

