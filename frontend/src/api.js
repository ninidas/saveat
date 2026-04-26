const BASE = '/api'

function getToken() {
  return localStorage.getItem('token')
}

const _cache = {}
const TTL = 30_000

function cached(key, fn) {
  const entry = _cache[key]
  if (entry && Date.now() < entry.expiresAt) return Promise.resolve(entry.data)
  return fn().then(data => {
    _cache[key] = { data, expiresAt: Date.now() + TTL }
    return data
  })
}

function invalidate(...keys) {
  keys.forEach(k => {
    if (k.endsWith('*')) {
      const prefix = k.slice(0, -1)
      Object.keys(_cache).filter(x => x.startsWith(prefix)).forEach(x => delete _cache[x])
    } else {
      delete _cache[k]
    }
  })
}

export function clearCache() {
  Object.keys(_cache).forEach(k => delete _cache[k])
}

async function request(path, options = {}) {
  const token = getToken()
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  })

  if (res.status === 401) {
    if (token) {
      localStorage.clear()
      window.location.href = '/login'
      return
    }
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Identifiants invalides')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || 'Une erreur est survenue')
  }

  if (res.status === 204) return null
  return res.json()
}

export const api = {
  // Config / setup
  getConfig:    ()      => request('/config'),
  setupStatus:  ()      => request('/setup/status'),
  setup:        (data)  => request('/setup', { method: 'POST', body: JSON.stringify(data) }),
  login:        (u, p)  => request('/auth/login', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }),
  register:     (u, p)  => request('/users/register', { method: 'POST', body: JSON.stringify({ username: u, password: p }) }),
  deleteAccount:(pwd)   => request('/users/me', { method: 'DELETE', body: JSON.stringify({ password: pwd }) }),

  // Stores
  getStores:    ()      => cached('stores', () => request('/stores')),
  createStore:  (data)  => request('/stores', { method: 'POST', body: JSON.stringify(data) })
                             .then(r => { invalidate('stores') ; return r }),
  updateStore:  (id, d) => request(`/stores/${id}`, { method: 'PATCH', body: JSON.stringify(d) })
                             .then(r => { invalidate('stores') ; return r }),
  deleteStore:  (id)    => request(`/stores/${id}`, { method: 'DELETE' })
                             .then(r => { invalidate('stores', 'products') ; return r }),

  // Products
  getProducts:     (q)      => cached(`products:${q||''}`, () => request(`/products${q ? `?search=${encodeURIComponent(q)}` : ''}`)),
  getProduct:      (id)     => request(`/products/${id}`),
  createProduct:   (data)   => request('/products', { method: 'POST', body: JSON.stringify(data) })
                                 .then(r => { invalidate('products*') ; return r }),
  updateProduct:   (id, d)  => request(`/products/${id}`, { method: 'PATCH', body: JSON.stringify(d) })
                                 .then(r => { invalidate('products*') ; return r }),
  deleteProduct:   (id)     => request(`/products/${id}`, { method: 'DELETE' })
                                 .then(r => { invalidate('products*') ; return r }),
  upsertPrice:     (pid, sid, price) =>
                               request(`/products/${pid}/prices/${sid}`, { method: 'PUT', body: JSON.stringify({ price }) })
                                 .then(r => { invalidate('products*') ; return r }),
  deletePrice:     (pid, sid) => request(`/products/${pid}/prices/${sid}`, { method: 'DELETE' })
                                 .then(r => { invalidate('products*') ; return r }),
  getCategories:   ()       => cached('categories', () => request('/products/categories/list')),
  getStats:        ()       => request('/products/stats'),

  // Import sessions
  getImportSessions:    ()     => request('/imports'),
  createImportSession:  (data) => request('/imports', { method: 'POST', body: JSON.stringify(data) }),

  // Settings
  getSettings:     ()       => request('/settings'),
  updateSettings:  (data)   => request('/settings', { method: 'PATCH', body: JSON.stringify(data) }),

  // Receipt OCR
  analyzeReceipt: async (file) => {
    const token = getToken()
    const form  = new FormData()
    form.append('file', file)
    const res = await fetch(`${BASE}/receipt/analyze`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Erreur lors de l\'analyse')
    }
    return res.json()
  },
}
