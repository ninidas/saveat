import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'

const STORAGE_KEY = 'ranking_store_ids'

function formatDate(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

export default function HomePage() {
  const [stats, setStats]             = useState(null)
  const [loading, setLoading]         = useState(true)
  const [stores, setStores]           = useState([])
  const [selectedIds, setSelectedIds] = useState(null) // null = not yet loaded
  const [showPicker, setShowPicker]   = useState(false)
  const [showCompared, setShowCompared] = useState(false)
  const navigate                      = useNavigate()

  // Load stores + saved selection
  useEffect(() => {
    api.getStores().then(list => {
      setStores(list)
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          const parsed = JSON.parse(saved)
          // Keep only IDs that still exist
          const valid = parsed.filter(id => list.some(s => s.id === id))
          setSelectedIds(valid.length >= 2 ? valid : list.map(s => s.id))
        } catch {
          setSelectedIds(list.map(s => s.id))
        }
      } else {
        setSelectedIds(list.map(s => s.id))
      }
    }).catch(() => setSelectedIds([]))
  }, [])

  const fetchStats = useCallback((ids) => {
    setLoading(true)
    api.getStats(ids)
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (selectedIds !== null) fetchStats(selectedIds)
  }, [selectedIds, fetchStats])

  function toggleStore(id) {
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }

  return (
    <div className="page-enter">
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center">
        <img src="/logo.png" alt="Saveat" className="h-10 rounded-xl" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : stats && (
        <div className="px-4 py-4 space-y-4">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total_products}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Produits</p>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 text-center">
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.total_stores}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Enseignes</p>
            </div>
            <div className={`rounded-2xl border p-3 text-center ${
              stats.products_without_prices > 0
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
            }`}>
              <p className={`text-2xl font-bold ${
                stats.products_without_prices > 0
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-slate-900 dark:text-white'
              }`}>{stats.products_without_prices}</p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Sans prix</p>
            </div>
          </div>

          {/* Hausses de prix */}
          {stats.price_increases?.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-red-200 dark:border-red-900/50 overflow-hidden">
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs font-semibold text-red-500 dark:text-red-400 uppercase tracking-wide">
                  Hausses de prix récentes
                </p>
              </div>
              {stats.price_increases.slice(0, 5).map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-t border-red-50 dark:border-red-900/30">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.store_color }} />
                  <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">{r.product_name}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0 hidden sm:block">{r.store_name}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 line-through flex-shrink-0">{r.old_price.toFixed(2)} €</span>
                  <span className="font-semibold text-sm text-red-600 dark:text-red-400 flex-shrink-0">{r.new_price.toFixed(2)} €</span>
                  <span className="text-xs font-medium text-red-500 flex-shrink-0">
                    +{(r.new_price - r.old_price).toFixed(2)} €
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Classement des enseignes */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-4 pt-3 pb-1 flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                Meilleure enseigne
                {stats.store_ranking?.length > 0 && stats.compared_products?.length > 0 && (
                  <button
                    onClick={() => setShowCompared(true)}
                    className="ml-1 text-emerald-500 hover:text-emerald-600 dark:text-emerald-400 hover:underline normal-case font-normal"
                  >
                    · {stats.compared_products.length} produit{stats.compared_products.length > 1 ? 's' : ''} comparés
                  </button>
                )}
              </p>
              <button
                onClick={() => setShowPicker(p => !p)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                title="Choisir les enseignes"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              </button>
            </div>

            {/* Store picker */}
            {showPicker && stores.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                {stores.map(s => {
                  const active = selectedIds?.includes(s.id)
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggleStore(s.id)}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition ${
                        active
                          ? 'border-transparent text-white'
                          : 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 bg-transparent'
                      }`}
                      style={active ? { backgroundColor: s.color } : {}}
                    >
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </button>
                  )
                })}
              </div>
            )}

            {stats.store_ranking?.length > 0 ? (
              <>
                {stats.store_ranking.map((row, i) => (
                  <div
                    key={row.store_name}
                    className={`flex items-center gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 ${
                      i === 0 ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                    }`}
                  >
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: row.store_color }} />
                    <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">{row.store_name}</span>
                    {row.missing > 0 && (
                      <span className="text-xs text-amber-500">{row.missing} manquant{row.missing > 1 ? 's' : ''}</span>
                    )}
                    <span className={`font-bold text-sm ${
                      i === 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'
                    }`}>
                      {row.total.toFixed(2)} €
                    </span>
                    {i === 0 && <span>🏆</span>}
                  </div>
                ))}
                {stats.store_ranking.length > 1 && stats.store_ranking[1].missing === 0 && (
                  <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/10 border-t border-emerald-100 dark:border-emerald-900/30">
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">
                      💰 Économie vs 2e : <strong>{(stats.store_ranking[1].total - stats.store_ranking[0].total).toFixed(2)} €</strong>
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="px-4 py-4 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                  Sélectionne au moins 2 enseignes pour comparer
                </p>
              </div>
            )}
          </div>

          {/* Derniers prix */}
          {stats.recent_prices?.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="px-4 pt-3 pb-1">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Derniers prix enregistrés
                </p>
              </div>
              {stats.recent_prices.map((r, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.store_color }} />
                  <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">{r.product_name}</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0 hidden sm:block">{r.store_name}</span>
                  <span className="font-semibold text-sm text-slate-900 dark:text-white flex-shrink-0">{r.price.toFixed(2)} €</span>
                  <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0 w-14 text-right">{formatDate(r.recorded_at)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Produits sans prix */}
          {stats.products_without_prices > 0 && (
            <button
              onClick={() => navigate('/products')}
              className="w-full bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 rounded-2xl p-4 text-left hover:border-amber-400 transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300 text-sm">
                    {stats.products_without_prices} produit{stats.products_without_prices > 1 ? 's' : ''} sans prix
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    Compléter le catalogue
                  </p>
                </div>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-amber-500">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </button>
          )}

        </div>
      )}
      {/* Modal produits comparés */}
      {showCompared && stats?.compared_products?.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowCompared(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm max-h-[70vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800">
              <p className="font-semibold text-slate-800 dark:text-white text-sm">
                Produits comparés ({stats.compared_products.length})
              </p>
              <button onClick={() => setShowCompared(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <ul className="overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {stats.compared_products.map(p => (
                <li key={p.id} className="px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300">{p.name}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
