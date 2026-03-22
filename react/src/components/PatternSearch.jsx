import { useState, useRef, useCallback } from 'react'
import './PatternSearch.css'

/**
 * PatternSearch — UI for pattern search: controls + results list.
 *
 * Props:
 *   selection        — { x1, y1, x2, y2 } | null
 *   currentNode      — current GameNode (to determine next-to-play)
 *   onLoadHit        — callback (hit) => void — load a search result
 *   onClearSelection — callback () => void — clear the selection
 *   buildTemplate    — callback () => number[][] | null — build pattern template
 */
export default function PatternSearch({
  selection,
  currentNode,
  onLoadHit,
  onClearSelection,
  buildTemplate,
  savedPosition,
  onRestorePosition,
}) {
  const [hits, setHits] = useState([])
  const [searching, setSearching] = useState(false)
  const [progress, setProgress] = useState(null)
  const [done, setDone] = useState(false)
  const [lastFile, setLastFile] = useState(null)
  const [currentHitIdx, setCurrentHitIdx] = useState(-1)
  const [nextToPlay, setNextToPlay] = useState('B')
  const wsRef = useRef(null)
  const cachedTemplateRef = useRef(null)
  const cachedTurnRef = useRef(null)

  // Connect directly to FastAPI backend for WebSocket
  // (Vite's HTTP proxy works for REST but WS proxying can be unreliable)
  const WS_URL = `ws://${window.location.hostname}:8000/ws/patternsearch`

  const startSearch = useCallback((startAfter = null) => {
    let template
    let patternTurn

    if (startAfter && cachedTemplateRef.current) {
      // "Search More" — reuse the cached pattern from the original search
      template = cachedTemplateRef.current
      patternTurn = cachedTurnRef.current
    } else {
      // Fresh search — build and cache the template
      template = buildTemplate?.()
      if (!template) {
        alert('No pattern selected. Drag a rectangle on the board first.')
        return
      }
      patternTurn = nextToPlay === 'B' ? 1 : 2
      cachedTemplateRef.current = template
      cachedTurnRef.current = patternTurn
    }

    console.log('[PatternSearch] Sending template:')
    console.log('  pattern_turn:', patternTurn, `(last move: ${nextToPlay})`)
    console.log('  template:', JSON.stringify(template))

    // Close previous connection
    if (wsRef.current) {
      try { wsRef.current.close() } catch {}
    }

    setSearching(true)
    setDone(false)
    setProgress(null)
    if (!startAfter) {
      setHits([])
      setCurrentHitIdx(-1)
      setLastFile(null)
    }

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'start',
        pattern_template: template,
        pattern_turn: patternTurn,
        max_files: 100,
        start_after: startAfter,
      }))
    }

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'hit') {
        setHits((prev) => [...prev, msg])
      } else if (msg.type === 'progress') {
        setProgress(msg)
      } else if (msg.type === 'done') {
        setSearching(false)
        setDone(true)
        if (msg.lastFile) setLastFile(msg.lastFile)
      } else if (msg.type === 'error') {
        console.error('Pattern search error:', msg.message)
        setSearching(false)
      }
    }

    ws.onerror = () => setSearching(false)
    ws.onclose = () => setSearching(false)
  }, [buildTemplate, nextToPlay])

  const cancelSearch = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'cancel' }))
    }
  }, [])

  const loadHit = (hit, idx) => {
    setCurrentHitIdx(idx)
    onLoadHit?.(hit)
  }

  const hasSelection = selection !== null

  return (
    <div className="pattern-search">
      <h3>Pattern Search</h3>

      <div className="ps-controls">
        <label>
          Last move played:{' '}
          <select value={nextToPlay} onChange={(e) => setNextToPlay(e.target.value)}>
            <option value="B">⚫ Black</option>
            <option value="W">⚪ White</option>
          </select>
        </label>

        <div className="ps-buttons">
          <button
            onClick={() => startSearch()}
            disabled={!hasSelection || searching}
          >
            {searching ? '🔍 Searching…' : '🔍 Search'}
          </button>
          {searching && <button onClick={cancelSearch}>⏹ Cancel</button>}
          {done && (
            <button onClick={() => startSearch(lastFile)}>
              Search More
            </button>
          )}
          <button onClick={onClearSelection}>Clear</button>
          {savedPosition && (
            <button onClick={onRestorePosition} className="ps-restore-btn">
              ↩ Return to Original
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      {searching && progress && (
        <div className="ps-progress">
          {progress.scanned}/{progress.total} files scanned
        </div>
      )}

      {/* No results */}
      {done && hits.length === 0 && (
        <div className="ps-no-results">No matches found.</div>
      )}

      {/* Results list */}
      {hits.length > 0 && (
        <div className="ps-results">
          <div className="ps-results-header">
            {hits.length} result{hits.length !== 1 ? 's' : ''}
            {currentHitIdx >= 0 && ` — viewing ${currentHitIdx + 1}`}
          </div>
          <div className="ps-results-list">
            {hits.map((hit, i) => {
              const filename = (hit.sgf_file || '')
                .split('/').pop()
                .replace(/^__go4go_/, '')
                .replace(/\.sgf$/i, '')
              return (
                <div
                  key={`${hit.sgf_file}-${hit.move_number}`}
                  className={`ps-hit ${i === currentHitIdx ? 'ps-hit-active' : ''}`}
                  onClick={() => loadHit(hit, i)}
                >
                  <span className="ps-hit-name">{filename}</span>
                  <span className="ps-hit-move">Move {hit.move_number}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
