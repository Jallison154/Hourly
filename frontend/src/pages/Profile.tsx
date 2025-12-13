import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../hooks/useAuth'
import { useDialog } from '../hooks/useDialog'
import Dialog from '../components/Dialog'

export default function Profile() {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()
  const { dialog, showAlert, showConfirm, closeDialog } = useDialog()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: user?.name || '',
    hourlyRate: user?.hourlyRate || 0,
    overtimeRate: user?.overtimeRate || 1.5,
    timeRoundingInterval: user?.timeRoundingInterval || 5,
    profileImage: user?.profileImage || '',
    payPeriodType: (user?.payPeriodType || 'monthly') as 'weekly' | 'monthly',
    payPeriodEndDay: user?.payPeriodEndDay || 10,
    paycheckAdjustment: user?.paycheckAdjustment || 0,
    state: user?.state || '',
    stateTaxRate: user?.stateTaxRate || null
  })
  const [imagePreview, setImagePreview] = useState<string | null>(user?.profileImage || null)

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        hourlyRate: user.hourlyRate || 0,
        overtimeRate: user.overtimeRate || 1.5,
        timeRoundingInterval: user.timeRoundingInterval || 5,
        profileImage: user.profileImage || '',
        payPeriodType: (user.payPeriodType || 'monthly') as 'weekly' | 'monthly',
        payPeriodEndDay: user.payPeriodEndDay || 10,
        paycheckAdjustment: user.paycheckAdjustment || 0,
        state: user.state || '',
        stateTaxRate: user.stateTaxRate || null
      })
      setImagePreview(user.profileImage || null)
    }
  }, [user])

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // For now, we'll just store the file name or URL
      // In a real app, you'd upload to a storage service
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        setImagePreview(result)
        setFormData({ ...formData, profileImage: result })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await updateUser(formData)
      await showAlert('Success', 'Profile updated successfully!')
    } catch (error: any) {
      await showAlert('Error', error.response?.data?.error || 'Failed to update profile')
    } finally {
      setLoading(false)
    }
  }

  const roundingOptions = [5, 10, 15, 30]

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-20 sm:pb-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Profile Settings
          </h1>
          <Link
            to="/import"
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
          >
            Import Data
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Image */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Profile Image
            </h2>
            <div className="flex items-center gap-6">
              <div className="flex-shrink-0">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 border-gray-200 dark:border-gray-700"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 text-2xl">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Upload Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="block w-full text-sm text-gray-500 dark:text-gray-400
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-lg file:border-0
                    file:text-sm file:font-semibold
                    file:bg-blue-50 file:text-blue-700
                    hover:file:bg-blue-100
                    dark:file:bg-gray-700 dark:file:text-gray-300"
                />
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  JPG, PNG or GIF. Max size 5MB.
                </p>
              </div>
            </div>
          </div>

          {/* Personal Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Personal Information
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={user?.email || ''}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Email cannot be changed
                </p>
              </div>
            </div>
          </div>

          {/* Pay Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Pay Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Hourly Rate ($/hr)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hourlyRate}
                  onChange={(e) => setFormData({ ...formData, hourlyRate: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Overtime Rate (multiplier)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="1"
                  value={formData.overtimeRate}
                  onChange={(e) => setFormData({ ...formData, overtimeRate: parseFloat(e.target.value) || 1.5 })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Default: 1.5x (time and a half)
                </p>
              </div>
            </div>
          </div>

          {/* Time Rounding */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Time Rounding
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rounding Interval (minutes)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {roundingOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setFormData({ ...formData, timeRoundingInterval: option })}
                    className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                      formData.timeRoundingInterval === option
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {option} min
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                Times will be rounded up to the next interval (e.g., 5 min rounds 8:03 → 8:05)
              </p>
            </div>
          </div>

          {/* Pay Period Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Pay Period Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pay Period Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, payPeriodType: 'weekly' })}
                    className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                      formData.payPeriodType === 'weekly'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Weekly
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, payPeriodType: 'monthly' })}
                    className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                      formData.payPeriodType === 'monthly'
                        ? 'border-blue-600 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                    }`}
                  >
                    Monthly
                  </button>
                </div>
              </div>
              {formData.payPeriodType === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pay Period End Day (day of month)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.payPeriodEndDay}
                    onChange={(e) => setFormData({ ...formData, payPeriodEndDay: parseInt(e.target.value) || 10 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Pay period runs from (end day + 1) to end day of next month (e.g., end day 10 = 11th to 10th)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Paycheck Adjustment */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Paycheck Adjustment
            </h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Adjustment Amount ($)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.paycheckAdjustment}
                onChange={(e) => setFormData({ ...formData, paycheckAdjustment: parseFloat(e.target.value) || 0 })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                This amount will be added to your gross and net pay calculations. Use negative values to subtract.
              </p>
            </div>
          </div>

          {/* Tax Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Tax Settings
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  State (2-letter code)
                </label>
                <input
                  type="text"
                  maxLength={2}
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                  placeholder="MT"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter your state code (e.g., MT, CA, TX). Used for state tax calculations.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  State Tax Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.stateTaxRate !== null && formData.stateTaxRate !== undefined ? (formData.stateTaxRate * 100) : ''}
                  onChange={(e) => setFormData({ ...formData, stateTaxRate: e.target.value ? parseFloat(e.target.value) / 100 : null })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="5.9"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter your state tax rate as a percentage (e.g., 5.9 for 5.9%). Leave empty to use default rate for your state.
                </p>
              </div>
            </div>
            
            {/* Tax Calculation Display */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Current Tax Calculations
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Federal Tax:</span>
                  <span className="text-gray-900 dark:text-white font-medium">Progressive brackets (2024)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">State Tax:</span>
                  <span className="text-gray-900 dark:text-white font-medium">
                    {formData.stateTaxRate !== null && formData.stateTaxRate !== undefined
                      ? `${(formData.stateTaxRate * 100).toFixed(2)}%`
                      : formData.state
                        ? `Default for ${formData.state} (varies by state)`
                        : 'Montana default: 5.9%'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">FICA (Social Security):</span>
                  <span className="text-gray-900 dark:text-white font-medium">6.2% (up to $168,600/year)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Medicare:</span>
                  <span className="text-gray-900 dark:text-white font-medium">1.45% (no cap)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Additional Medicare:</span>
                  <span className="text-gray-900 dark:text-white font-medium">0.9% (over $200,000/year)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button and Logout */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
            <motion.button
              type="button"
              onClick={async () => {
                const confirmed = await showConfirm('Logout', 'Are you sure you want to logout?', 'Logout', 'Cancel')
                if (confirmed) {
                  logout()
                  navigate('/login')
                }
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-6 py-3 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
            >
              Logout
            </motion.button>
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold rounded-lg shadow-lg transition-colors"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </motion.button>
          </div>
        </form>

        {/* Danger Zone - Outside form to prevent submission */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">
            Danger Zone
          </h3>
          <div className="space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-900 dark:text-red-200 mb-2">
                Delete All Time Entries
              </h4>
              <p className="text-xs text-red-700 dark:text-red-300 mb-3">
                This will permanently delete all your time entries. This action cannot be undone. 
                Use this if you want to re-import your data from CSV.
              </p>
              <motion.button
                type="button"
                onClick={async (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  const confirmed = await showConfirm(
                    'Delete All Time Entries',
                    'Are you sure you want to delete ALL time entries? This action cannot be undone. You can re-import your data after deletion.',
                    'Delete All',
                    'Cancel'
                  )
                  if (confirmed) {
                    try {
                      const { timeEntriesAPI } = await import('../services/api')
                      const result = await timeEntriesAPI.deleteAllEntries()
                      await showAlert('Success', `Successfully deleted ${result.deletedCount} time entries. You can now re-import your data.`)
                    } catch (error: any) {
                      await showAlert('Error', error.response?.data?.error || 'Failed to delete time entries')
                    }
                  }
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete All Time Entries
              </motion.button>
            </div>
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
  )
}

