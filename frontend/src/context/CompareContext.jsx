import { createContext, useContext, useState } from 'react'

const STORAGE_KEY = 'saveat_compare_selection'

function loadSelection() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function saveSelection(sel) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sel))
}

const CompareContext = createContext(null)

export function CompareProvider({ children }) {
  const [selection, setSelection] = useState(loadSelection)

  function addToSelection(product) {
    setSelection(prev => {
      if (prev.find(s => s.product.id === product.id)) return prev
      const next = [...prev, { product, qty: 1 }]
      saveSelection(next)
      return next
    })
  }

  function removeFromSelection(productId) {
    setSelection(prev => {
      const next = prev.filter(s => s.product.id !== productId)
      saveSelection(next)
      return next
    })
  }

  function changeQty(productId, newQty) {
    if (newQty <= 0) { removeFromSelection(productId); return }
    setSelection(prev => {
      const next = prev.map(s => s.product.id === productId ? { ...s, qty: newQty } : s)
      saveSelection(next)
      return next
    })
  }

  function clearAll() {
    setSelection([])
    saveSelection([])
  }

  function syncProducts(products) {
    if (!products.length) return
    setSelection(prev => prev.map(s => ({
      ...s,
      product: products.find(p => p.id === s.product.id) || s.product,
    })))
  }

  return (
    <CompareContext.Provider value={{ selection, addToSelection, removeFromSelection, changeQty, clearAll, syncProducts }}>
      {children}
    </CompareContext.Provider>
  )
}

export function useCompare() {
  return useContext(CompareContext)
}
