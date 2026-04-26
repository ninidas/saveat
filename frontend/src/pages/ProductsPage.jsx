import { useState, useEffect, useCallback } from 'react'
import { api } from '../api'
import BottomSheet from '../components/BottomSheet'

const UNITS = ['unité', 'kg', 'L', '100g', 'cl', 'g']
const CATEGORY_ICONS = {
  'Fruits & Légumes': '🥦',
  'Viandes & Poissons': '🥩',
  'Crèmerie': '🧀',
  'Épicerie': '🛒',
  'Boissons': '🥤',
  'Boulangerie': '🍞',
  'Surgelés': '🧊',
  'Hygiène': '🧴',
  'Autre': '📦',
}

function formatDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function PriceRow({ price, onEdit, onDelete }) {
  const [showHistory, setShowHistory] = useState(false)
  const hasHistory = price.history?.length > 1  // >1 car le dernier = prix actuel

  return (
    <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
      <div className="flex items-center gap-2 py-2">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: price.store_color }}
        />
        <span className="flex-1 text-sm text-slate-700 dark:text-slate-300">{price.store_name}</span>
        {hasHistory && (
          <button
            onClick={() => setShowHistory(h => !h)}
            className="text-xs text-slate-400 hover:text-emerald-600 transition px-1"
            title="Voir l'historique"
          >
            {showHistory ? '▲' : '▼'} historique
          </button>
        )}
        <span className="font-semibold text-slate-900 dark:text-white text-sm">{price.price.toFixed(2)} €</span>
        <button onClick={() => onEdit(price)} className="text-slate-400 hover:text-emerald-600 transition p-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Z" />
          </svg>
        </button>
        <button onClick={() => onDelete(price)} className="text-slate-400 hover:text-red-500 transition p-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      {showHistory && (
        <div className="ml-5 mb-2 space-y-0.5">
          {price.history.map((h, i) => {
            const isLatest = i === 0
            const prev = price.history[i + 1]
            const delta = prev ? h.price - prev.price : null
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 dark:text-slate-500 w-16 flex-shrink-0">{formatDate(h.recorded_at)}</span>
                <span className={`font-medium ${isLatest ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-500'}`}>
                  {h.price.toFixed(2)} €
                </span>
                {delta != null && (
                  <span className={`${delta > 0 ? 'text-red-400' : 'text-emerald-500'}`}>
                    {delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ProductSheet({ product, stores, products, onClose, onSaved, onDeleted }) {
  const [form, setForm]   = useState({
    name:     product?.name     || '',
    category: product?.category || '',
    unit:     product?.unit     || 'unité',
  })
  const [priceEdit, setPriceEdit]   = useState(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [showMerge, setShowMerge]   = useState(false)
  const [mergeSearch, setMergeSearch] = useState('')
  const isNew = !product

  async function saveProduct(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const saved = isNew
        ? await api.createProduct(form)
        : await api.updateProduct(product.id, form)
      onSaved(saved)
      if (!isNew) onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function savePrice(e) {
    e.preventDefault()
    if (!priceEdit || priceEdit.price === '') return
    setLoading(true)
    try {
      await api.upsertPrice(product.id, priceEdit.store_id, parseFloat(priceEdit.price))
      const updated = await api.getProduct(product.id)
      onSaved(updated)
      setPriceEdit(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function deletePrice(price) {
    setLoading(true)
    try {
      await api.deletePrice(product.id, price.store_id)
      const updated = await api.getProduct(product.id)
      onSaved(updated)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const storesWithoutPrice = stores.filter(
    s => !product?.prices?.some(p => p.store_id === s.id)
  )

  return (
    <BottomSheet title={isNew ? 'Nouveau produit' : 'Modifier le produit'} onClose={onClose}>
      <form onSubmit={saveProduct} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Nom</label>
          <input
            className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Ex : Yaourt nature 4×125g"
            autoFocus
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Catégorie</label>
            <select
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            >
              <option value="">aucune</option>
              {Object.keys(CATEGORY_ICONS).map(c => (
                <option key={c} value={c}>{CATEGORY_ICONS[c]} {c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Unité</label>
            <select
              className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={form.unit}
              onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
            >
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-sm transition disabled:opacity-50"
        >
          {isNew ? 'Créer le produit' : 'Enregistrer'}
        </button>
      </form>

      {/* Prices section — only after creation */}
      {!isNew && (
        <div className="mt-5">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Prix par enseigne</p>

          {product.prices?.length === 0 && (
            <p className="text-sm text-slate-400 dark:text-slate-500 italic">Aucun prix enregistré</p>
          )}

          {product.prices?.map(price => (
            <PriceRow
              key={price.store_id}
              price={price}
              onEdit={() => setPriceEdit({ store_id: price.store_id, store_name: price.store_name, price: price.price.toString() })}
              onDelete={() => deletePrice(price)}
            />
          ))}

          {/* Add new price */}
          {priceEdit ? (
            <form onSubmit={savePrice} className="mt-3 flex gap-2 items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400 flex-1">
                {priceEdit.store_name || stores.find(s => s.id === priceEdit.store_id)?.name}
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="w-24 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={priceEdit.price}
                onChange={e => setPriceEdit(p => ({ ...p, price: e.target.value }))}
                placeholder="0.00"
                autoFocus
                required
              />
              <span className="text-sm text-slate-500">€</span>
              <button type="submit" disabled={loading} className="bg-emerald-600 text-white rounded-xl px-3 py-2 text-sm font-medium">OK</button>
              <button type="button" onClick={() => setPriceEdit(null)} className="text-slate-400 hover:text-slate-600 rounded-xl px-2 py-2 text-sm">Annuler</button>
            </form>
          ) : storesWithoutPrice.length > 0 ? (
            <div className="mt-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1.5">Ajouter un prix :</p>
              <div className="flex flex-wrap gap-2">
                {storesWithoutPrice.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setPriceEdit({ store_id: s.id, store_name: s.name, price: '' })}
                    className="text-xs px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-500 hover:text-emerald-600 transition flex items-center gap-1.5"
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* Delete button */}
      {!isNew && (
        <div className="mt-4 space-y-2">
          {!showMerge ? (
            <button
              onClick={() => { setShowMerge(true); setMergeSearch('') }}
              className="w-full text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-2 transition border border-slate-200 dark:border-slate-700 rounded-xl"
            >
              Fusionner un doublon dans ce produit
            </button>
          ) : (
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Choisir le doublon à absorber (il sera supprimé) :</p>
              <input
                className="w-full border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="Rechercher…"
                value={mergeSearch}
                onChange={e => setMergeSearch(e.target.value)}
                autoFocus
              />
              <div className="max-h-40 overflow-y-auto space-y-1">
                {products
                  .filter(p => p.id !== product.id && p.name.toLowerCase().includes(mergeSearch.toLowerCase()))
                  .slice(0, 8)
                  .map(p => (
                    <button
                      key={p.id}
                      onClick={async () => {
                        if (!window.confirm(`Fusionner "${p.name}" dans "${product.name}" ? "${p.name}" sera supprimé.`)) return
                        setLoading(true)
                        try {
                          const updated = await api.mergeProduct(product.id, p.id)
                          onSaved(updated)
                          setShowMerge(false)
                        } catch (err) { setError(err.message) }
                        finally { setLoading(false) }
                      }}
                      className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition"
                    >
                      {p.name}
                    </button>
                  ))}
              </div>
              <button onClick={() => setShowMerge(false)} className="text-xs text-slate-400 hover:text-slate-600 transition">
                Annuler
              </button>
            </div>
          )}
          <button
            onClick={async () => {
              if (!window.confirm('Supprimer ce produit ?')) return
              await api.deleteProduct(product.id)
              onDeleted(product.id)
            }}
            className="w-full text-sm text-red-500 hover:text-red-700 py-2 transition"
          >
            Supprimer le produit
          </button>
        </div>
      )}
    </BottomSheet>
  )
}

export default function ProductsPage() {
  const [products, setProducts]   = useState([])
  const [stores, setStores]       = useState([])
  const [search, setSearch]       = useState('')
  const [filterMulti, setFilterMulti] = useState(false)
  const [loading, setLoading]     = useState(true)
  const [sheet, setSheet]         = useState(null)  // null | 'new' | product

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

  function handleSaved(saved) {
    setProducts(prev => {
      const idx = prev.findIndex(p => p.id === saved.id)
      if (idx >= 0) {
        const next = [...prev]; next[idx] = saved; return next
      }
      return [saved, ...prev]
    })
    setSheet(saved)  // keep sheet open with updated data
  }

  function handleDeleted(id) {
    setProducts(prev => prev.filter(p => p.id !== id))
    setSheet(null)
  }

  return (
    <div className="page-enter">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <h1 className="font-bold text-slate-900 dark:text-white text-lg flex-1">Produits</h1>
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

      {/* Search */}
      <div className="px-4 pt-3 pb-2 space-y-2">
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            className="w-full pl-9 pr-4 py-2.5 border border-slate-200 dark:border-slate-700 rounded-xl text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            placeholder="Rechercher un produit…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setFilterMulti(f => !f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              filterMulti
                ? 'bg-emerald-600 border-emerald-600 text-white'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-emerald-400'
            }`}
          >
            <span className="flex gap-0.5">
              <span className="w-2 h-2 rounded-full bg-current opacity-80" />
              <span className="w-2 h-2 rounded-full bg-current opacity-50" />
            </span>
            Plusieurs enseignes
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 space-y-2 pb-4">
          {products.filter(p => !filterMulti || p.prices?.length >= 2).length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="text-5xl mb-3">📦</div>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Aucun produit</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                {search ? 'Aucun résultat pour cette recherche' : filterMulti ? 'Aucun produit sur plusieurs enseignes' : 'Ajoutez votre premier produit'}
              </p>
            </div>
          ) : null}
          {products.filter(p => !filterMulti || p.prices?.length >= 2).map(product => (
            <button
              key={product.id}
              onClick={() => setSheet(product)}
              className="w-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-emerald-400 transition flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                {CATEGORY_ICONS[product.category] || '📦'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 dark:text-white truncate">{product.name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {product.category || 'Sans catégorie'} · {product.unit}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {product.best_price != null ? (
                  <>
                    <p className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                      {product.best_price.toFixed(2)} €
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{product.best_store}</p>
                  </>
                ) : (
                  <p className="text-xs text-slate-400 dark:text-slate-500">Pas de prix</p>
                )}
                {product.prices?.length > 0 && (
                  <div className="flex gap-1 mt-0.5">
                    {product.prices.map(p => (
                      <span
                        key={p.store_id}
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: p.store_color }}
                        title={p.store_name}
                      />
                    ))}
                  </div>
                )}
              </div>
            </button>
          ))}
        </div>
      )
      }

      {/* Sheets */}
      {sheet === 'new' && (
        <ProductSheet
          product={null}
          stores={stores}
          products={products}
          onClose={() => setSheet(null)}
          onSaved={saved => { setProducts(p => [saved, ...p]); setSheet(saved) }}
          onDeleted={handleDeleted}
        />
      )}
      {sheet && sheet !== 'new' && (
        <ProductSheet
          product={sheet}
          stores={stores}
          products={products}
          onClose={() => setSheet(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
