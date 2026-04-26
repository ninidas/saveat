import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../context/AuthContext'

export default function SetupPage() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [form, setForm]     = useState({ username: '', password: '', confirm: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.setupStatus().then(s => { if (!s.needed) navigate('/login', { replace: true }) }).catch(() => {})
  }, [navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Les mots de passe ne correspondent pas'); return }
    if (form.password.length < 8) { setError('Mot de passe trop court (8 caractères min.)'); return }
    setLoading(true)
    try {
      await api.setup({ username: form.username.trim(), password: form.password })
      const token = await api.login(form.username.trim(), form.password)
      login(token)
      navigate('/products', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🛒</div>
          <h1 className="text-3xl font-bold text-white">Saveat</h1>
          <p className="text-emerald-100 mt-1">Comparez les prix, économisez sur vos courses</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-6">
          <h2 className="text-lg font-semibold text-slate-800 mb-1">Créer votre compte</h2>
          <p className="text-sm text-slate-500 mb-5">Premier démarrage — configurez votre accès.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nom d'utilisateur</label>
              <input
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="admin"
                autoFocus
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Mot de passe</label>
              <input
                type="password"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="8 caractères minimum"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirmer le mot de passe</label>
              <input
                type="password"
                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={form.confirm}
                onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                required
              />
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-50"
            >
              {loading ? 'Création…' : 'Créer mon compte'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
