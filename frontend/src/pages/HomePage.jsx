import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useCompare } from '../context/CompareContext'

function formatDate(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

function round2(n) { return Math.round(n * 100) / 100 }

function computeComparison(selection) {
  // Extraire les enseignes qui ont au moins un prix parmi les produits sélectionnés
  const storeMap = {}
  for (const { product } of selection) {
    for (const p of product.prices || []) {
      if (!storeMap[p.store_id])
        storeMap[p.store_id] = { id: p.store_id, name: p.store_name, color: p.store_color }
    }
  }
  const stores = Object.values(storeMap)

  return stores.map(store => {
    let total = 0, missing = 0
    for (const { product, qty } of selection) {
      const p = product.prices?.find(pr => pr.store_id === store.id)
      if (p) total += p.price * qty
      else missing++
    }
    return { store, total: round2(total), missing }
  }).sort((a, b) => {
    if (a.missing !== b.missing) return a.missing - b.missing
    return a.total - b.total
  })
}

export default function HomePage() {
  const [stats, setStats]   = useState(null)
  const [loading, setLoading] = useState(true)
  const { selection } = useCompare()
  const navigate      = useNavigate()
  const comparison    = useMemo(() => selection.length ? computeComparison(selection) : [], [selection])

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page-enter">
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <span className="text-2xl">🛒</span>
        <h1 className="font-bold text-slate-900 dark:text-white text-lg">Saveat</h1>
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

          {/* Comparaison en cours */}
          {comparison.length > 0 && (
            <div
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden cursor-pointer hover:border-emerald-400 transition"
              onClick={() => navigate('/compare')}
            >
              <div className="px-4 pt-3 pb-1 flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  Meilleure enseigne · {selection.length} produit{selection.length > 1 ? 's' : ''}
                </p>
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-slate-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </div>
              {comparison.map((row, i) => (
                <div
                  key={row.store.id}
                  className={`flex items-center gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800 ${
                    i === 0 && row.missing < selection.length ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                  }`}
                >
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: row.store.color }} />
                  <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300">{row.store.name}</span>
                  {row.missing > 0 && (
                    <span className="text-xs text-amber-500">{row.missing} manquant{row.missing > 1 ? 's' : ''}</span>
                  )}
                  <span className={`font-bold text-sm ${
                    i === 0 && row.missing < selection.length
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}>
                    {row.total.toFixed(2)} €
                  </span>
                  {i === 0 && row.missing < selection.length && <span>🏆</span>}
                </div>
              ))}
              {comparison.length > 1 && comparison[0].missing < selection.length && comparison[1].missing < selection.length && (
                <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/10 border-t border-emerald-100 dark:border-emerald-900/30">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">
                    💰 Économie vs 2e : <strong>{(comparison[1].total - comparison[0].total).toFixed(2)} €</strong>
                  </p>
                </div>
              )}
            </div>
          )}

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
    </div>
  )
}
