import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { useEffect, useState } from 'react'
import { api } from './api'
import { CompareProvider } from './context/CompareContext'
import Layout from './components/Layout'
import SetupPage from './pages/SetupPage'
import LoginPage from './pages/LoginPage'
import HomePage from './pages/HomePage'
import ProductsPage from './pages/ProductsPage'
import ComparePage from './pages/ComparePage'
import ImportPage from './pages/ImportPage'
import StoresPage from './pages/StoresPage'
import SettingsPage from './pages/SettingsPage'

function PrivateRoute({ children }) {
  const { user, ready } = useAuth()
  if (!ready) return null
  if (!user) return <Navigate to="/login" replace />
  return <CompareProvider><Layout>{children}</Layout></CompareProvider>
}

function PublicRoute({ children }) {
  const { user, ready } = useAuth()
  if (!ready) return null
  if (user) return <Navigate to="/products" replace />
  return children
}

function SetupGuard({ children }) {
  const [setupNeeded, setSetupNeeded] = useState(null)

  useEffect(() => {
    api.setupStatus().then(s => setSetupNeeded(s.needed)).catch(() => setSetupNeeded(false))
  }, [])

  if (setupNeeded === null) return null
  if (setupNeeded) return <Navigate to="/setup" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/setup"    element={<SetupPage />} />
      <Route path="/login"    element={<SetupGuard><PublicRoute><LoginPage /></PublicRoute></SetupGuard>} />
      <Route path="/"         element={<PrivateRoute><HomePage /></PrivateRoute>} />
      <Route path="/products" element={<PrivateRoute><ProductsPage /></PrivateRoute>} />
      <Route path="/compare"  element={<PrivateRoute><ComparePage /></PrivateRoute>} />
      <Route path="/import"   element={<PrivateRoute><ImportPage /></PrivateRoute>} />
      <Route path="/stores"   element={<PrivateRoute><StoresPage /></PrivateRoute>} />
      <Route path="/settings" element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
      <Route path="*"         element={<Navigate to="/" replace />} />
    </Routes>
  )
}
