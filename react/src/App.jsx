import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import GoBoard from './components/GoBoard'
import GameInfo from './components/GameInfo'
import VariationTree from './components/VariationTree'
import PatternSearch from './components/PatternSearch'
import ProblemView from './components/ProblemView'
import ProblemAuthor from './components/ProblemAuthor'
import { useGameTree } from './hooks/useGameTree'
import { useKataGo } from './hooks/useKataGo'
import { buildPatternTemplate } from './lib/buildPatternTemplate'
import { parseSgf } from './lib/sgfParser'
import './App.css'

/** Parse URL hash into { mode, problemId } */
function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, '')
  if (!hash) return { mode: null, problemId: null }
  const parts = hash.split('/')
  const mode = parts[0] || null
  const problemId = parts[1] || null
  return { mode, problemId }
}

/** Update URL hash without triggering a full reload */
function setHash(mode, problemId) {
  const hash = problemId ? `#${mode}/${problemId}` : `#${mode}`
  if (window.location.hash !== hash) {
    window.history.replaceState(null, '', hash)
  }
}

function App() {
  // Side panel width: null = auto (CSS flex), number = explicit px from resize handle
  const [sidePanelWidth, setSidePanelWidth] = useState(() => {
    const saved = localStorage.getItem('gotrainer_panel_width')
    return saved ? Number(saved) : null
  })
  const sidePanelRef = useRef(null)

  const [boardSize, setBoardSize] = useState(19)
  const [boardMode, setBoardMode] = useState(() => {
    const { mode } = parseHash()
    if (mode && ['analyze', 'pattern', 'problem'].includes(mode)) return mode
    return localStorage.getItem('gotrainer_mode') || 'analyze'
  })
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
  const [problemSolveMode, setProblemSolveMode] = useState('try') // 'try' | 'solution'
  const problemRootNodeRef = useRef(null) // to navigate back on reset

  // Problem authoring state
  const [authoringActive, setAuthoringActive] = useState(false)
  const [authoringRootNode, setAuthoringRootNode] = useState(null)
  const [trackedNodes, setTrackedNodes] = useState(() => new Set())

  // Source SGF path tracking — set when loading an SGF file
  const sourceSgfPathRef = useRef(null)

  const {
    stones, currentTurn, moveNumber, lastMove,
    rootNode, currentNode, version,
    playMove, undo, redo, goToStart, goToEnd, goBackN, goForwardN,
    goToNode, loadSgf, saveSnapshot, injectVariations, restoreSnapshot, reset,
  } = useGameTree(boardSize)

  // Extract game info from root node for KataGo and GameInfo panel
  const rootProps = rootNode?.props || {}
  const gameInfo = {
    komi: rootProps.KM ?? null,
    rules: rootProps.RU || null,
  }

  // KataGo
  const { analyzing, topMoves, bestMove, blackWinrate, blackScoreLead, toggleAnalysis, startAnalysis, stopAnalysis, clearAnalysis, loadCacheFromNode } = useKataGo(boardSize, gameInfo)

  // Keyboard shortcuts: spacebar = toggle analysis, left/right = navigate
  // Skip shortcuts when focus is on an input, textarea, or select element
  useEffect(() => {
    const handleKey = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

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

  // Persist mode to localStorage + update URL hash
  useEffect(() => {
    localStorage.setItem('gotrainer_mode', boardMode)
    // Update URL hash with current mode + problem ID
    const currentProblemId = problemData?.problem?.id || null
    if (boardMode === 'problem' && currentProblemId) {
      setHash('problem', currentProblemId)
    } else {
      setHash(boardMode)
    }
  }, [boardMode, problemData])

  // Update URL when a specific problem is loaded
  useEffect(() => {
    if (problemActive && problemData?.problem?.id) {
      setHash('problem', problemData.problem.id)
    }
  }, [problemActive, problemData])

  // Handle browser back/forward (hashchange)
  useEffect(() => {
    const handleHashChange = () => {
      const { mode, problemId } = parseHash()
      if (mode && ['analyze', 'pattern', 'problem'].includes(mode)) {
        setBoardMode(mode)
      }
      // Note: problem loading from hash is handled by ProblemView's mount effect
      // via localStorage. Direct problem URL loading is handled on initial mount.
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Clear 'wrong' answer result when user navigates (undo to retry)
  useEffect(() => {
    if (problemActive && answerResult === 'wrong') {
      setAnswerResult(null)
    }
  }, [currentNode]) // eslint-disable-line react-hooks/exhaustive-deps

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

    // During problem authoring, track the node that results from playing a move
    if (authoringActive) {
      const prevNode = currentNode
      const ok = playMove(x, y)
      if (ok) {
        // After playMove, currentNode has changed to the new/existing child node.
        // We need to get it from the tree — it's the child of prevNode that matches.
        const sgfCoord = String.fromCharCode(97 + x) + String.fromCharCode(97 + y)
        const turn = prevNode === currentNode ? currentTurn : (currentTurn === 'B' ? 'W' : 'B')
        const newChild = prevNode.children.find(
          (c) => c.props[turn] === sgfCoord || c.props.B === sgfCoord || c.props.W === sgfCoord
        )
        if (newChild) {
          setTrackedNodes((prev) => {
            const next = new Set(prev)
            next.add(newChild)
            return next
          })
        }
      }
      return
    }

    playMove(x, y)
  }

  // Start problem authoring from the current position
  const handleStartAuthoring = useCallback(() => {
    setAuthoringActive(true)
    setAuthoringRootNode(currentNode)
    setTrackedNodes(new Set())
    setAnnotationTool('stone')
  }, [currentNode])

  // Cancel problem authoring
  const handleCancelAuthoring = useCallback(() => {
    // Clean up _problemMarker from tracked nodes
    for (const node of trackedNodes) {
      delete node._problemMarker
    }
    setAuthoringActive(false)
    setAuthoringRootNode(null)
    setTrackedNodes(new Set())
  }, [trackedNodes])

  // Problem saved successfully
  const handleProblemSaved = useCallback((created) => {
    // Clean up _problemMarker from tracked nodes
    for (const node of trackedNodes) {
      delete node._problemMarker
    }
    setAuthoringActive(false)
    setAuthoringRootNode(null)
    setTrackedNodes(new Set())
    alert(`Problem saved! ID: ${created.id}`)
  }, [trackedNodes])

  /**
   * Handle a click during problem solving.
   *
   * Multi-move logic:
   * 1. Check if the user's move matches any child of the current node
   * 2. If yes: play the move, navigate to that child
   *    a. If the child is a leaf with CORRECT: → declare correct
   *    b. If the child is a leaf with WRONG: → declare wrong
   *    c. If the child has children → auto-play opponent's response, continue
   * 3. If no matching child: it's a wrong move (not in any answer branch)
   */
  const handleProblemClick = (x, y) => {
    // In solution mode, just play moves freely (explore branches)
    if (problemSolveMode === 'solution') {
      playMove(x, y)
      return
    }

    if (!problemData || answerResult === 'correct') return
    const sgfCoord = `${String.fromCharCode(97 + x)}${String.fromCharCode(97 + y)}`

    // Find a child node matching this move
    const matchingChild = currentNode.children.find((child) => {
      const move = child.props.B || child.props.W
      return move === sgfCoord
    })

    if (!matchingChild) {
      // No matching branch — wrong move, but don't navigate
      setAnswerResult('wrong')
      return
    }

    // Play the move (navigates to the matching child)
    playMove(x, y)

    // Check the leaf status of the node we just moved to
    checkProblemNodeAfterMove(matchingChild)
  }

  /**
   * After playing a move in a problem, check the resulting node:
   * - If it's a leaf with CORRECT/WRONG comment → declare result
   * - If it has children → auto-play opponent's response after a delay
   */
  const checkProblemNodeAfterMove = useCallback((node) => {
    const comment = node.props.C || ''
    const isLeaf = node.children.length === 0

    if (isLeaf) {
      if (comment.startsWith('CORRECT:') || comment.startsWith('CORRECT')) {
        setAnswerResult('correct')
      } else if (comment.startsWith('WRONG:') || comment.startsWith('WRONG')) {
        setAnswerResult('wrong')
      } else {
        // Leaf without marker — treat as end of sequence (neutral)
        setAnswerResult(null)
      }
      return
    }

    // Not a leaf — auto-play the opponent's response after a short delay
    // Pick a random child as the "opponent response"
    setTimeout(() => {
      const responseChild = node.children[Math.floor(Math.random() * node.children.length)]
      if (responseChild) {
        const coord = responseChild.moveCoord
        if (coord && coord.length === 2) {
          const rx = coord.charCodeAt(0) - 97
          const ry = coord.charCodeAt(1) - 97
          playMove(rx, ry)

          // After opponent's response, check if THAT node is a leaf
          const responseComment = responseChild.props.C || ''
          const responseIsLeaf = responseChild.children.length === 0
          if (responseIsLeaf) {
            if (responseComment.startsWith('CORRECT:') || responseComment.startsWith('CORRECT')) {
              setAnswerResult('correct')
            } else if (responseComment.startsWith('WRONG:') || responseComment.startsWith('WRONG')) {
              setAnswerResult('wrong')
            }
            // else: opponent response is a leaf without marker — wait for more input
          }
          // If not a leaf, the problem continues — user needs to play next
        }
      }
    }, 400)
  }, [playMove])

  const handleFileOpen = (event) => {
    const file = event.target.files[0]
    if (!file) return
    // Track the source file name for problem authoring
    sourceSgfPathRef.current = file.name
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
      sourceSgfPathRef.current = hit.sgf_file
      loadSgf(await resp.text())
      setTimeout(() => { goToStart(); goForwardN(hit.move_number) }, 50)
    } catch (err) { alert('Failed to load game: ' + err.message) }
  }, [loadSgf, goToStart, goForwardN, savedPosition, saveSnapshot, selection])

  const handleRestorePosition = useCallback(() => {
    if (!savedPosition) return
    restoreSnapshot(savedPosition)
    setSelection(savedSelection); setSavedPosition(null); setSavedSelection(null); setViewingHit(false)
  }, [savedPosition, savedSelection, restoreSnapshot])

  const handleLoadProblem = useCallback(({ problemSgf, sourceSgfContent, sourceMoveNumber, problem }) => {
    // Parse the problem SGF string to extract correct answer coordinates
    const correctAnswers = []
    try {
      const tree = parseSgf(problemSgf)
      if (tree?.children) {
        for (const child of tree.children) {
          const move = child.props?.B || child.props?.W
          if (move) {
            let node = child
            while (node.children?.length > 0) node = node.children[0]
            const comment = node.props?.C || child.props?.C || ''
            if (comment.startsWith('CORRECT:') || comment.startsWith('CORRECT')) {
              correctAnswers.push(move)
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to parse problem SGF:', err)
    }

    let problemMN = 0

    if (sourceSgfContent && sourceMoveNumber != null) {
      // Load the full source game, navigate to the problem position,
      // then inject the problem variations as branches at that node
      loadSgf(sourceSgfContent)
      // Use setTimeout to ensure loadSgf has updated the tree
      setTimeout(() => {
        goToStart()
        goForwardN(sourceMoveNumber)
        // Inject problem variation branches at this position
        injectVariations(problemSgf)
      }, 0)
      problemMN = sourceMoveNumber
    } else {
      // No source game — load the self-contained problem SGF directly
      loadSgf(problemSgf)
    }

    // Persist current problem ID for refresh recovery
    localStorage.setItem('gotrainer_problem_id', problem.id)

    setProblemData({ correctAnswers, description: problem.description, problem })
    setProblemMoveNumber(problemMN)
    setAnswerResult(null)
    setProblemSolveMode('try')
    setShowAnswerOnBoard(false)
    setProblemActive(true)

    // Store the problem root node ref after navigation (delayed to let tree load)
    setTimeout(() => {
      problemRootNodeRef.current = null // will be set after goForwardN completes
    }, 0)
  }, [loadSgf, goToStart, goForwardN, injectVariations])

  // After loading a problem and navigating, capture the problem root node
  useEffect(() => {
    if (problemActive && problemRootNodeRef.current === null && currentNode) {
      problemRootNodeRef.current = currentNode
    }
  }, [problemActive, currentNode])

  // Reset problem to the root position
  const handleResetProblem = useCallback(() => {
    if (problemRootNodeRef.current) {
      goToNode(problemRootNodeRef.current)
    } else if (problemMoveNumber != null) {
      goToStart()
      goForwardN(problemMoveNumber)
    }
    setAnswerResult(null)
  }, [goToNode, goToStart, goForwardN, problemMoveNumber])

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

  // Dynamic answer markers — in solution mode, show ✓/✗ on current node's children
  const answerMarkers = useMemo(() => {
    if (!showAnswerOnBoard || !problemActive) return []

    // Walk a subtree to find the leaf result: 'correct', 'wrong', or null
    const getLeafResult = (node) => {
      if (!node) return null
      const comment = node.props.C || ''
      if (node.children.length === 0) {
        if (comment.startsWith('CORRECT:') || comment.startsWith('CORRECT')) return 'correct'
        if (comment.startsWith('WRONG:') || comment.startsWith('WRONG')) return 'wrong'
        return null
      }
      // For non-leaf, check the first child path (any correct path means correct)
      for (const child of node.children) {
        const result = getLeafResult(child)
        if (result === 'correct') return 'correct'
      }
      // If no correct path found, check for wrong
      for (const child of node.children) {
        const result = getLeafResult(child)
        if (result === 'wrong') return 'wrong'
      }
      return null
    }

    const markers = []
    if (currentNode?.children) {
      for (const child of currentNode.children) {
        const move = child.props.B || child.props.W
        if (move && move.length === 2) {
          const result = getLeafResult(child)
          if (result) {
            markers.push({
              x: move.charCodeAt(0) - 97,
              y: move.charCodeAt(1) - 97,
              type: result === 'correct' ? 'answer' : 'wrong-answer',
            })
          }
        }
      }
    }
    return markers
  }, [showAnswerOnBoard, problemActive, currentNode])

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
          {(topMoves.length > 0 || blackWinrate !== null) && !analyzing && (
            <button
              onClick={() => { stopAnalysis(); clearAnalysis() }}
              title="Clear analysis overlays from board"
              className="clear-analysis-btn"
            >
              🧹
            </button>
          )}

          <button
            onClick={() => setShowNewGameDialog(true)}
            title="New game"
            className="reset-btn"
          >
            New Game
          </button>

          {boardMode === 'analyze' && !authoringActive && (
            <button
              onClick={handleStartAuthoring}
              title="Create a problem from the current position"
              className="add-problem-btn"
            >
              📌 Add Problem
            </button>
          )}
          {authoringActive && (
            <span className="authoring-indicator">📌 Authoring Problem</span>
          )}
        </div>

      </div>

      <div className="main-layout">
        <div className="board-column" style={sidePanelWidth ? { flex: `1 1 0`, minWidth: 0 } : undefined}>
          <div className="board-wrapper">
            <GoBoard
              size={boardSize}
              width="100%"
              height="100%"
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
          </div>
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

        {/* Draggable vertical resize handle */}
        <div
          className="resize-handle"
          onMouseDown={(e) => {
            e.preventDefault()
            const startX = e.clientX
            const panel = sidePanelRef.current
            const startW = panel ? panel.offsetWidth : 320
            const onMove = (ev) => {
              const newW = Math.max(200, Math.min(900, startW - (ev.clientX - startX)))
              setSidePanelWidth(newW)
            }
            const onUp = () => {
              document.removeEventListener('mousemove', onMove)
              document.removeEventListener('mouseup', onUp)
              document.body.style.cursor = ''
              document.body.style.userSelect = ''
              // Persist
              const panel = sidePanelRef.current
              if (panel) localStorage.setItem('gotrainer_panel_width', String(panel.offsetWidth))
            }
            document.addEventListener('mousemove', onMove)
            document.addEventListener('mouseup', onUp)
            document.body.style.cursor = 'col-resize'
            document.body.style.userSelect = 'none'
          }}
        >
          <div className="resize-handle-line" />
        </div>

        <div className="side-panel" ref={sidePanelRef} style={sidePanelWidth ? { width: sidePanelWidth, flexShrink: 0 } : undefined}>
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

          {/* Comment box — hidden only during problem authoring (it has its own) */}
          <div className="comment-box-wrapper" style={authoringActive ? { display: 'none' } : undefined}>
            <textarea
              className="comment-box"
              value={comment}
              readOnly={boardMode === 'problem' && problemActive && problemSolveMode === 'try'}
              placeholder="Add a comment…"
              onChange={(e) => {
                if (currentNode) {
                  currentNode.props.C = e.target.value || undefined
                  setAnnotationVersion((v) => v + 1) // force re-render for comment
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
            trackedNodes={authoringActive ? trackedNodes : null}
            annotationVersion={annotationVersion}
          />

          {/* Problem authoring panel */}
          {authoringActive && authoringRootNode && (
            <ProblemAuthor
              problemRootNode={authoringRootNode}
              trackedNodes={trackedNodes}
              currentNode={currentNode}
              boardSize={boardSize}
              sourceSgfPath={sourceSgfPathRef.current}
              sourceMoveNumber={authoringRootNode.moveNumber}
              onCancel={handleCancelAuthoring}
              onSaved={handleProblemSaved}
              onGoToNode={goToNode}
              annotationVersion={annotationVersion}
              onAnnotationBump={() => setAnnotationVersion((v) => v + 1)}
            />
          )}

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
              onResetProblem={handleResetProblem}
              problemSolveMode={problemSolveMode}
              onSolveModeChange={setProblemSolveMode}
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
