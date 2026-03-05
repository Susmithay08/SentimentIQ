import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2, Upload, FileText, Trash2, Loader2, AlertCircle,
  Plus, ArrowLeft, Brain, Zap, TrendingUp, Hash, List,
  ChevronDown, RefreshCw, Activity
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import { useStore } from '../store'
import { formatDistanceToNow } from 'date-fns'

// ── Color maps ────────────────────────────────────────────────────────────────
const SENT_COLOR = { positive:'#10B981', negative:'#F43F5E', neutral:'#6366F1' }
const EMOTION_COLOR = {
  joy:'#FCD34D', anger:'#F43F5E', fear:'#8B5CF6',
  sadness:'#60A5FA', surprise:'#FB923C', disgust:'#4ADE80', neutral:'#9CA3AF'
}
const EMOTION_EMOJI = { joy:'😊', anger:'😡', fear:'😨', sadness:'😢', surprise:'😲', disgust:'🤢', neutral:'😐' }

// ── Small components ──────────────────────────────────────────────────────────
function SentimentPill({ sentiment }) {
  if (!sentiment) return null
  const cls = { positive:'pill-pos', negative:'pill-neg', neutral:'pill-neu' }[sentiment] || 'pill-neu'
  const dot = { positive:'●', negative:'●', neutral:'●' }[sentiment]
  return <span className={`pill ${cls}`}>{dot} {sentiment}</span>
}

function StatusDot({ status }) {
  const map = {
    ready:    { color:'#10B981', label:'Ready', pulse:false },
    analyzing:{ color:'#F59E0B', label:'Analyzing…', pulse:true },
    pending:  { color:'#6B7280', label:'Pending', pulse:true },
    error:    { color:'#F43F5E', label:'Error' },
  }
  const s = map[status] || map.pending
  return (
    <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:s.color, fontFamily:'var(--mono)' }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:s.color,
        animation: s.pulse ? 'pulse 1.2s infinite' : 'none' }}/>
      {s.label}
    </span>
  )
}

function StatCard({ label, value, sub, color, icon:Icon }) {
  return (
    <div className="stat-card">
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
        <p style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)',
          textTransform:'uppercase', letterSpacing:'0.08em' }}>{label}</p>
        {Icon && <Icon size={14} style={{ color: color || 'var(--text3)', opacity:0.7 }}/>}
      </div>
      <p style={{ fontSize:26, fontWeight:800, color: color || 'var(--text)', letterSpacing:'-0.02em' }}>{value}</p>
      {sub && <p style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>{sub}</p>}
    </div>
  )
}

// ── Live Analyzer ─────────────────────────────────────────────────────────────
function LiveAnalyzer() {
  const { liveAnalyze } = useStore()
  const [text, setText] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef()

  const analyze = useCallback(async (t) => {
    if (!t.trim() || t.length < 5) { setResult(null); return }
    setLoading(true)
    const r = await liveAnalyze(t)
    setResult(r)
    setLoading(false)
  }, [])

  const handleChange = (e) => {
    const t = e.target.value
    setText(t)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => analyze(t), 700)
  }

  const sentiment = result?.sentiment
  const emotion = result?.emotion

  return (
    <div className="card" style={{ padding:20 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
        <Activity size={14} style={{ color:'var(--cyan)' }}/>
        <p style={{ fontWeight:700, fontSize:13 }}>Live Text Analyzer</p>
        <p style={{ fontSize:11, color:'var(--text3)' }}>— type and see sentiment in real time</p>
      </div>
      <textarea className="input" value={text} onChange={handleChange}
        placeholder="Type or paste any text to analyze sentiment and emotion…"
        style={{ minHeight:80, resize:'vertical', lineHeight:1.6, fontSize:13 }}/>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginTop:12 }}>
            <div style={{ padding:'12px', borderRadius:9, background:'var(--bg3)',
              border:`1px solid ${SENT_COLOR[sentiment] || 'var(--border)'}22`, textAlign:'center' }}>
              <p style={{ fontSize:11, color:'var(--text3)', marginBottom:4 }}>Sentiment</p>
              <SentimentPill sentiment={sentiment}/>
              <p style={{ fontSize:11, color:'var(--text3)', marginTop:4, fontFamily:'var(--mono)' }}>
                {Math.round((result.sentiment_score || 0) * 100)}% conf.
              </p>
            </div>
            <div style={{ padding:'12px', borderRadius:9, background:'var(--bg3)',
              border:`1px solid ${EMOTION_COLOR[emotion] || 'var(--border)'}33`, textAlign:'center' }}>
              <p style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>Emotion</p>
              <p style={{ fontSize:18 }}>{EMOTION_EMOJI[emotion] || '😐'}</p>
              <p style={{ fontSize:12, fontWeight:600, color: EMOTION_COLOR[emotion] || 'var(--text2)',
                marginTop:4, textTransform:'capitalize' }}>{emotion}</p>
            </div>
            <div style={{ padding:'12px', borderRadius:9, background:'var(--bg3)',
              border:'1px solid var(--border)', textAlign:'center' }}>
              <p style={{ fontSize:11, color:'var(--text3)', marginBottom:6 }}>Score breakdown</p>
              {[['pos', result.pos_score, 'var(--pos)'], ['neu', result.neu_score, 'var(--neu)'], ['neg', result.neg_score, 'var(--neg)']].map(([k,v,c]) => (
                <div key={k} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                  <span style={{ fontSize:10, fontFamily:'var(--mono)', color:c, width:24 }}>{k}</span>
                  <div style={{ flex:1, height:3, borderRadius:3, background:'var(--border)', overflow:'hidden' }}>
                    <div style={{ width:`${Math.round((v||0)*100)}%`, height:'100%', background:c, borderRadius:3 }}/>
                  </div>
                  <span style={{ fontSize:10, fontFamily:'var(--mono)', color:'var(--text3)', width:28, textAlign:'right' }}>
                    {Math.round((v||0)*100)}%
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {loading && (
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:10, color:'var(--text3)', fontSize:12 }}>
          <Loader2 size={11} style={{ animation:'spin 0.7s linear infinite' }}/> Analyzing…
        </div>
      )}
    </div>
  )
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({ dataset, entries }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [filter, setFilter] = useState(null)
  const { fetchEntries } = useStore()

  const sc = dataset.sentiment_counts || {}
  const ec = dataset.emotion_counts || {}
  const total = dataset.total_rows || 1

  const sentPieData = Object.entries(sc).map(([name, value]) => ({ name, value }))
  const emotionBarData = Object.entries(ec)
    .sort((a,b) => b[1]-a[1])
    .map(([name, value]) => ({ name, value, emoji: EMOTION_EMOJI[name] || '' }))

  const handleFilter = (s) => {
    const newFilter = filter === s ? null : s
    setFilter(newFilter)
    fetchEntries(dataset.id, newFilter ? { sentiment: newFilter } : {})
  }

  return (
    <div style={{ animation:'fadeUp 0.3s ease' }}>
      {/* Tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:20, background:'var(--bg3)',
        padding:3, borderRadius:9, border:'1px solid var(--border)', width:'fit-content' }}>
        {[
          { id:'overview', icon:BarChart2, label:'Overview' },
          { id:'emotions', icon:Brain, label:'Emotions' },
          { id:'topics', icon:Hash, label:'Topics' },
          { id:'entries', icon:List, label:'Entries' },
        ].map(({ id, icon:Icon, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            style={{ display:'flex', alignItems:'center', gap:5, padding:'7px 14px',
              borderRadius:7, fontSize:12, fontWeight:600, transition:'all 0.15s',
              background: activeTab===id ? 'var(--bg5)' : 'transparent',
              color: activeTab===id ? 'var(--cyan)' : 'var(--text3)',
              border:`1px solid ${activeTab===id ? 'var(--border2)' : 'transparent'}` }}>
            <Icon size={11}/>{label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            {/* Stats row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:16 }}>
              <StatCard label="Total Entries" value={total.toLocaleString()} icon={FileText}/>
              <StatCard label="Positive" value={`${Math.round((sc.positive||0)/total*100)}%`}
                sub={`${sc.positive||0} entries`} color="var(--pos)" icon={TrendingUp}/>
              <StatCard label="Negative" value={`${Math.round((sc.negative||0)/total*100)}%`}
                sub={`${sc.negative||0} entries`} color="var(--neg)"/>
              <StatCard label="Avg Confidence" value={`${Math.round((dataset.avg_confidence||0)*100)}%`}
                sub="model certainty" color="var(--cyan)" icon={Brain}/>
            </div>

            {/* Sentiment pie + trend */}
            <div style={{ display:'grid', gridTemplateColumns:'340px 1fr', gap:14, marginBottom:14 }}>
              <div className="card" style={{ padding:20 }}>
                <p style={{ fontSize:12, fontWeight:700, marginBottom:14 }}>Sentiment Distribution</p>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={sentPieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      dataKey="value" paddingAngle={3}>
                      {sentPieData.map((entry, i) => (
                        <Cell key={i} fill={SENT_COLOR[entry.name] || '#666'}/>
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => [v, '']}
                      contentStyle={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }}/>
                    <Legend formatter={(v) => <span style={{ fontSize:11, color:'var(--text2)', textTransform:'capitalize' }}>{v}</span>}/>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display:'flex', gap:8, justifyContent:'center', marginTop:6 }}>
                  {Object.entries(SENT_COLOR).map(([k,c]) => (
                    <button key={k} onClick={() => handleFilter(k)}
                      style={{ fontSize:11, padding:'3px 10px', borderRadius:12, fontFamily:'var(--mono)',
                        background: filter===k ? c+'22' : 'var(--bg4)',
                        color: filter===k ? c : 'var(--text3)',
                        border:`1px solid ${filter===k ? c+'44' : 'var(--border)'}`,
                        transition:'all 0.15s' }}>
                      {k}
                    </button>
                  ))}
                </div>
              </div>

              <div className="card" style={{ padding:20 }}>
                <p style={{ fontSize:12, fontWeight:700, marginBottom:14 }}>
                  {dataset.trend_data?.length > 0 ? 'Sentiment Over Time' : 'Sentiment Breakdown'}
                </p>
                <ResponsiveContainer width="100%" height={180}>
                  {dataset.trend_data?.length > 0 ? (
                    <AreaChart data={dataset.trend_data} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                      <XAxis dataKey="date" tick={{ fontSize:10, fill:'var(--text3)' }} tickLine={false}/>
                      <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} tickLine={false} axisLine={false}/>
                      <Tooltip contentStyle={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }}/>
                      <Area type="monotone" dataKey="positive" stackId="1" stroke="var(--pos)" fill="var(--pos)" fillOpacity={0.2}/>
                      <Area type="monotone" dataKey="neutral"  stackId="1" stroke="var(--neu)" fill="var(--neu)" fillOpacity={0.15}/>
                      <Area type="monotone" dataKey="negative" stackId="1" stroke="var(--neg)" fill="var(--neg)" fillOpacity={0.2}/>
                    </AreaChart>
                  ) : (
                    <BarChart data={sentPieData} margin={{ top:0, right:0, left:-20, bottom:0 }}>
                      <XAxis dataKey="name" tick={{ fontSize:11, fill:'var(--text2)', textTransform:'capitalize' }} tickLine={false}/>
                      <YAxis tick={{ fontSize:10, fill:'var(--text3)' }} tickLine={false} axisLine={false}/>
                      <Tooltip contentStyle={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }}/>
                      <Bar dataKey="value" radius={[6,6,0,0]}>
                        {sentPieData.map((entry, i) => <Cell key={i} fill={SENT_COLOR[entry.name] || '#666'}/>)}
                      </Bar>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'emotions' && (
          <motion.div key="emotions" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
              {/* Emotion bar chart */}
              <div className="card" style={{ padding:20 }}>
                <p style={{ fontSize:12, fontWeight:700, marginBottom:14 }}>Emotion Frequency</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={emotionBarData} layout="vertical" margin={{ top:0, right:20, left:10, bottom:0 }}>
                    <XAxis type="number" tick={{ fontSize:10, fill:'var(--text3)' }} tickLine={false} axisLine={false}/>
                    <YAxis dataKey="name" type="category" tick={{ fontSize:11, fill:'var(--text2)' }} tickLine={false} width={70}
                      tickFormatter={(v) => `${EMOTION_EMOJI[v] || ''} ${v}`}/>
                    <Tooltip contentStyle={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }}/>
                    <Bar dataKey="value" radius={[0,6,6,0]}>
                      {emotionBarData.map((e, i) => <Cell key={i} fill={EMOTION_COLOR[e.name] || '#666'}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Emotion cards */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, alignContent:'start' }}>
                {emotionBarData.map(({ name, value }) => {
                  const color = EMOTION_COLOR[name] || '#999'
                  const pct = Math.round(value / total * 100)
                  return (
                    <div key={name} className="card" style={{ padding:'14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                        <span style={{ fontSize:18 }}>{EMOTION_EMOJI[name] || '😐'}</span>
                        <div>
                          <p style={{ fontSize:12, fontWeight:600, textTransform:'capitalize', color }}>{name}</p>
                          <p style={{ fontSize:11, color:'var(--text3)' }}>{value} entries</p>
                        </div>
                      </div>
                      <div style={{ height:3, borderRadius:3, background:'var(--border)', overflow:'hidden' }}>
                        <motion.div initial={{ width:0 }} animate={{ width:`${pct}%` }} transition={{ delay:0.1, duration:0.6 }}
                          style={{ height:'100%', borderRadius:3, background:color }}/>
                      </div>
                      <p style={{ fontSize:10, color:'var(--text3)', marginTop:4, fontFamily:'var(--mono)' }}>{pct}%</p>
                    </div>
                  )
                })}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'topics' && (
          <motion.div key="topics" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            {!dataset.topics?.length ? (
              <div style={{ textAlign:'center', padding:'48px', color:'var(--text3)' }}>
                <Hash size={28} style={{ margin:'0 auto 10px', opacity:0.2 }}/>
                <p>Not enough data for topic clustering</p>
              </div>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(260px,1fr))', gap:12 }}>
                {dataset.topics.map((topic, i) => {
                  const colors = ['#22D3EE','#8B5CF6','#10B981','#F59E0B','#F43F5E','#60A5FA','#4ADE80','#FB923C']
                  const color = colors[i % colors.length]
                  return (
                    <div key={topic.id} className="card" style={{ padding:18 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10 }}>
                        <div style={{ width:28, height:28, borderRadius:7, display:'flex', alignItems:'center',
                          justifyContent:'center', background:`${color}18`, border:`1px solid ${color}33` }}>
                          <Hash size={13} style={{ color }}/>
                        </div>
                        <div>
                          <p style={{ fontSize:13, fontWeight:700, color }}>{topic.label}</p>
                          <p style={{ fontSize:11, color:'var(--text3)' }}>{topic.count} entries</p>
                        </div>
                      </div>
                      <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                        {topic.keywords.map(kw => (
                          <span key={kw} style={{ fontSize:11, padding:'2px 8px', borderRadius:10,
                            background:`${color}12`, color, border:`1px solid ${color}25`,
                            fontFamily:'var(--mono)' }}>{kw}</span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'entries' && (
          <motion.div key="entries" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}>
            {/* Filter bar */}
            <div style={{ display:'flex', gap:6, marginBottom:14, alignItems:'center' }}>
              <span style={{ fontSize:12, color:'var(--text3)' }}>Filter:</span>
              {['positive','negative','neutral'].map(s => (
                <button key={s} onClick={() => handleFilter(s)}
                  style={{ fontSize:11, padding:'4px 12px', borderRadius:12, fontFamily:'var(--mono)',
                    background: filter===s ? SENT_COLOR[s]+'20' : 'var(--bg3)',
                    color: filter===s ? SENT_COLOR[s] : 'var(--text3)',
                    border:`1px solid ${filter===s ? SENT_COLOR[s]+'40' : 'var(--border)'}`,
                    transition:'all 0.15s' }}>
                  {s}
                </button>
              ))}
              {filter && (
                <button onClick={() => { setFilter(null); fetchEntries(dataset.id) }}
                  className="btn-ghost" style={{ fontSize:11, padding:'4px 10px' }}>Clear</button>
              )}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              {entries.map((e, i) => (
                <motion.div key={e.id} initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }}
                  transition={{ delay:i*0.02 }}
                  style={{ padding:'12px 14px', borderRadius:9, background:'var(--bg2)',
                    border:`1px solid ${SENT_COLOR[e.sentiment] || 'var(--border)'}25` }}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13, lineHeight:1.6, color:'var(--text)', marginBottom:6 }}>
                        {e.text.slice(0, 200)}{e.text.length > 200 ? '…' : ''}
                      </p>
                      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                        <SentimentPill sentiment={e.sentiment}/>
                        <span style={{ fontSize:11, color: EMOTION_COLOR[e.emotion] || 'var(--text3)' }}>
                          {EMOTION_EMOJI[e.emotion]} {e.emotion}
                        </span>
                        <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)' }}>
                          {Math.round((e.sentiment_score||0)*100)}% conf
                        </span>
                        {e.timestamp && (
                          <span style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)' }}>
                            {e.timestamp.slice(0,10)}
                          </span>
                        )}
                      </div>
                    </div>
                    {/* Mini score bar */}
                    <div style={{ display:'flex', gap:2, flexShrink:0 }}>
                      {[['pos', e.pos_score, 'var(--pos)'], ['neg', e.neg_score, 'var(--neg)'], ['neu', e.neu_score, 'var(--neu)']].map(([k,v,c]) => (
                        <div key={k} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                          <div style={{ width:4, height:40, background:'var(--bg4)', borderRadius:4, overflow:'hidden', display:'flex', flexDirection:'column', justifyContent:'flex-end' }}>
                            <div style={{ height:`${Math.round((v||0)*100)}%`, background:c, borderRadius:4 }}/>
                          </div>
                          <span style={{ fontSize:9, color:'var(--text3)', fontFamily:'var(--mono)' }}>{k}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Upload Panel ──────────────────────────────────────────────────────────────
function UploadPanel({ onClose }) {
  const { uploadCSV, createTextDataset, uploading, error } = useStore()
  const [tab, setTab] = useState('csv')
  const [file, setFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [name, setName] = useState('')
  const [textInput, setTextInput] = useState('')
  const fileRef = useRef()

  const handleSubmit = async () => {
    if (tab === 'csv' && file) {
      await uploadCSV(file, name || file.name)
      onClose()
    } else if (tab === 'text') {
      const lines = textInput.split('\n').filter(l => l.trim())
      if (!lines.length) return
      await createTextDataset(lines, name || 'Text Dataset')
      onClose()
    }
  }

  return (
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.8)', backdropFilter:'blur(6px)',
        zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
      <motion.div initial={{ scale:0.95 }} animate={{ scale:1 }}
        className="card" style={{ width:'100%', maxWidth:520, padding:28 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ fontWeight:700, fontSize:16 }}>New Dataset</h3>
          <button onClick={onClose} style={{ color:'var(--text3)', fontSize:18 }}>✕</button>
        </div>

        <div style={{ display:'flex', gap:4, marginBottom:18, background:'var(--bg3)',
          padding:3, borderRadius:8, border:'1px solid var(--border)' }}>
          {[{ id:'csv', label:'📄 Upload CSV' }, { id:'text', label:'✏️ Paste Text' }].map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ flex:1, padding:'7px', borderRadius:6, fontSize:12, fontWeight:600,
                transition:'all 0.15s',
                background: tab===id ? 'var(--bg5)' : 'transparent',
                color: tab===id ? 'var(--text)' : 'var(--text3)',
                border:`1px solid ${tab===id ? 'var(--border2)' : 'transparent'}` }}>
              {label}
            </button>
          ))}
        </div>

        <input className="input" value={name} onChange={e=>setName(e.target.value)}
          placeholder="Dataset name (optional)" style={{ marginBottom:12 }}/>

        {tab === 'csv' ? (
          <div onClick={() => fileRef.current?.click()}
            onDragOver={e=>{e.preventDefault();setDragOver(true)}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={e=>{e.preventDefault();setDragOver(false);setFile(e.dataTransfer.files[0])}}
            style={{ border:`2px dashed ${dragOver?'var(--cyan)':file?'var(--pos)':'var(--border2)'}`,
              borderRadius:10, padding:'28px 20px', textAlign:'center', cursor:'pointer',
              background:dragOver?'var(--cyan-soft)':'var(--bg3)', transition:'all 0.15s' }}>
            <input ref={fileRef} type="file" accept=".csv" style={{ display:'none' }}
              onChange={e=>setFile(e.target.files[0])}/>
            {file
              ? <p style={{ fontWeight:600 }}>✓ {file.name}</p>
              : <><Upload size={22} style={{ color:'var(--text3)', margin:'0 auto 8px' }}/>
                <p style={{ fontWeight:600, fontSize:14 }}>Drop CSV here</p>
                <p style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>
                  Needs a text/content/review/comment column
                </p></>
            }
          </div>
        ) : (
          <>
            <textarea className="input" value={textInput} onChange={e=>setTextInput(e.target.value)}
              placeholder="One entry per line:&#10;This product is amazing!&#10;Terrible customer service&#10;It was okay I guess…"
              style={{ minHeight:140, resize:'vertical', lineHeight:1.6, fontSize:12 }}/>
            <p style={{ fontSize:11, color:'var(--text3)', marginTop:5 }}>
              {textInput.split('\n').filter(l=>l.trim()).length} entries
            </p>
          </>
        )}

        {error && (
          <div style={{ marginTop:10, padding:'8px 12px', borderRadius:8,
            background:'rgba(244,63,94,0.08)', border:'1px solid rgba(244,63,94,0.2)',
            display:'flex', gap:6, alignItems:'center' }}>
            <AlertCircle size={12} style={{ color:'var(--neg)', flexShrink:0 }}/>
            <p style={{ fontSize:12, color:'var(--neg)' }}>{error}</p>
          </div>
        )}

        <button onClick={handleSubmit} disabled={uploading || (tab==='csv'&&!file) || (tab==='text'&&!textInput.trim())}
          className="btn-primary"
          style={{ width:'100%', marginTop:16, display:'flex', alignItems:'center', justifyContent:'center', gap:7 }}>
          {uploading
            ? <><Loader2 size={13} style={{ animation:'spin 0.7s linear infinite' }}/> Processing…</>
            : <><Brain size={13}/> Analyze with ML</>
          }
        </button>
      </motion.div>
    </motion.div>
  )
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const { datasets, activeDataset, entries, loading, fetchDatasets, setActiveDataset, deleteDataset } = useStore()
  const [showUpload, setShowUpload] = useState(false)
  const [view, setView] = useState('dashboard') // dashboard | live

  useEffect(() => { fetchDatasets() }, [])

  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width:260, flexShrink:0, background:'var(--bg2)',
        borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column' }}>

        {/* Logo */}
        <div style={{ padding:'18px 16px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
            <div style={{ width:34, height:34, borderRadius:10, display:'flex', alignItems:'center',
              justifyContent:'center', background:'var(--cyan-soft)',
              border:'1px solid rgba(34,211,238,0.2)', boxShadow:'0 0 20px var(--cyan-glow)' }}>
              <BarChart2 size={16} style={{ color:'var(--cyan)' }}/>
            </div>
            <div>
              <p style={{ fontWeight:800, fontSize:15 }}>SentimentIQ</p>
              <p style={{ fontSize:10, color:'var(--text3)' }}>ML Sentiment Dashboard</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <div style={{ padding:'10px 10px', borderBottom:'1px solid var(--border)' }}>
          {[
            { id:'dashboard', icon:BarChart2, label:'Dashboard' },
            { id:'live', icon:Activity, label:'Live Analyzer' },
          ].map(({ id, icon:Icon, label }) => (
            <button key={id} onClick={() => setView(id)}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'8px 10px',
                borderRadius:8, fontSize:13, fontWeight:500, transition:'all 0.15s', marginBottom:2,
                background: view===id ? 'var(--bg4)' : 'transparent',
                color: view===id ? 'var(--cyan)' : 'var(--text2)',
                border:`1px solid ${view===id ? 'var(--border2)' : 'transparent'}` }}>
              <Icon size={13}/>{label}
            </button>
          ))}
        </div>

        {/* Datasets */}
        <div style={{ padding:'10px 10px 4px' }}>
          <p style={{ fontSize:10, color:'var(--text3)', fontFamily:'var(--mono)',
            textTransform:'uppercase', letterSpacing:'0.08em', padding:'0 4px', marginBottom:6 }}>
            Datasets ({datasets.length})
          </p>
        </div>
        <div style={{ flex:1, overflow:'auto', padding:'0 8px' }}>
          {datasets.length === 0 && (
            <div style={{ textAlign:'center', padding:'28px 12px', color:'var(--text3)' }}>
              <BarChart2 size={20} style={{ margin:'0 auto 8px', opacity:0.2 }}/>
              <p style={{ fontSize:12 }}>No datasets yet</p>
            </div>
          )}
          {datasets.map(d => (
            <div key={d.id} onClick={() => { setActiveDataset(d); setView('dashboard') }}
              style={{ padding:'9px 10px', borderRadius:9, marginBottom:3, cursor:'pointer',
                transition:'all 0.12s',
                background: activeDataset?.id===d.id ? 'var(--bg4)' : 'transparent',
                border:`1px solid ${activeDataset?.id===d.id ? 'var(--border2)' : 'transparent'}` }}
              onMouseEnter={e=>{ if(activeDataset?.id!==d.id) e.currentTarget.style.background='var(--bg3)' }}
              onMouseLeave={e=>{ if(activeDataset?.id!==d.id) e.currentTarget.style.background='transparent' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:6 }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:12, fontWeight:600, overflow:'hidden',
                    textOverflow:'ellipsis', whiteSpace:'nowrap', marginBottom:3 }}>{d.name}</p>
                  <StatusDot status={d.status}/>
                  {d.status==='ready' && (
                    <p style={{ fontSize:10, color:'var(--text3)', marginTop:2, fontFamily:'var(--mono)' }}>
                      {d.total_rows} rows
                    </p>
                  )}
                </div>
                <button onClick={e=>{e.stopPropagation();deleteDataset(d.id)}}
                  style={{ color:'var(--text4)', padding:3, flexShrink:0 }}
                  onMouseEnter={e=>e.currentTarget.style.color='var(--neg)'}
                  onMouseLeave={e=>e.currentTarget.style.color='var(--text4)'}>
                  <Trash2 size={11}/>
                </button>
              </div>
            </div>
          ))}
        </div>

        <div style={{ padding:'12px', borderTop:'1px solid var(--border)' }}>
          <button onClick={() => setShowUpload(true)} className="btn-primary"
            style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center',
              gap:6, fontSize:12, padding:'8px' }}>
            <Plus size={12}/> New Dataset
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex:1, overflow:'auto', padding:'24px 28px' }}>
        {view === 'live' ? (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>
            <div style={{ marginBottom:20 }}>
              <h2 style={{ fontWeight:700, fontSize:20, marginBottom:4 }}>Live Analyzer</h2>
              <p style={{ color:'var(--text2)', fontSize:13 }}>
                Type any text and get real-time sentiment and emotion analysis from the ML model.
              </p>
            </div>
            <LiveAnalyzer/>
          </motion.div>
        ) : !activeDataset ? (
          <motion.div initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}
            style={{ display:'flex', flexDirection:'column', alignItems:'center',
              justifyContent:'center', height:'100%', textAlign:'center' }}>
            <div style={{ width:64, height:64, borderRadius:16, margin:'0 auto 20px',
              background:'var(--cyan-soft)', border:'1px solid rgba(34,211,238,0.2)',
              display:'flex', alignItems:'center', justifyContent:'center',
              boxShadow:'0 0 40px var(--cyan-glow)' }}>
              <BarChart2 size={28} style={{ color:'var(--cyan)' }}/>
            </div>
            <h1 style={{ fontSize:28, fontWeight:800, marginBottom:8 }}>SentimentIQ</h1>
            <p style={{ color:'var(--text2)', fontSize:15, maxWidth:420, lineHeight:1.7, marginBottom:28 }}>
              Real ML sentiment analysis. Upload a CSV or paste text entries → get sentiment scores,
              emotion breakdown, topic clustering, and trend charts.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, maxWidth:460, marginBottom:28 }}>
              {[
                { icon:'🤖', label:'RoBERTa model', desc:'cardiffnlp sentiment' },
                { icon:'❤️', label:'7 emotions', desc:'j-hartmann model' },
                { icon:'🔍', label:'Topic clusters', desc:'TF-IDF + KMeans' },
              ].map(({ icon, label, desc }) => (
                <div key={label} style={{ padding:'14px', borderRadius:10, background:'var(--bg2)',
                  border:'1px solid var(--border)', textAlign:'center' }}>
                  <div style={{ fontSize:22, marginBottom:6 }}>{icon}</div>
                  <p style={{ fontSize:12, fontWeight:700, marginBottom:2 }}>{label}</p>
                  <p style={{ fontSize:11, color:'var(--text3)' }}>{desc}</p>
                </div>
              ))}
            </div>
            <button onClick={() => setShowUpload(true)} className="btn-primary"
              style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'11px 28px', fontSize:14 }}>
              <Upload size={15}/> Upload Dataset
            </button>
          </motion.div>
        ) : activeDataset.status === 'analyzing' || activeDataset.status === 'pending' ? (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
            style={{ display:'flex', flexDirection:'column', alignItems:'center',
              justifyContent:'center', height:'100%', textAlign:'center' }}>
            <Loader2 size={40} style={{ color:'var(--cyan)', animation:'spin 1s linear infinite', marginBottom:16 }}/>
            <h3 style={{ fontWeight:700, fontSize:18, marginBottom:6 }}>Analyzing {activeDataset.name}</h3>
            <p style={{ color:'var(--text2)', fontSize:13, marginBottom:8 }}>
              Running RoBERTa sentiment model + emotion classifier on {activeDataset.total_rows} entries…
            </p>
            <p style={{ color:'var(--text3)', fontSize:12 }}>This takes 1-3 minutes depending on dataset size</p>
          </motion.div>
        ) : activeDataset.status === 'error' ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center',
            justifyContent:'center', height:'100%', textAlign:'center', color:'var(--text2)' }}>
            <AlertCircle size={32} style={{ color:'var(--neg)', marginBottom:12 }}/>
            <p style={{ fontWeight:600 }}>Analysis failed</p>
            <p style={{ fontSize:12, marginTop:6, color:'var(--text3)' }}>{activeDataset.error_msg}</p>
          </div>
        ) : (
          <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <div style={{ flex:1 }}>
                <h2 style={{ fontWeight:700, fontSize:20, marginBottom:2 }}>{activeDataset.name}</h2>
                <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                  <StatusDot status={activeDataset.status}/>
                  <span style={{ fontSize:11, color:'var(--text3)', fontFamily:'var(--mono)' }}>
                    {activeDataset.total_rows} entries · {activeDataset.source_type}
                  </span>
                  {activeDataset.analyzed_at && (
                    <span style={{ fontSize:11, color:'var(--text3)' }}>
                      analyzed {formatDistanceToNow(new Date(activeDataset.analyzed_at), { addSuffix:true })}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <Dashboard dataset={activeDataset} entries={entries}/>
          </motion.div>
        )}
      </main>

      <AnimatePresence>
        {showUpload && <UploadPanel onClose={() => setShowUpload(false)}/>}
      </AnimatePresence>
    </div>
  )
}
