import { create } from 'zustand'

const API = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api'

export const useStore = create((set, get) => ({
  datasets: [],
  activeDataset: null,
  entries: [],
  loading: false,
  uploading: false,
  error: null,

  fetchDatasets: async () => {
    try {
      const r = await fetch(`${API}/datasets`)
      const data = await r.json()
      if (Array.isArray(data)) set({ datasets: data })
    } catch (e) { console.error(e) }
  },

  uploadCSV: async (file, name) => {
    set({ uploading: true, error: null })
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (name) fd.append('name', name)
      const r = await fetch(`${API}/datasets/upload`, { method: 'POST', body: fd })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || 'Upload failed')
      set(s => ({ datasets: [data, ...s.datasets], activeDataset: data }))
      get().pollDataset(data.id)
      return data
    } catch (e) {
      set({ error: e.message }); throw e
    } finally {
      set({ uploading: false })
    }
  },

  createTextDataset: async (texts, name) => {
    set({ uploading: true, error: null })
    try {
      const r = await fetch(`${API}/datasets/text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, name: name || 'Text Dataset' }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.detail || 'Failed')
      set(s => ({ datasets: [data, ...s.datasets], activeDataset: data }))
      get().pollDataset(data.id)
      return data
    } catch (e) {
      set({ error: e.message }); throw e
    } finally {
      set({ uploading: false })
    }
  },

  pollDataset: (id) => {
    const interval = setInterval(async () => {
      try {
        const r = await fetch(`${API}/datasets/${id}`)
        const data = await r.json()
        set(s => ({
          datasets: s.datasets.map(d => d.id === id ? data : d),
          activeDataset: s.activeDataset?.id === id ? data : s.activeDataset,
        }))
        if (data.status === 'ready' || data.status === 'error') {
          clearInterval(interval)
          if (data.status === 'ready') get().fetchEntries(id)
        }
      } catch { clearInterval(interval) }
    }, 2000)
  },

  fetchEntries: async (datasetId, filters = {}) => {
    try {
      const params = new URLSearchParams({ limit: 100, offset: 0, ...filters })
      const r = await fetch(`${API}/datasets/${datasetId}/entries?${params}`)
      const data = await r.json()
      if (Array.isArray(data)) set({ entries: data })
    } catch (e) { console.error(e) }
  },

  setActiveDataset: (d) => {
    set({ activeDataset: d, entries: [] })
    if (d?.status === 'ready') get().fetchEntries(d.id)
  },

  deleteDataset: async (id) => {
    await fetch(`${API}/datasets/${id}`, { method: 'DELETE' })
    set(s => ({
      datasets: s.datasets.filter(d => d.id !== id),
      activeDataset: s.activeDataset?.id === id ? null : s.activeDataset,
      entries: s.activeDataset?.id === id ? [] : s.entries,
    }))
  },

  liveAnalyze: async (text) => {
    if (!text.trim()) return null
    try {
      const r = await fetch(`${API}/live`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      return await r.json()
    } catch { return null }
  },
}))
