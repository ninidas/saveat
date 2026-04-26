import { createContext, useContext, useState, useEffect } from 'react'
import { api, clearCache } from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user')
    return stored ? JSON.parse(stored) : null
  })
  const [ready, setReady] = useState(false)
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('darkMode')
    if (stored !== null) return stored === 'true'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
    localStorage.setItem('darkMode', String(darkMode))
  }, [darkMode])

  useEffect(() => {
    setReady(true)
  }, [])

  function login(tokenData) {
    const userData = {
      token:    tokenData.access_token,
      userId:   tokenData.user_id,
      username: tokenData.username,
    }
    localStorage.setItem('token', tokenData.access_token)
    localStorage.setItem('user', JSON.stringify(userData))
    setUser(userData)
  }

  function logout() {
    clearCache()
    localStorage.clear()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, ready, login, logout, darkMode, toggleDarkMode: () => setDarkMode(d => !d) }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
