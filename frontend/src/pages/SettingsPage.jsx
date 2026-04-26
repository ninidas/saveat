import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function SettingsPage() {
  const { user, logout, darkMode, toggleDarkMode } = useAuth()
  const [settings, setSettings] = useState(null)
  const [apiKey, setApiKey]     = useState('')
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [error, setError]       = useState('')
  const navigate                = useNavigate()

  useEffect(() => {
    api.getSettings().then(s => setSettings(s)).catch(e => console.error(e))
  }, [])

  async function saveApiKey(e) {
    e.preventDefault()
    setSaving(true); setError(''); setSaved(false)
    try {
      const updated = await api.updateSettings({ claude_api_key: apiKey })
      setSettings(updated); setApiKey(''); setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  async function removeApiKey() {
    setSaving(true)
    try {
      const updated = await api.updateSettings({ claude_api_key: '' })
      setSettings(updated)
    } catch (err) { setError(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="page-enter">
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <h1 className="font-bold text-slate-900 dark:text-white text-lg">Réglages</h1>
      </div>

      <div className="px-4 py-4 space-y-4">

        {/* User info */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Compte</p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-bold text-lg">
              {user?.username?.[0]?.toUpperCase()}
            </div>
            <p className="font-medium text-slate-900 dark:text-white">{user?.username}</p>
          </div>
        </div>

        {/* Dark mode */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900 dark:text-white text-sm">Mode sombre</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Thème de l'interface</p>
            </div>
            <button
              onClick={toggleDarkMode}
              className={`relative w-12 h-6 rounded-full transition-colors ${darkMode ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${darkMode ? 'translate-x-6' : ''}`} />
            </button>
          </div>
        </div>

        {/* Enseignes */}
        <button
          onClick={() => navigate('/stores')}
          className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-emerald-400 transition flex items-center gap-3"
        >
          <div className="w-9 h-9 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-slate-500 dark:text-slate-400">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="font-medium text-slate-900 dark:text-white text-sm">Enseignes</p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Gérer vos supermarchés</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>

        {/* Claude API */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Claude API (optionnel)</p>
          <p className="text-xs text-slate-400 dark:text-slate-500 mb-3">
            Activez la reconnaissance automatique des tickets de caisse via l'IA Claude d'Anthropic.
          </p>

          {settings?.claude_api_key_set ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl px-3 py-2">
                <span className="text-emerald-500">✓</span>
                <span className="text-sm text-emerald-700 dark:text-emerald-300">Clé API configurée</span>
              </div>
              <button onClick={removeApiKey} disabled={saving} className="text-xs text-red-500 hover:text-red-700 transition">
                Supprimer
              </button>
            </div>
          ) : (
            <form onSubmit={saveApiKey} className="flex gap-2">
              <input
                type="password"
                className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="sk-ant-api03-…"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={saving || !apiKey}
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-3 py-2 text-sm font-medium transition disabled:opacity-50"
              >
                {saved ? '✓' : saving ? '…' : 'Sauvegarder'}
              </button>
            </form>
          )}

          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3.5 text-sm font-medium text-red-500 hover:text-red-700 hover:border-red-200 transition flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
          </svg>
          Déconnexion
        </button>

      </div>
    </div>
  )
}
