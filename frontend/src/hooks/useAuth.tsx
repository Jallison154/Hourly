import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { authAPI, userAPI } from '../services/api'
import type { User } from '../types'

interface AuthContextType {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string, hourlyRate?: number) => Promise<void>
  logout: () => void
  updateUser: (updates: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (token) {
      userAPI.getProfile()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('token')
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const data = await authAPI.login(email, password)
    setUser(data.user)
  }

  const register = async (email: string, password: string, name: string, hourlyRate?: number) => {
    const data = await authAPI.register(email, password, name, hourlyRate)
    setUser(data.user)
  }

  const logout = () => {
    authAPI.logout()
    setUser(null)
  }

  const updateUser = async (updates: Partial<User>) => {
    const updated = await userAPI.updateProfile(updates)
    setUser(updated)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}


