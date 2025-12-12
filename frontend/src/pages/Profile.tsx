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
    payPeriodEndDay: user?.payPeriodEndDay || 10
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
        payPeriodEndDay: user.payPeriodEndDay || 10
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

