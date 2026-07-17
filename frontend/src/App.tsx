import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import ClockInOut from './pages/ClockInOut'
import Timesheet from './pages/Timesheet'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Schedule from './pages/Schedule'
import Import from './pages/Import'
import PaycheckCalculator from './pages/PaycheckCalculator'
import Login from './pages/Login'
import Register from './pages/Register'
import Admin from './pages/Admin'
import { AuthProvider, useAuth } from './hooks/useAuth'
import TopBrandBar from './components/TopBrandBar'
import AppBottomNav from './components/AppBottomNav'
import OfflineBanner from './components/OfflineBanner'
import UpdateToast from './components/UpdateToast'
import type { UserRole } from './types'

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-okami-bg">
      <div className="flex min-h-screen items-center justify-center text-okami-muted">
        Loading…
      </div>
    </div>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />

  return user ? (
    <div className="min-h-screen overflow-x-hidden bg-okami-bg">
      <OfflineBanner />
      <TopBrandBar />
      {children}
      <AppBottomNav />
      <UpdateToast />
    </div>
  ) : (
    <Navigate to="/login" replace />
  )
}

function RoleRoute({
  roles,
  children,
}: {
  roles: UserRole[]
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (!user.role || !roles.includes(user.role)) {
    return <Navigate to="/home" replace />
  }

  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Clock remains the default landing page after login */}
      <Route path="/" element={<ProtectedRoute><ClockInOut /></ProtectedRoute>} />
      <Route path="/clock" element={<ProtectedRoute><ClockInOut /></ProtectedRoute>} />

      <Route path="/home" element={<ProtectedRoute><Home /></ProtectedRoute>} />
      {/* Preserve detailed metrics page; linked from Home */}
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

      <Route path="/timesheet" element={<ProtectedRoute><Timesheet /></ProtectedRoute>} />
      <Route path="/schedule" element={<ProtectedRoute><Schedule /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

      {/* Nested under Settings in the IA; routes preserved */}
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/paycheck" element={<ProtectedRoute><PaycheckCalculator /></ProtectedRoute>} />
      <Route path="/import" element={<ProtectedRoute><Import /></ProtectedRoute>} />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <RoleRoute roles={['ADMIN', 'MANAGER']}>
              <Admin />
            </RoleRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/team"
        element={
          <ProtectedRoute>
            <RoleRoute roles={['ADMIN', 'MANAGER']}>
              <Admin />
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
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
