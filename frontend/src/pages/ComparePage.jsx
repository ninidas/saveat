import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import { useCompare } from '../context/CompareContext'

// Comparison calc
function computeComparison(selection, stores) {
  if (!selection.length || !stores.length) return []

  return stores.map(store => {
    let total   = 0
    let missing = 0

    for (const { product, qty } of selection) {
      const p = product.prices?.find(pr => pr.store_id === store.id)
      if (p) {
        total += p.price * qty
      } else {
        missing++
      }
    }

    return { store, total: round2(total), missing }
  }).sort((a, b) => {
    if (a.missing !== b.missing) return a.missing - b.missing
    return a.total - b.total
  })
}

function round2(n) { return Math.round(n * 100) / 100 }

// Comparison panel
function ComparisonPanel({ selection, stores, onQtyChange, onRemove }) {
  const rows     = computeComparison(selection, stores)
  const cheapest = rows.find(r => r.missing < selection.length)

  if (!selection.length) {
    return (
      <div className="text-center py-10 px-4">
        <div className="text-4xl mb-2">🏪</div>
        <p className="text-sm text-slate-400 dark:text-slate-500">
          Sélectionnez des produits pour comparer les prix
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Store totals */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-4 pt-3 pb-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Total par enseigne
          </p>
        </div>
        {rows.map((row, i) => (
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
        {cheapest && rows.length > 1 && rows[1].missing < selection.length && (
          <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-900/10 border-t border-emerald-100 dark:border-emerald-900/30">
            <p className="text-xs text-emerald-700 dark:text-emerald-400">
              💰 Économie vs 2e : <strong>{(rows[1].total - cheapest.total).toFixed(2)} €</strong>
            </p>
          </div>
        )}
      </div>

      {/* Selected products */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="px-4 pt-3 pb-1">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            Sélection ({selection.length} produit{selection.length > 1 ? 's' : ''})
          </p>
        </div>
        {selection.map(({ product, qty }) => (
          <div key={product.id} className="flex items-center gap-3 px-4 py-3 border-t border-slate-100 dark:border-slate-800">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{product.name}</p>
              {product.best_price != null && (
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Meilleur prix : {product.best_price.toFixed(2)} € ({product.best_store})
                </p>
              )}
            </div>
            {/* Quantity stepper */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => onQtyChange(product.id, qty - 0.5)}
                disabled={qty <= 0.5}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-base font-bold disabled:opacity-30 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >−</button>
              <span className="w-8 text-center text-sm font-semibold text-slate-900 dark:text-white">{qty}</span>
              <button
                onClick={() => onQtyChange(product.id, qty + 0.5)}
                className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center justify-center text-base font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              >+</button>
            </div>
            <button
              onClick={() => onRemove(product.id)}
              className="text-slate-300 dark:text-slate-600 hover:text-red-500 transition flex-shrink-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

// Main page
export default function ComparePage() {
  const [products, setProducts] = useState([])
  const [stores, setStores]     = useState([])
  const [search, setSearch]     = useState('')
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState('compare')

  const { selection, addToSelection: ctxAdd, removeFromSelection, changeQty, clearAll, syncProducts } = useCompare()

  const load = useCallback(async (q = '') => {
    setLoading(true)
    try {
      const [prods, strs] = await Promise.all([api.getProducts(q), api.getStores()])
      setProducts(prods)
      setStores(strs)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const t = setTimeout(() => load(search), 300)
    return () => clearTimeout(t)
  }, [search, load])

  useEffect(() => { syncProducts(products) }, [products]) // eslint-disable-line

  function addToSelection(product) {
    ctxAdd(product)
    setTab('compare')
  }

  const selectedIds = new Set(selection.map(s => s.product.id))

  return (
    <div className="page-enter flex flex-col min-h-screen">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-bold text-slate-900 dark:text-white text-lg">Comparer</h1>
          {selection.length > 0 && (
            <button onClick={clearAll} className="text-xs text-slate-400 hover:text-red-500 transition">
              Tout effacer
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          <button
            onClick={() => setTab('compare')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${
              tab === 'compare'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Comparaison {selection.length > 0 && `(${selection.length})`}
          </button>
          <button
            onClick={() => setTab('add')}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${
              tab === 'add'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            Ajouter un produit
          </button>
        </div>
      </div>

      <div className="flex-1 px-4 py-4">
        {tab === 'compare' ? (
          <ComparisonPanel
            selection={selection}
            stores={stores}
            onQtyChange={changeQty}
            onRemove={removeFromSelection}
          />
        ) : (
          <>
            {/* Search */}
            <div className="relative mb-3">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
              </svg>
              <input
                className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Rechercher un produit…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : products.length === 0 ? (
              <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-8">
                Aucun produit trouvé
              </p>
            ) : (
              <div className="space-y-1.5">
                {products.map(product => {
                  const inSel = selectedIds.has(product.id)
                  return (
                    <button
                      key={product.id}
                      onClick={() => inSel ? removeFromSelection(product.id) : addToSelection(product)}
                      className={`w-full flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                        inSel
                          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-300 dark:border-emerald-700'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-emerald-300'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                        inSel ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {inSel && (
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="white" className="w-3 h-3">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{product.name}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{product.unit}</p>
                      </div>
                      {product.best_price != null ? (
                        <div className="text-right flex-shrink-0">
                          <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {product.best_price.toFixed(2)} €
                          </p>
                          <p className="text-xs text-slate-400 dark:text-slate-500">{product.best_store}</p>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">Pas de prix</p>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
