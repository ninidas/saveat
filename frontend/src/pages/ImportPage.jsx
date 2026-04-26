import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import BottomSheet from '../components/BottomSheet'

// Helpers

const STOP_WORDS = new Set([
  'bio', 'super', 'ultra', 'extra', 'original', 'classic',
  'nature', 'natural', 'fresh', 'frais', 'fraiche', 'light', 'maxi', 'mini',
  'format', 'pack', 'lot', 'les', 'des', 'une', 'pour', 'avec', '100',
  '500', '250', '200', '400', '750', '1000', '125', '150', '330', '600',
  'auc', 'auchan', 'carrefour', 'leclerc', 'lidl', 'aldi', 'monoprix',
  'casino', 'intermarche', 'franprix', 'picard',
])

function normalizeName(raw) {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, c => c.toUpperCase())
}

function similarity(a, b) {
  const normalize = s =>
    s.toLowerCase()
      .replace(/[^a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w) && !/^\d/.test(w))
  const wa = normalize(a), wb = normalize(b)
  if (!wa.length || !wb.length) return 0
  const common = wa.filter(w => wb.some(x => x === w || (w.length > 3 && x.includes(w)) || (x.length > 3 && w.includes(x))))
  const score = common.length / Math.max(wa.length, wb.length)
  const hasExact = wa.some(w => wb.includes(w))
  return hasExact ? score : score * 0.7
}

function findSuggestions(name, products) {
  return products
    .map(p => ({ product: p, score: similarity(name, p.name) }))
    .filter(x => x.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
}

function formatDate(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now - d) / 86400000)
  if (diffDays === 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ReceiptAnalyzer sheet

function ReceiptAnalyzer({ onClose, onImported }) {
  const [file, setFile]           = useState(null)
  const [preview, setPreview]     = useState(null)
  const [loading, setLoading]     = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult]       = useState(null)
  const [stores, setStores]       = useState([])
  const [products, setProducts]   = useState([])
  const [selectedStoreId, setSelectedStoreId] = useState('')
  const [rows, setRows]           = useState([])
  const [importDone, setImportDone] = useState(false)
  const [importCount, setImportCount] = useState(0)
  const [error, setError]         = useState('')
  const inputRef                  = useRef()

  useEffect(() => {
    Promise.all([api.getStores(), api.getProducts()])
      .then(([s, p]) => { setStores(s); setProducts(p) })
      .catch(() => {})
  }, [])

  function pickFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f); setPreview(f.type === 'application/pdf' ? null : URL.createObjectURL(f))
    setResult(null); setRows([]); setImportDone(false); setError('')
  }

  async function analyze() {
    if (!file) return
    setLoading(true); setError('')
    try {
      const res = await api.analyzeReceipt(file)
      setResult(res)
      // Deduplicate items with same name and price (e.g. 2 units of the same product)
      const seen = new Set()
      const deduped = res.items.filter(item => {
        const key = `${normalizeName(item.name)}|${item.price}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      setRows(deduped.map(item => {
        const cleanName   = normalizeName(item.name)
        const suggestions = findSuggestions(cleanName, products)
        const best        = suggestions[0]
        return { checked: true, name: cleanName, price: item.price, unit: item.unit, linkedProductId: best?.product.id ?? null }
      }))
      if (res.store_name && stores.length) {
        const detected = res.store_name.toLowerCase()
        const matches = stores
          .filter(s => { const n = s.name.toLowerCase(); return n === detected || n.includes(detected) || detected.includes(n) })
          .sort((a, b) => {
            const an = a.name.toLowerCase(), bn = b.name.toLowerCase()
            if (an === detected && bn !== detected) return -1
            if (bn === detected && an !== detected) return 1
            return b.name.length - a.name.length
          })
        if (matches.length) setSelectedStoreId(String(matches[0].id))
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  async function importItems() {
    if (!selectedStoreId) { setError('Sélectionnez une enseigne'); return }
    const toImport = rows.filter(r => r.checked && r.name.trim() && r.price > 0)
    if (!toImport.length) { setError('Aucun article sélectionné'); return }

    setImporting(true); setError('')
    try {
      for (const row of toImport) {
        let productId = row.linkedProductId
        if (!productId) {
          const created = await api.createProduct({ name: row.name.trim(), unit: row.unit || 'unité' })
          productId = created.id
        }
        await api.upsertPrice(productId, parseInt(selectedStoreId), row.price)
      }

      const store      = stores.find(s => s.id === parseInt(selectedStoreId))
      const total      = Math.round(toImport.reduce((s, r) => s + r.price, 0) * 100) / 100
      await api.createImportSession({
        store_id:     parseInt(selectedStoreId),
        store_name:   store?.name || result?.store_name || 'Inconnue',
        item_count:   toImport.length,
        total_amount: total,
      })

      setImportCount(toImport.length)
      setImportDone(true)
      onImported?.()
    } catch (err) { setError(err.message) }
    finally { setImporting(false) }
  }

  function reset() {
    setFile(null); setPreview(null); setResult(null)
    setRows([]); setImportDone(false); setError('')
  }

  const checkedCount = rows.filter(r => r.checked).length

  if (importDone) {
    return (
      <BottomSheet title="Import terminé" onClose={onClose}>
        <div className="text-center py-6 space-y-4">
          <div className="text-5xl">✅</div>
          <p className="font-semibold text-slate-900 dark:text-white">
            {importCount} produit{importCount > 1 ? 's' : ''} importé{importCount > 1 ? 's' : ''}
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Les prix ont été enregistrés dans le catalogue.</p>
          <div className="flex gap-2">
            <button onClick={reset} className="flex-1 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
              Nouveau ticket
            </button>
            <button onClick={onClose} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-sm font-medium transition">
              Fermer
            </button>
          </div>
        </div>
      </BottomSheet>
    )
  }

  return (
    <BottomSheet title="Importer un ticket / une facture" onClose={onClose} disableBackdropClose={!!result || loading}>
      <div className="space-y-4">
        <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={pickFile} />

        {!file ? (
          <button onClick={() => inputRef.current.click()}
            className="w-full border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl py-8 flex flex-col items-center gap-2 text-slate-400 hover:border-emerald-400 hover:text-emerald-500 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-9 h-9">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
            </svg>
            <span className="text-sm font-medium">Photo, image ou facture PDF</span>
          </button>
        ) : preview ? (
          <div className="relative">
            <img src={preview} alt="Ticket" className="w-full rounded-2xl object-cover max-h-40" />
            <button onClick={reset} className="absolute top-2 right-2 w-7 h-7 bg-black/50 rounded-full flex items-center justify-center text-white hover:bg-black/70 transition">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3">
            <span className="text-2xl">📄</span>
            <span className="flex-1 text-sm text-slate-700 dark:text-slate-300 truncate">{file.name}</span>
            <button onClick={reset} className="text-slate-400 hover:text-red-500 transition">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>
        )}

        {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</p>}

        {file && !result && (
          <button onClick={analyze} disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Analyse en cours…</>
              : <>✨ Analyser avec Claude</>}
          </button>
        )}

        {result && rows.length > 0 && (
          <>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Enseigne{result.store_name ? ` (détectée : ${result.store_name})` : ''}
              </label>
              <select
                className="w-full border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 text-sm dark:bg-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                value={selectedStoreId} onChange={e => setSelectedStoreId(e.target.value)}
              >
                <option value="">Sélectionner une enseigne</option>
                {stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
                  {rows.length} article{rows.length > 1 ? 's' : ''} détecté{rows.length > 1 ? 's' : ''}
                </p>
                <button
                  onClick={() => setRows(r => r.map(x => ({ ...x, checked: !rows.every(x => x.checked) })))}
                  className="text-xs text-emerald-600 dark:text-emerald-400"
                >
                  {rows.every(r => r.checked) ? 'Tout décocher' : 'Tout cocher'}
                </button>
              </div>
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {rows.map((row, i) => {
                  const suggestions = findSuggestions(row.name, products)
                  return (
                    <div key={i} className={`rounded-xl border transition ${row.checked ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900' : 'border-slate-100 dark:border-slate-800 opacity-50'}`}>
                      <div className="flex items-center gap-2 px-3 py-2">
                        <button
                          onClick={() => setRows(r => r.map((x, j) => j === i ? { ...x, checked: !x.checked } : x))}
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${row.checked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-300 dark:border-slate-600'}`}
                        >
                          {row.checked && <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="white" className="w-3 h-3"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>}
                        </button>
                        <input
                          className="flex-1 text-sm bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none min-w-0"
                          value={row.name}
                          onChange={e => setRows(r => r.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                        />
                        <input
                          type="number" step="0.01" min="0"
                          className="w-16 text-sm text-right bg-transparent font-semibold text-emerald-600 dark:text-emerald-400 focus:outline-none"
                          value={row.price}
                          onChange={e => setRows(r => r.map((x, j) => j === i ? { ...x, price: parseFloat(e.target.value) || 0 } : x))}
                        />
                        <span className="text-xs text-slate-400 flex-shrink-0">€</span>
                      </div>
                      <div className="px-3 pb-2 border-t border-slate-100 dark:border-slate-800 pt-1.5">
                        <select
                          className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          value={row.linkedProductId ?? ''}
                          onChange={e => setRows(r => r.map((x, j) => j === i ? { ...x, linkedProductId: e.target.value ? parseInt(e.target.value) : null } : x))}
                        >
                          <option value="">✨ Nouveau produit</option>
                          {suggestions.length > 0 && (
                            <optgroup label="Suggestions">
                              {suggestions.map(({ product, score }) => (
                                <option key={product.id} value={product.id}>{product.name} ({Math.round(score * 100)}%)</option>
                              ))}
                            </optgroup>
                          )}
                          {products.length > 0 && (
                            <optgroup label="Tous les produits">
                              {products.filter(p => !suggestions.find(s => s.product.id === p.id)).map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <button
              onClick={importItems}
              disabled={importing || !checkedCount || !selectedStoreId}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-xl text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {importing
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Import en cours…</>
                : <>Importer {checkedCount} article{checkedCount > 1 ? 's' : ''}</>}
            </button>
          </>
        )}
      </div>
    </BottomSheet>
  )
}

// Main page

export default function ImportPage() {
  const [sessions, setSessions]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [apiKeySet, setApiKeySet]       = useState(null)
  const [showAnalyzer, setShowAnalyzer] = useState(false)
  const navigate                        = useNavigate()

  async function loadSessions() {
    try {
      const [data, settings] = await Promise.all([api.getImportSessions(), api.getSettings()])
      setSessions(data)
      setApiKeySet(settings.claude_api_key_set)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadSessions() }, [])

  function handleImported() {
    loadSessions()
  }

  return (
    <div className="page-enter">
      <div className="sticky top-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-3 flex items-center gap-3">
        <h1 className="font-bold text-slate-900 dark:text-white text-lg flex-1">Import tickets</h1>
        <button
          onClick={() => apiKeySet ? setShowAnalyzer(true) : navigate('/settings')}
          className={`rounded-xl px-3 py-2 text-sm font-medium flex items-center gap-1.5 transition ${
            apiKeySet
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Nouveau
        </button>
      </div>

      {apiKeySet === false && (
        <div className="mx-4 mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-xl flex-shrink-0">⚠️</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Clé API Claude requise</p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
              L'analyse des tickets nécessite une clé API Claude d'Anthropic.
            </p>
            <button
              onClick={() => navigate('/settings')}
              className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300 underline underline-offset-2"
            >
              Configurer dans les réglages →
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="text-5xl mb-3">🧾</div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Aucun import</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Importez votre premier ticket de caisse</p>
          {apiKeySet
            ? (
              <button
                onClick={() => setShowAnalyzer(true)}
                className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition"
              >
                ✨ Analyser avec Claude
              </button>
            ) : (
              <button
                onClick={() => navigate('/settings')}
                className="mt-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition"
              >
                Configurer la clé API →
              </button>
            )
          }
        </div>
      ) : (
        <div className="px-4 py-3 space-y-2">
          {sessions.map(session => (
            <div
              key={session.id}
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 px-4 py-3.5 flex items-center gap-4"
            >
              <div
                className="w-10 h-10 rounded-xl flex-shrink-0"
                style={{ backgroundColor: session.store_color || '#6b7280' }}
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 dark:text-white">{session.store_name}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                  {session.item_count} article{session.item_count > 1 ? 's' : ''} · {formatDate(session.imported_at)}
                </p>
              </div>
              <p className="font-bold text-slate-900 dark:text-white text-sm flex-shrink-0">
                {session.total_amount.toFixed(2)} €
              </p>
            </div>
          ))}
        </div>
      )}

      {showAnalyzer && (
        <ReceiptAnalyzer
          onClose={() => setShowAnalyzer(false)}
          onImported={handleImported}
        />
      )}
    </div>
  )
}
