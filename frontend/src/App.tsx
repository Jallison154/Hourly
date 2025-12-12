import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ClockInOut from './pages/ClockInOut'
import Timesheet from './pages/Timesheet'
import PaycheckCalculator from './pages/PaycheckCalculator'
import Profile from './pages/Profile'
import Import from './pages/Import'
import Login from './pages/Login'
import Register from './pages/Register'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Navigation from './components/Navigation'
import MobileBottomNav from './components/MobileBottomNav'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-center min-h-screen">Loading...</div>
      </div>
    )
  }
  
  return user ? (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navigation />
      {children}
      <MobileBottomNav />
    </div>
  ) : (
    <Navigate to="/login" />
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<ProtectedRoute><ClockInOut /></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/clock" element={<ProtectedRoute><ClockInOut /></ProtectedRoute>} />
      <Route path="/timesheet" element={<ProtectedRoute><Timesheet /></ProtectedRoute>} />
      <Route path="/calculator" element={<ProtectedRoute><PaycheckCalculator /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/import" element={<ProtectedRoute><Import /></ProtectedRoute>} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  )
}

export default App
