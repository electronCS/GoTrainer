import { useState, useRef, useCallback, useEffect } from 'react'

const WS_URL = `ws://localhost:8000/ws/katago`

const GTP_LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'

function gtpToBoard(gtp, boardSize = 19) {
  if (!gtp || gtp === 'pass') return null
  const col = GTP_LETTERS.indexOf(gtp[0])
  const row = boardSize - parseInt(gtp.slice(1))
  if (col < 0 || row < 0 || row >= boardSize) return null
  return { x: col, y: row }
}

/**
 * useKataGo — React hook for KataGo analysis via WebSocket.
 *
 * Key design: uses a generation counter to prevent stale messages from flipping
 * the winrate. When a new analysis starts, generation increments. Messages from
 * the old generation are dropped. The winrate is only updated from data that
 * matches the current generation's turn perspective.
 */
export function useKataGo(boardSize = 19, gameInfo = {}) {
  const [analyzing, setAnalyzing] = useState(false)
  const [topMoves, setTopMoves] = useState([])
  const [blackWinrate, setBlackWinrate] = useState(null)
  const [blackScoreLead, setBlackScoreLead] = useState(null)
  const currentNodeRef = useRef(null) // track which node we're analyzing

  const wsRef = useRef(null)
  const analyzingRef = useRef(false)

  // Generation gate: incremented on each new startAnalysis call.
  // Messages arriving with a stale generation are dropped.
  const navGenRef = useRef(0)
  const activeGenRef = useRef(0)
  const turnRef = useRef('b')
  const gateTimerRef = useRef(null)
  const gameInfoRef = useRef(gameInfo)
  gameInfoRef.current = gameInfo

  const getMoveList = useCallback((currentNode) => {
    const stack = []
    let node = currentNode
    while (node) {
      // Collect B/W moves
      if (node.color && node.moveCoord) {
        stack.push([node.color.toLowerCase(), node.moveCoord])
      }
      // Collect AB/AW setup stones (handicap, board setup)
      // These are sent as "play" commands so KataGo knows about them
      if (node.props.AB) {
        const coords = Array.isArray(node.props.AB) ? node.props.AB : [node.props.AB]
        for (const coord of coords) {
          if (coord && coord.length === 2) stack.push(['b', coord])
        }
      }
      if (node.props.AW) {
        const coords = Array.isArray(node.props.AW) ? node.props.AW : [node.props.AW]
        for (const coord of coords) {
          if (coord && coord.length === 2) stack.push(['w', coord])
        }
      }
      node = node.parent
    }
    return stack.reverse()
  }, [])

  const ensureConnection = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return wsRef.current
    }

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data)
      if (msg.type !== 'analysis' || !msg.moves) return

      // DROP stale messages: if navGen !== activeGen, this message is from
      // the old position (before the gate re-opened after navigation)
      if (navGenRef.current !== activeGenRef.current) {
        return
      }

      const validMoves = msg.moves
        .filter((m) => m.visits > 5 && m.move && m.move !== 'pass')
        .map((m) => ({ ...m, ...gtpToBoard(m.move, boardSize) }))
        .filter((m) => m.x !== undefined)

      if (validMoves.length > 0) {
        const top = validMoves.slice(0, 10)
        setTopMoves(top)

        // Compute absolute Black winrate using the turn that this analysis was FOR
        const best = top[0]
        const turn = turnRef.current
        const bwr = turn === 'b' ? best.winrate * 100 : (1 - best.winrate) * 100
        const bsl = turn === 'b' ? best.scoreLead : -best.scoreLead
        setBlackWinrate(bwr)
        setBlackScoreLead(bsl)

        // Cache on the current GameNode for instant display on re-visit
        if (currentNodeRef.current) {
          currentNodeRef.current._katagoCache = { topMoves: top, blackWinrate: bwr, blackScoreLead: bsl }
        }
      }
    }

    ws.onerror = () => { setAnalyzing(false); analyzingRef.current = false }
    ws.onclose = () => { setAnalyzing(false); analyzingRef.current = false }

    return ws
  }, [boardSize])

  // Load cached analysis from a GameNode (for when not actively analyzing)
  const loadCacheFromNode = useCallback((node) => {
    if (node?._katagoCache) {
      setTopMoves(node._katagoCache.topMoves)
      setBlackWinrate(node._katagoCache.blackWinrate)
      setBlackScoreLead(node._katagoCache.blackScoreLead)
    } else {
      setTopMoves([])
      setBlackWinrate(null)
      setBlackScoreLead(null)
    }
  }, [])

  const startAnalysis = useCallback((currentNode) => {
    currentNodeRef.current = currentNode
    const ws = ensureConnection()
    const moves = getMoveList(currentNode)

    // Determine whose turn it is to play
    let turn
    const lastColor = currentNode?.color
    if (lastColor === 'B') {
      turn = 'w'
    } else if (lastColor === 'W') {
      turn = 'b'
    } else {
      // No move at this node (root or setup) — check for handicap
      let node = currentNode
      while (node) {
        if (node.props.PL) { turn = node.props.PL.toLowerCase() === 'w' ? 'w' : 'b'; break }
        if (node.props.AB && !node.props.AW) { turn = 'w'; break }
        node = node.parent
      }
      if (!turn) turn = 'b'
    }

    // Increment navGen — this "closes the gate" so stale messages are dropped
    navGenRef.current++
    const gen = navGenRef.current

    // Update the turn AFTER closing the gate (so stale messages with old turn are dropped)
    turnRef.current = turn

    const send = () => {
      // Send stop first to flush old analysis, then set up new position
      ws.send(JSON.stringify({ type: 'stop' }))
      const analyzeMsg = { type: 'analyze', moves, turn, boardSize }
      const gi = gameInfoRef.current
      if (gi.komi != null) analyzeMsg.komi = parseFloat(gi.komi)
      if (gi.rules) analyzeMsg.rules = gi.rules
      ws.send(JSON.stringify(analyzeMsg))
      setAnalyzing(true)
      analyzingRef.current = true

      // Re-open the gate after a short delay (enough for stop to flush stale messages)
      if (gateTimerRef.current) clearTimeout(gateTimerRef.current)
      gateTimerRef.current = setTimeout(() => {
        // Only open if no newer navigation has happened
        if (navGenRef.current === gen) {
          activeGenRef.current = gen
        }
      }, 150)
    }

    if (ws.readyState === WebSocket.OPEN) send()
    else ws.onopen = send
  }, [ensureConnection, getMoveList, boardSize])

  const stopAnalysis = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'stop' }))
    }
    setAnalyzing(false)
    analyzingRef.current = false
    // Keep topMoves, blackWinrate, blackScoreLead — show last known data
  }, [])

  const clearAnalysis = useCallback(() => {
    setTopMoves([])
    setBlackWinrate(null)
    setBlackScoreLead(null)
  }, [])

  const toggleAnalysis = useCallback((currentNode) => {
    if (analyzingRef.current) stopAnalysis()
    else startAnalysis(currentNode)
  }, [startAnalysis, stopAnalysis])

  useEffect(() => {
    return () => {
      if (gateTimerRef.current) clearTimeout(gateTimerRef.current)
      if (wsRef.current) try { wsRef.current.close() } catch {}
    }
  }, [])

  const bestMove = topMoves.length > 0 ? topMoves[0] : null

  return {
    analyzing,
    topMoves,
    bestMove,
    blackWinrate,
    blackScoreLead,
    toggleAnalysis,
    startAnalysis,
    stopAnalysis,
    clearAnalysis,
    loadCacheFromNode,
  }
}
