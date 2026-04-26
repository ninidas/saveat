import { useState, useEffect } from 'react'
import { api } from '../api'
import BottomSheet from '../components/BottomSheet'

const PRESET_COLORS = [
  '#003ca6', '#003189', '#0050aa', '#e63025', '#e30613',
  '#7b2d8b', '#f97316', '#10b981', '#6366f1', '#ec4899',
  '#64748b', '#14b8a6',
]

function StoreSheet({ store, onClose, onSaved, onDeleted }) {
  const isNew = !store
  const [form, setForm]     = useState({ name: store?.name || '', color: store?.color || '#10b981', sort_order: store?.sort_order || 0 })
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState('')

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const saved = isNew
        ? await api.createStore(form)
        : await api.updateStore(store.id, form)
      onSaved(saved)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <BottomSheet title={isNew ? 'Nouvelle enseigne' : 'Modifier l\'enseigne'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nom de l'enseigne</label>
          <input
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ex : Monoprix"
            autoFocus
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-2">Couleur</label>
          <div className="flex flex-wrap gap-2 mb-2">
            {PRESET_COLORS.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => setForm(f => ({ ...f, color: c }))}
                className={`w-8 h-8 rounded-full transition ${form.color === c ? 'ring-2 ring-offset-2 ring-emerald-500' : ''}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700 p-0.5"
              value={form.color}
              onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
            />
            <span className="text-sm text-slate-500 dark:text-slate-400 font-mono">{form.color}</span>
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-sm transition disabled:opacity-50"
        >
          {isNew ? 'Créer l\'enseigne' : 'Enregistrer'}
        </button>
      </form>

      {!isNew && (
        <button
          onClick={async () => {
            if (!window.confirm(`Supprimer « ${store.name} » ? Les prix associés seront supprimés.`)) return
            await api.deleteStore(store.id)
            onDeleted(store.id)
          }}
          className="mt-4 w-full text-sm text-red-500 hover:text-red-700 py-2 transition"
        >
          Supprimer l'enseigne
        </button>
      )}
    </BottomSheet>
  )
}

export default function StoresPage() {
  const [stores, setStores]   = useState([])
  const [loading, setLoading] = useState(true)
  const [sheet, setSheet]     = useState(null)

  useEffect(() => {
    api.getStores()
      .then(s => setStores(s))
      .catch(e => console.error(e))
      .finally(() => setLoading(false))
  }, [])

  function handleSaved(saved) {
    setStores(prev => {
      const idx = prev.findIndex(s => s.id === saved.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = saved; return n }
      return [...prev, saved].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    })
    setSheet(null)
  }

  return (
    <div className="page-enter">
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <h1 className="font-bold text-slate-900 dark:text-white text-lg flex-1">Enseignes</h1>
        <button
          onClick={() => setSheet('new')}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-3 py-2 text-sm font-medium flex items-center gap-1.5 transition"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Ajouter
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : stores.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="text-5xl mb-3">🏪</div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Aucune enseigne</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Ajoutez vos supermarchés habituels</p>
        </div>
      ) : (
        <div className="px-4 py-3 space-y-2">
          {stores.map(store => (
            <button
              key={store.id}
              onClick={() => setSheet(store)}
              className="w-full flex items-center gap-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3.5 text-left hover:border-emerald-400 transition"
            >
              <div
                className="w-10 h-10 rounded-xl flex-shrink-0"
                style={{ backgroundColor: store.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 dark:text-white">{store.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-mono mt-0.5">{store.color}</p>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400 flex-shrink-0">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ))}
        </div>
      )}

      {sheet === 'new' && (
        <StoreSheet
          store={null}
          onClose={() => setSheet(null)}
          onSaved={handleSaved}
          onDeleted={() => {}}
        />
      )}
      {sheet && sheet !== 'new' && (
        <StoreSheet
          store={sheet}
          onClose={() => setSheet(null)}
          onSaved={handleSaved}
          onDeleted={(id) => { setStores(prev => prev.filter(s => s.id !== id)); setSheet(null) }}
        />
      )}
    </div>
  )
}
