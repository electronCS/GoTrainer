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
  const [editingProblemId, setEditingProblemId] = useState(null) // non-null = editing existing problem
  const [editingProblemTags, setEditingProblemTags] = useState('')
  const [pendingEditProblem, setPendingEditProblem] = useState(null) // set to trigger edit after re-render
  const [pendingViewOriginal, setPendingViewOriginal] = useState(null) // triggers game load + inject after re-render

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

  // Clear 'wrong' answer result when user navigates BACKWARD (undo to retry)
  // Don't clear on forward navigation (which happens when clicking a wrong branch)
  const prevNodeRef = useRef(null)
  useEffect(() => {
    if (problemActive && answerResult === 'wrong' && prevNodeRef.current) {
      // Only clear if the user went backward (current node is an ancestor of the previous)
      const prev = prevNodeRef.current
      const isBackward = currentNode && prev.parent === currentNode
      if (isBackward) {
        setAnswerResult(null)
      }
    }
    prevNodeRef.current = currentNode
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
    setBoardMode('analyze') // ensure annotation toolbar is available
    setEditingProblemId(null)
    setEditingProblemTags('')
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
    setEditingProblemId(null)
    setEditingProblemTags('')
    alert(`Problem saved! ID: ${created.id}`)
  }, [trackedNodes])

  /**
   * Edit an existing problem — load its SGF, populate tracked nodes, enter authoring.
   * The problem SGF is self-contained: root has AB/AW + PL + C, children are answer branches.
   * We load it directly, then walk all descendant nodes to build trackedNodes and set _problemMarker.
   */
  const handleEditProblem = useCallback((problem) => {
    // Load the problem SGF into the game tree
    loadSgf(problem.sgf)
    // Defer the rest to a useEffect via pendingEditProblem — rootNode is stale in this closure
    setPendingEditProblem(problem)
    setProblemActive(false)
    setProblemData(null)
  }, [loadSgf])

  // Effect: after loadSgf re-renders with the new rootNode, finish setting up edit mode
  useEffect(() => {
    if (!pendingEditProblem || !rootNode) return
    const problem = pendingEditProblem
    setPendingEditProblem(null)

    const probRoot = rootNode

    // Walk all descendants to build trackedNodes and set markers
    const tracked = new Set()
    const walkAndTrack = (node) => {
      for (const child of node.children) {
        tracked.add(child)
        const comment = child.props.C || ''
        if (child.children.length === 0) {
          if (comment.startsWith('CORRECT:') || comment.startsWith('CORRECT')) {
            child._problemMarker = 'correct'
            child.props.C = comment.replace(/^CORRECT:\s*/, '').replace(/^CORRECT\s*/, '') || undefined
          } else if (comment.startsWith('WRONG:') || comment.startsWith('WRONG')) {
            child._problemMarker = 'wrong'
            child.props.C = comment.replace(/^WRONG:\s*/, '').replace(/^WRONG\s*/, '') || undefined
          }
        }
        walkAndTrack(child)
      }
    }
    walkAndTrack(probRoot)

    setEditingProblemId(problem.id)
    setEditingProblemTags((problem.tags || []).join(', '))
    sourceSgfPathRef.current = problem.source_sgf_file || null
    setAuthoringRootNode(probRoot)
    setTrackedNodes(tracked)
    setAuthoringActive(true)
    setAnnotationTool('stone')
    setBoardMode('analyze')
    setAnnotationVersion((v) => v + 1)
  }, [pendingEditProblem, rootNode])

  /**
   * Delete a problem by ID.
   */
  const handleDeleteProblem = useCallback(async (problemId) => {
    try {
      const resp = await fetch(`http://localhost:8000/api/problems/${problemId}`, { method: 'DELETE' })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      setProblemActive(false)
      setProblemData(null)
      setAnswerResult(null)
      localStorage.removeItem('gotrainer_problem_id')
      setHash('problem')
      reset(boardSize)
    } catch (err) {
      alert('Failed to delete problem: ' + err.message)
    }
  }, [boardSize, reset])

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
    // In solution mode, prefer problem nodes but allow exploring game branches too
    if (problemSolveMode === 'solution') {
      // Prefer problem node if one exists at this coordinate
      const problemKidsForSolution = currentNode.children.filter((c) => c._isProblemNode)
      const sgfCoordSolution = `${String.fromCharCode(97 + x)}${String.fromCharCode(97 + y)}`
      const problemMatch = problemKidsForSolution.find((c) => {
        const move = c.props.B || c.props.W
        return move === sgfCoordSolution
      })
      if (problemMatch) {
        goToNode(problemMatch)
      } else {
        playMove(x, y)
      }
      return
    }

    if (!problemData || answerResult === 'correct') return
    const sgfCoord = `${String.fromCharCode(97 + x)}${String.fromCharCode(97 + y)}`

    // Find a matching child — prefer problem nodes (injected) over main game nodes
    const problemKids = currentNode.children.filter((c) => c._isProblemNode)
    const candidates = problemKids.length > 0 ? problemKids : currentNode.children
    const matchingChild = candidates.find((child) => {
      const move = child.props.B || child.props.W
      return move === sgfCoord
    })

    if (!matchingChild) {
      // No matching branch — wrong move, but don't navigate
      setAnswerResult('wrong')
      return
    }

    // Navigate directly to the matching problem node (NOT playMove, which would
    // find the first child matching the coordinate — could be a main game node)
    goToNode(matchingChild)

    // Check the leaf status of the node we just moved to
    checkProblemNodeAfterMove(matchingChild)
  }

  /**
   * After playing a move in a problem, check the resulting node:
   * - If it's a leaf with CORRECT/WRONG comment → declare result
   * - If it has children → auto-play opponent's response after a delay
   */
  /**
   * Get the problem-relevant children of a node.
   * If any children are marked _isProblemNode (injected), only return those.
   * Otherwise return all children (standalone problem SGF).
   */
  const getProblemChildren = useCallback((node) => {
    const problemKids = node.children.filter((c) => c._isProblemNode)
    return problemKids.length > 0 ? problemKids : node.children
  }, [])

  const checkProblemNodeAfterMove = useCallback((node) => {
    const comment = node.props.C || ''
    // A node is a "problem leaf" if it has no problem children
    const problemKids = getProblemChildren(node)
    const isProblemLeaf = problemKids.length === 0

    if (isProblemLeaf) {
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

    // Not a problem leaf — auto-play the opponent's response after a short delay
    // Pick a random problem child as the "opponent response"
    setTimeout(() => {
      const responseChild = problemKids[Math.floor(Math.random() * problemKids.length)]
      if (responseChild) {
        // Navigate directly to the problem node (not playMove, which may find a game node)
        goToNode(responseChild)

        // After opponent's response, check if THAT node is a problem leaf
        const responseComment = responseChild.props.C || ''
        const responseKids = getProblemChildren(responseChild)
        const responseIsProblemLeaf = responseKids.length === 0
        if (responseIsProblemLeaf) {
          if (responseComment.startsWith('CORRECT:') || responseComment.startsWith('CORRECT')) {
            setAnswerResult('correct')
          } else if (responseComment.startsWith('WRONG:') || responseComment.startsWith('WRONG')) {
            setAnswerResult('wrong')
          }
          // else: opponent response is a leaf without marker — wait for more input
        }
        // If not a problem leaf, the problem continues — user needs to play next
      }
    }, 400)
  }, [goToNode, getProblemChildren])

  const handleFileOpen = async (event) => {
    const file = event.target.files[0]
    if (!file) return
    event.target.value = ''

    // Upload the file to the server so it's saved at a known path
    // (needed for problem authoring source_sgf_file to work)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const resp = await fetch('http://localhost:8000/api/sgf/upload', {
        method: 'POST',
        body: formData,
      })
      if (!resp.ok) throw new Error(`Upload failed: HTTP ${resp.status}`)
      const data = await resp.json()
      sourceSgfPathRef.current = data.path  // e.g. "goTrainer/uploads/game.sgf"
      loadSgf(data.sgf)
    } catch (err) {
      // Fallback: read locally if server is down
      console.warn('Upload failed, reading locally:', err)
      sourceSgfPathRef.current = file.name
      const reader = new FileReader()
      reader.onload = (e) => {
        try { loadSgf(e.target.result) }
        catch (err2) { alert('Failed to load SGF: ' + err2.message) }
      }
      reader.readAsText(file)
    }
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

  /**
   * Pre-compute problem results on nodes via post-order DFS.
   * Sets `_problemResult` = 'correct' | 'wrong' | null on every node in the tree.
   * Called once after loading a problem SGF.
   */
  const computeProblemResults = useCallback((root) => {
    const dfs = (node) => {
      if (!node.children || node.children.length === 0) {
        // Leaf — check CORRECT/WRONG comment
        const c = node.props.C || ''
        if (c.startsWith('CORRECT:') || c.startsWith('CORRECT')) {
          node._problemResult = 'correct'
        } else if (c.startsWith('WRONG:') || c.startsWith('WRONG')) {
          node._problemResult = 'wrong'
        } else {
          node._problemResult = null
        }
        return node._problemResult
      }

      let hasCorrect = false
      let hasWrong = false
      for (const child of node.children) {
        const childResult = dfs(child)
        if (childResult === 'correct') hasCorrect = true
        else if (childResult === 'wrong') hasWrong = true
      }

      node._problemResult = hasCorrect ? 'correct' : hasWrong ? 'wrong' : null
      return node._problemResult
    }

    dfs(root)
  }, [])

  const handleLoadProblem = useCallback(({ problemSgf, sourceSgfContent, sourceMoveNumber, problem }) => {
    // Always load the standalone problem SGF directly (no injection).
    // This is the safe, simple path — the entire tree IS the problem.
    // "View Original Game" loads the source game + injects later.
    loadSgf(problemSgf)

    // Reset the ref — will be captured after navigation
    problemRootNodeRef.current = null

    // Persist current problem ID for refresh recovery
    localStorage.setItem('gotrainer_problem_id', problem.id)

    setProblemData({
      description: problem.description,
      problem,
      // Store source info for "View Original Game" button
      sourceSgfContent: sourceSgfContent || null,
      sourceMoveNumber: sourceMoveNumber ?? null,
      problemSgf,
    })
    setProblemMoveNumber(0) // standalone problem, no injection
    setAnswerResult(null)
    setProblemSolveMode('try')
    setShowAnswerOnBoard(false)
    setProblemActive(true)
  }, [loadSgf])

  /**
   * "View Original Game" — load source game, navigate to problem position, inject variations.
   */
  const handleViewOriginalGame = useCallback(() => {
    if (!problemData?.sourceSgfContent || problemData.sourceMoveNumber == null) return
    const { sourceSgfContent, sourceMoveNumber, problemSgf } = problemData

    setShowAnswerOnBoard(false)
    problemRootNodeRef.current = 'pending'

    loadSgf(sourceSgfContent)
    setPendingViewOriginal({ sourceMoveNumber, problemSgf })
    setProblemMoveNumber(sourceMoveNumber)
  }, [problemData, loadSgf, goToStart, goForwardN, injectVariations])

  /**
   * Return from "View Original Game" back to standalone problem SGF.
   */
  const handleReturnToProblem = useCallback(() => {
    if (!problemData?.problemSgf) return
    loadSgf(problemData.problemSgf)
    setProblemMoveNumber(0)
    problemRootNodeRef.current = null
  }, [problemData, loadSgf])

  // Effect: after loadSgf re-renders with the source game tree, navigate + inject
  useEffect(() => {
    if (!pendingViewOriginal || !rootNode) return
    const { sourceMoveNumber, problemSgf } = pendingViewOriginal
    setPendingViewOriginal(null)

    goToStart()
    goForwardN(sourceMoveNumber)
    injectVariations(problemSgf)
    problemRootNodeRef.current = null
  }, [pendingViewOriginal, rootNode, goToStart, goForwardN, injectVariations])

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

  // Pre-compute _problemResult on all nodes when a problem is loaded (standalone)
  // This runs once after loadSgf updates rootNode. Uses post-order DFS.
  useEffect(() => {
    if (problemActive && rootNode && problemMoveNumber === 0) {
      computeProblemResults(rootNode)
    }
  }, [problemActive, rootNode, problemMoveNumber, computeProblemResults])

  // Answer markers — O(1) lookup using pre-computed _problemResult on each child node
  const answerMarkers = useMemo(() => {
    if (!showAnswerOnBoard || !problemActive || !currentNode?.children) return []

    const markers = []
    for (const child of currentNode.children) {
      const move = child.props.B || child.props.W
      if (move && move.length === 2 && child._problemResult) {
        markers.push({
          x: move.charCodeAt(0) - 97,
          y: move.charCodeAt(1) - 97,
          type: child._problemResult === 'correct' ? 'answer' : 'wrong-answer',
        })
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

          {!authoringActive && (
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

          {/* Comment box — hidden during problem authoring and active problem solving (both have their own) */}
          <div className="comment-box-wrapper" style={(authoringActive || (boardMode === 'problem' && problemActive)) ? { display: 'none' } : undefined}>
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

          {/* Variation tree — hidden during problem Try mode, shown in Solution mode and all other modes */}
          {!(boardMode === 'problem' && problemActive && problemSolveMode === 'try') && (
            <VariationTree
              rootNode={rootNode} currentNode={currentNode}
              onSelectNode={goToNode} version={version}
              trackedNodes={authoringActive ? trackedNodes : null}
              problemNodes={problemActive && problemSolveMode === 'solution' ? '_isProblemNode' : null}
              annotationVersion={annotationVersion}
            />
          )}

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
              editingProblemId={editingProblemId}
              initialTags={editingProblemTags}
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
              onEditProblem={handleEditProblem}
              onDeleteProblem={handleDeleteProblem}
              onViewOriginalGame={handleViewOriginalGame}
              onReturnToProblem={handleReturnToProblem}
              isViewingOriginalGame={problemMoveNumber > 0}
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
