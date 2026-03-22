import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import GoBoard from './components/GoBoard'
import GameInfo from './components/GameInfo'
import VariationTree from './components/VariationTree'
import PatternSearch from './components/PatternSearch'
import ProblemView from './components/ProblemView'
import { useGameTree } from './hooks/useGameTree'
import { useKataGo } from './hooks/useKataGo'
import { buildPatternTemplate } from './lib/buildPatternTemplate'
import './App.css'

function App() {
  const [boardSize, setBoardSize] = useState(19)
  const [boardWidth, setBoardWidth] = useState(780)
  const [boardMode, setBoardMode] = useState('analyze')
  const [annotationTool, setAnnotationTool] = useState('stone') // 'stone'|'letter'|'number'|'square'|'eraser'
  const [annotationVersion, setAnnotationVersion] = useState(0)
  const [selection, setSelection] = useState(null)
  const [savedSelection, setSavedSelection] = useState(null)
  const [savedPosition, setSavedPosition] = useState(null)
  const [viewingHit, setViewingHit] = useState(false)
  const fileInputRef = useRef(null)

  // Problem state
  const [problemActive, setProblemActive] = useState(false)
  const [problemData, setProblemData] = useState(null)
  const [problemMoveNumber, setProblemMoveNumber] = useState(null)
  const [answerResult, setAnswerResult] = useState(null)
  const [showAnswerOnBoard, setShowAnswerOnBoard] = useState(false)

  const {
    stones, currentTurn, moveNumber, lastMove,
    rootNode, currentNode, version,
    playMove, undo, redo, goToStart, goToEnd, goBackN, goForwardN,
    goToNode, loadSgf, saveSnapshot, restoreSnapshot, reset,
  } = useGameTree(boardSize)

  // Extract game info from root node for KataGo and GameInfo panel
  const rootProps = rootNode?.props || {}
  const gameInfo = {
    komi: rootProps.KM ?? null,
    rules: rootProps.RU || null,
  }

  // KataGo
  const { analyzing, topMoves, bestMove, blackWinrate, blackScoreLead, toggleAnalysis, startAnalysis, stopAnalysis, loadCacheFromNode } = useKataGo(boardSize, gameInfo)

  // Keyboard shortcuts: spacebar = toggle analysis, left/right = navigate
  useEffect(() => {
    const handleKey = (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        toggleAnalysis(currentNode)
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        undo()
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [toggleAnalysis, currentNode, boardMode, undo, redo])

  // When navigating: if analyzing, re-send position; if stopped, load cached data
  useEffect(() => {
    if (currentNode) {
      if (analyzing) {
        startAnalysis(currentNode)
      } else {
        // Show cached analysis for this node (if any)
        loadCacheFromNode(currentNode)
      }
    }
  }, [currentNode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset game tree when board size changes
  useEffect(() => {
    reset(boardSize)
    setSelection(null); setSavedPosition(null); setSavedSelection(null)
    setViewingHit(false); setProblemActive(false); setProblemData(null); setAnswerResult(null)
    stopAnalysis()
  }, [boardSize])

  // Clear state when switching modes — but keep pattern search results persistent
  useEffect(() => {
    if (boardMode !== 'problem') {
      setProblemActive(false); setProblemData(null); setAnswerResult(null)
    }
    // Don't clear pattern search hits or saved position when switching modes
    // Only clear the rectangle selection when leaving pattern mode
    if (boardMode !== 'pattern') {
      // Keep selection, savedPosition, etc. — they're needed for "Return to Original"
    }
  }, [boardMode])

  // Add annotation to current node's SGF properties (all stored as LB)
  // Matches Vue app behavior: letters (A-Z) or numbers (1,2,3...)
  // - Click on empty: add next available letter/number
  // - Click on existing same-type: remove it
  // - Click on existing different-type: replace it
  // - Eraser: remove any annotation at that coord
  const addAnnotation = useCallback((x, y, tool) => {
    if (!currentNode) return
    const coord = String.fromCharCode(97 + x) + String.fromCharCode(97 + y)
    const props = currentNode.props

    // Square uses SQ property (toggle on/off)
    if (tool === 'square') {
      const sq = Array.isArray(props.SQ) ? [...props.SQ] : (props.SQ ? [props.SQ] : [])
      const sqIdx = sq.indexOf(coord)
      if (sqIdx >= 0) {
        sq.splice(sqIdx, 1)
      } else {
        sq.push(coord)
      }
      props.SQ = sq.length === 0 ? undefined : sq.length === 1 ? sq[0] : sq
      return
    }

    // LB-based tools: letter, number, eraser
    const lb = Array.isArray(props.LB) ? [...props.LB] : (props.LB ? [props.LB] : [])
    const existingIdx = lb.findIndex((e) => e.startsWith(coord + ':'))
    const existingValue = existingIdx >= 0 ? lb[existingIdx].split(':')[1] : null

    if (tool === 'eraser') {
      if (existingIdx >= 0) lb.splice(existingIdx, 1)
      // Also remove SQ at this coord
      if (props.SQ) {
        const sq = Array.isArray(props.SQ) ? [...props.SQ] : [props.SQ]
        const sqIdx = sq.indexOf(coord)
        if (sqIdx >= 0) { sq.splice(sqIdx, 1); props.SQ = sq.length === 0 ? undefined : sq.length === 1 ? sq[0] : sq }
      }
    } else if (tool === 'letter') {
      const isLetter = existingValue && /^[A-Z]$/.test(existingValue)
      if (isLetter) {
        lb.splice(existingIdx, 1)
      } else {
        if (existingIdx >= 0) lb.splice(existingIdx, 1)
        const usedValues = lb.map((a) => a.split(':')[1])
        const available = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').find((l) => !usedValues.includes(l))
        if (available) lb.push(`${coord}:${available}`)
      }
    } else if (tool === 'number') {
      const isNumber = existingValue && /^\d+$/.test(existingValue)
      if (isNumber) {
        lb.splice(existingIdx, 1)
      } else {
        if (existingIdx >= 0) lb.splice(existingIdx, 1)
        const usedValues = lb.map((a) => a.split(':')[1])
        let num = 1
        while (usedValues.includes(String(num))) num++
        lb.push(`${coord}:${num}`)
      }
    }

    props.LB = lb.length === 0 ? undefined : lb.length === 1 ? lb[0] : lb
  }, [currentNode])

  const handleClick = ({ x, y }) => {
    if (boardMode === 'problem' && problemActive) {
      handleProblemClick(x, y)
      return
    }
    if (boardMode === 'analyze' && annotationTool !== 'stone') {
      addAnnotation(x, y, annotationTool)
      setAnnotationVersion((v) => v + 1) // force re-render for annotations
      return
    }
    playMove(x, y)
  }

  const handleProblemClick = (x, y) => {
    if (!problemData || answerResult === 'correct') return
    if (moveNumber !== problemMoveNumber) return
    const sgfCoord = `${String.fromCharCode(97 + x)}${String.fromCharCode(97 + y)}`
    if (problemData.correctAnswers.includes(sgfCoord)) {
      setAnswerResult('correct')
      playMove(x, y)
    } else {
      setAnswerResult('wrong')
    }
  }

  const handleFileOpen = (event) => {
    const file = event.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (e) => {
      try { loadSgf(e.target.result) }
      catch (err) { alert('Failed to load SGF: ' + err.message) }
    }
    reader.readAsText(file)
    event.target.value = ''
  }

  // Pattern search
  const buildTemplate = useCallback(() => {
    if (!selection || !currentNode?.board) return null
    return buildPatternTemplate(currentNode.board, selection, boardSize)
  }, [selection, currentNode, boardSize])

  const handleLoadHit = useCallback(async (hit) => {
    if (!savedPosition) {
      setSavedPosition(saveSnapshot()); setSavedSelection(selection)
    }
    setViewingHit(true)
    // Switch to analyze mode so clicks place stones instead of drawing selection
    setBoardMode('analyze')
    try {
      const resp = await fetch(`http://localhost:8000/api/sgf/file?file=${encodeURIComponent(hit.sgf_file)}`)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      loadSgf(await resp.text())
      setTimeout(() => { goToStart(); goForwardN(hit.move_number) }, 50)
    } catch (err) { alert('Failed to load game: ' + err.message) }
  }, [loadSgf, goToStart, goForwardN, savedPosition, saveSnapshot, selection])

  const handleRestorePosition = useCallback(() => {
    if (!savedPosition) return
    restoreSnapshot(savedPosition)
    setSelection(savedSelection); setSavedPosition(null); setSavedSelection(null); setViewingHit(false)
  }, [savedPosition, savedSelection, restoreSnapshot])

  const handleLoadProblem = useCallback(({ sgfContent, moveNumber: mn, correctAnswers, problem }) => {
    loadSgf(sgfContent)
    setProblemData({ correctAnswers, description: problem.description, problem })
    setProblemMoveNumber(mn); setAnswerResult(null); setProblemActive(true)
    setTimeout(() => { goToStart(); goForwardN(mn) }, 50)
  }, [loadSgf, goToStart, goForwardN])

  const visibleSelection = viewingHit ? null : selection

  // Extract SGF labels (LB, CR, TR, SQ, MA) from current node
  const sgfLabels = useMemo(() => {
    const props = currentNode?.props || {}
    const labels = []

    // LB — text labels, format "coord:text"
    if (props.LB) {
      const entries = Array.isArray(props.LB) ? props.LB : [props.LB]
      for (const entry of entries) {
        const [coord, text] = entry.split(':')
        if (coord?.length === 2 && text) {
          const x = coord.charCodeAt(0) - 97
          const y = coord.charCodeAt(1) - 97
          labels.push({ x, y, type: 'label', text })
        }
      }
    }

    // CR — circles
    if (props.CR) {
      const entries = Array.isArray(props.CR) ? props.CR : [props.CR]
      for (const coord of entries) {
        if (coord?.length === 2) {
          labels.push({ x: coord.charCodeAt(0) - 97, y: coord.charCodeAt(1) - 97, type: 'circle' })
        }
      }
    }

    // TR — triangles
    if (props.TR) {
      const entries = Array.isArray(props.TR) ? props.TR : [props.TR]
      for (const coord of entries) {
        if (coord?.length === 2) {
          labels.push({ x: coord.charCodeAt(0) - 97, y: coord.charCodeAt(1) - 97, type: 'triangle' })
        }
      }
    }

    // SQ — squares
    if (props.SQ) {
      const entries = Array.isArray(props.SQ) ? props.SQ : [props.SQ]
      for (const coord of entries) {
        if (coord?.length === 2) {
          labels.push({ x: coord.charCodeAt(0) - 97, y: coord.charCodeAt(1) - 97, type: 'square' })
        }
      }
    }

    // MA — X marks
    if (props.MA) {
      const entries = Array.isArray(props.MA) ? props.MA : [props.MA]
      for (const coord of entries) {
        if (coord?.length === 2) {
          labels.push({ x: coord.charCodeAt(0) - 97, y: coord.charCodeAt(1) - 97, type: 'xmark' })
        }
      }
    }

    return labels
  }, [currentNode, annotationVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  // Extract comment from current node
  const comment = currentNode?.props?.C || ''

  const answerMarkers = (showAnswerOnBoard && problemData?.correctAnswers)
    ? problemData.correctAnswers.map((c) => ({
        x: c.charCodeAt(0) - 97, y: c.charCodeAt(1) - 97, type: 'answer',
      }))
    : []

  // Winrate bar — use pre-computed absolute values from the hook
  // (blackWinrate and blackScoreLead are already in Black's perspective)
  const scoreLeadText = blackScoreLead !== null
    ? `${blackScoreLead >= 0 ? 'B' : 'W'} +${Math.abs(blackScoreLead).toFixed(1)}`
    : ''

  const [showNewGameDialog, setShowNewGameDialog] = useState(false)
  const [newGameSize, setNewGameSize] = useState(19)
  const [newGameKomi, setNewGameKomi] = useState('6.5')
  const [newGameRules, setNewGameRules] = useState('Japanese')
  const [newGameHandicap, setNewGameHandicap] = useState(0)

  const handleNewGame = () => {
    setBoardSize(newGameSize)
    reset(newGameSize)
    setShowNewGameDialog(false)
  }

  return (
    <div className="app">
      <input type="file" ref={fileInputRef} style={{ display: 'none' }}
        accept=".sgf" onChange={handleFileOpen} />

      <div className="header-row">
        <h1 className="app-title">GoTrainer</h1>

        <div className="toolbar">
          <button onClick={() => fileInputRef.current?.click()} title="Open SGF" className="open-btn">
            📂 Open
          </button>

          <label className="mode-select">
            <select value={boardMode} onChange={(e) => { setBoardMode(e.target.value); setAnnotationTool('stone') }}>
              <option value="analyze">🔍 Analyze</option>
              <option value="pattern">🔲 Pattern</option>
              <option value="problem">📝 Problem</option>
            </select>
          </label>

          <button
            onClick={() => toggleAnalysis(currentNode)}
            title="Toggle KataGo analysis (Spacebar)"
            className={analyzing ? 'analyze-btn analyzing' : 'analyze-btn'}
          >
            {analyzing ? '⏹ Stop' : '🤖 Analyze'}
          </button>

          <button
            onClick={() => setShowNewGameDialog(true)}
            title="New game"
            className="reset-btn"
          >
            New Game
          </button>
        </div>

      </div>

      <div className="main-layout">
        <div className="board-column">
          <GoBoard
            size={boardSize}
            width={`${boardWidth}px`}
            stones={stones}
            lastMove={lastMove}
            mode={boardMode === 'pattern' ? 'pattern' : (annotationTool === 'stone' ? 'play' : 'annotate')}
            currentTurn={currentTurn}
            selection={visibleSelection}
            markers={answerMarkers}
            sgfLabels={sgfLabels}
            katagoMoves={topMoves}
            onSelectionChange={setSelection}
            onIntersectionClick={handleClick}
          />
          <div className="nav-controls">
            <button onClick={goToStart} title="Go to start">⏮</button>
            <button onClick={() => goBackN(10)} title="Back 10">⏪</button>
            <button onClick={undo} title="Undo">◀</button>
            <span className="move-counter">Move {moveNumber}</span>
            <button onClick={redo} title="Redo">▶</button>
            <button onClick={() => goForwardN(10)} title="Forward 10">⏩</button>
            <button onClick={goToEnd} title="Go to end">⏭</button>
          </div>
        </div>

        {/* Vertical resize handle */}
        <div
          className="resize-handle"
          onMouseDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const startWidth = boardWidth
            const onMove = (ev) => {
              const newWidth = Math.min(900, Math.max(200, startWidth + (ev.clientX - startX)))
              setBoardWidth(newWidth)
            }
            const onUp = () => {
              document.removeEventListener('mousemove', onMove)
              document.removeEventListener('mouseup', onUp)
              document.body.style.cursor = ''
              document.body.style.userSelect = ''
            }
            document.addEventListener('mousemove', onMove)
            document.addEventListener('mouseup', onUp)
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
          }}
        >
          <div className="resize-handle-line" />
        </div>

        <div className="side-panel">
          {/* Winrate bar + point loss */}
          {blackWinrate !== null && (
            <div className="winrate-section">
              <div className="winrate-bar-wrapper">
                <span className="winrate-label">⚫ {Math.round(blackWinrate)}%</span>
                <div className="winrate-bar">
                  <div className="winrate-fill-black" style={{ width: `${blackWinrate}%` }} />
                  <div className="winrate-fill-white" style={{ width: `${100 - blackWinrate}%` }} />
                </div>
                <span className="winrate-label">⚪ {Math.round(100 - blackWinrate)}%</span>
              </div>
              <div className="winrate-details">
                <span className="score-lead-label">{scoreLeadText}</span>
                <span className="point-loss">
                  {(() => {
                    const parentCache = currentNode?.parent?._katagoCache
                    if (!parentCache || blackScoreLead === null) return 'Last move: N/A'
                    const diff = Math.abs(blackScoreLead) - Math.abs(parentCache.blackScoreLead)
                    // Positive diff = the current player's position got worse
                    const loss = parentCache.blackScoreLead >= 0
                      ? parentCache.blackScoreLead - blackScoreLead  // Black was ahead
                      : blackScoreLead - parentCache.blackScoreLead  // White was ahead (inverted)
                    // Simplify: just compare score leads from the perspective of the player who moved
                    const lastPlayerWasBlack = currentNode?.color === 'B'
                    const prevLead = parentCache.blackScoreLead
                    const curLead = blackScoreLead
                    const pointChange = lastPlayerWasBlack
                      ? curLead - prevLead  // Black moved: positive = good for black
                      : prevLead - curLead  // White moved: positive = good for white
                    if (pointChange >= 0) return `Last move: +${pointChange.toFixed(1)}`
                    return `Last move: ${pointChange.toFixed(1)}`
                  })()}
                </span>
              </div>
            </div>
          )}

          <GameInfo rootNode={rootNode} currentNode={currentNode} />

          {/* Annotation toolbar — in side panel when in analyze mode */}
          {boardMode === 'analyze' && (
            <div className="annotation-toolbar">
              {[
                { id: 'stone', icon: '⚫', label: 'Place Stone' },
                { id: 'letter', icon: 'A', label: 'Letter Label (A-Z)' },
                { id: 'number', icon: '#', label: 'Number Label (1,2,3...)' },
                { id: 'square', icon: '□', label: 'Square Marker' },
                { id: 'eraser', icon: '✕', label: 'Erase Annotation' },
              ].map((tool) => (
                <button
                  key={tool.id}
                  className={`ann-tool ${annotationTool === tool.id ? 'ann-tool-active' : ''}`}
                  onClick={() => setAnnotationTool(tool.id)}
                  title={tool.label}
                >
                  {tool.icon}
                </button>
              ))}
            </div>
          )}

          {/* Comment box — always visible, editable */}
          <div className="comment-box-wrapper">
            <textarea
              className="comment-box"
              value={comment}
              placeholder="Add a comment…"
              onChange={(e) => {
                if (currentNode) {
                  currentNode.props.C = e.target.value || undefined
                }
              }}
            />
            <div
              className="comment-resize-handle"
              onMouseDown={(e) => {
                e.preventDefault()
                const wrapper = e.target.parentElement
                const box = wrapper.querySelector('.comment-box')
                const startY = e.clientY
                const startH = box.offsetHeight
                const onMove = (ev) => {
                  box.style.height = Math.max(32, startH + (ev.clientY - startY)) + 'px'
                }
                const onUp = () => {
                  document.removeEventListener('mousemove', onMove)
                  document.removeEventListener('mouseup', onUp)
                  document.body.style.cursor = ''
                  document.body.style.userSelect = ''
                }
                document.addEventListener('mousemove', onMove)
                document.addEventListener('mouseup', onUp)
                document.body.style.cursor = 'row-resize'
                document.body.style.userSelect = 'none'
              }}
            />
          </div>

          <VariationTree
            rootNode={rootNode} currentNode={currentNode}
            onSelectNode={goToNode} version={version}
          />

          {(boardMode === 'pattern' || viewingHit || savedPosition) && (
            <PatternSearch
              selection={selection} currentNode={currentNode}
              onLoadHit={handleLoadHit}
              onClearSelection={() => {
                setSelection(null); setSavedPosition(null); setSavedSelection(null); setViewingHit(false)
              }}
              buildTemplate={buildTemplate}
              savedPosition={savedPosition}
              onRestorePosition={() => {
                handleRestorePosition()
                setBoardMode('pattern') // go back to pattern mode to see the selection
              }}
            />
          )}

          {boardMode === 'problem' && (
            <ProblemView
              onLoadProblem={handleLoadProblem} currentNode={currentNode}
              problemActive={problemActive} problemData={problemData}
              answerResult={answerResult} onShowAnswerChange={setShowAnswerOnBoard}
            />
          )}
        </div>
      </div>

      {/* New Game dialog */}
      {showNewGameDialog && (
        <div className="modal-overlay" onClick={() => setShowNewGameDialog(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h2>New Game</h2>
            <div className="modal-form">
              <label>
                Board Size
                <select value={newGameSize} onChange={(e) => setNewGameSize(Number(e.target.value))}>
                  <option value={9}>9×9</option>
                  <option value={13}>13×13</option>
                  <option value={19}>19×19</option>
                </select>
              </label>
              <label>
                Komi
                <input type="number" step="0.5" value={newGameKomi}
                  onChange={(e) => setNewGameKomi(e.target.value)} />
              </label>
              <label>
                Rules
                <select value={newGameRules} onChange={(e) => setNewGameRules(e.target.value)}>
                  <option value="Japanese">Japanese</option>
                  <option value="Chinese">Chinese</option>
                  <option value="Korean">Korean</option>
                  <option value="AGA">AGA</option>
                  <option value="New Zealand">New Zealand</option>
                </select>
              </label>
              <label>
                Handicap
                <select value={newGameHandicap} onChange={(e) => setNewGameHandicap(Number(e.target.value))}>
                  <option value={0}>None</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={4}>4</option>
                  <option value={5}>5</option>
                  <option value={6}>6</option>
                  <option value={7}>7</option>
                  <option value={8}>8</option>
                  <option value={9}>9</option>
                </select>
              </label>
            </div>
            <div className="modal-actions">
              <button className="modal-cancel" onClick={() => setShowNewGameDialog(false)}>Cancel</button>
              <button className="modal-confirm" onClick={handleNewGame}>Start Game</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
