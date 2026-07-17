import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ClockInOut from './pages/ClockInOut'
import Timesheet from './pages/Timesheet'
import Profile from './pages/Profile'
import Schedule from './pages/Schedule'
import Import from './pages/Import'
import PaycheckCalculator from './pages/PaycheckCalculator'
import Login from './pages/Login'
import Register from './pages/Register'
import Admin from './pages/Admin'
import { AuthProvider, useAuth } from './hooks/useAuth'
import Navigation from './components/Navigation'
import MobileBottomNav from './components/MobileBottomNav'
import OfflineBanner from './components/OfflineBanner'
import UpdateToast from './components/UpdateToast'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-okami-bg">
        <div className="flex items-center justify-center min-h-screen text-okami-muted">
          Loading…
        </div>
      </div>
    )
  }

  return user ? (
    <div className="min-h-screen bg-okami-bg overflow-x-hidden">
      <OfflineBanner />
      <Navigation />
      {children}
      <MobileBottomNav />
      <UpdateToast />
    </div>
  ) : (
    <Navigate to="/login" replace />
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
      <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
      <Route path="/paycheck" element={<ProtectedRoute><PaycheckCalculator /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/import" element={<ProtectedRoute><Import /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
      <Route path="/team" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
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
