import { useMemo, useState, useCallback, useRef } from 'react'
import './GoBoard.css'

// Letters used for column labels (I is traditionally skipped)
const LETTERS = 'ABCDEFGHJKLMNOPQRST'

function getStarPoints(size) {
  if (size === 19) return [[3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15]]
  if (size === 13) return [[3,3],[3,6],[3,9],[6,3],[6,6],[6,9],[9,3],[9,6],[9,9]]
  if (size === 9) return [[2,2],[2,6],[4,4],[6,2],[6,6]]
  return []
}

/**
 * Convert mouse/touch event to board coordinates.
 */
function eventToBoard(event, svgRef, last) {
  const svg = svgRef.current
  if (!svg) return null
  const pt = svg.createSVGPoint()
  pt.x = event.clientX
  pt.y = event.clientY
  const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse())
  const x = Math.round(svgPt.x)
  const y = Math.round(svgPt.y)
  if (x >= 0 && x <= last && y >= 0 && y <= last) return { x, y }
  return null
}

/**
 * GoBoard — responsive SVG Go board.
 *
 * New props for pattern mode:
 *   mode          – 'play' | 'pattern' (default 'play')
 *   selection     – { x1, y1, x2, y2 } | null — the current rectangle selection
 *   onSelectionChange – callback ({ x1, y1, x2, y2 }) => void
 */
export default function GoBoard({
  size = 19,
  width = '100%',
  height = 'auto',
  stones = [],
  lastMove = null,
  mode = 'play',
  currentTurn = 'B', // 'B' or 'W' — for ghost stone color
  selection = null,
  markers = [],  // [{ x, y, type: 'answer' }] — indicators to show on the board
  sgfLabels = [], // [{ x, y, type: 'label'|'circle'|'triangle'|'square'|'xmark', text? }]
  katagoMoves = [], // [{x, y, winrate, scoreLead, visits, move}, ...] from KataGo analysis
  onSelectionChange,
  onIntersectionClick,
}) {
  const last = size - 1
  const pad = 1.4
  const vbX = -pad, vbY = -pad
  const vbW = last + pad * 2, vbH = last + pad * 2
  const starRadius = 0.12, stoneRadius = 0.47, labelFontSize = 0.55

  const svgRef = useRef(null)
  const [dragStart, setDragStart] = useState(null)
  const [dragEnd, setDragEnd] = useState(null)
  const [hoverPos, setHoverPos] = useState(null) // {x, y} or null

  const starPoints = useMemo(() => getStarPoints(size), [size])
  const letters = useMemo(() => LETTERS.slice(0, size).split(''), [size])
  const rowLabel = (row) => size - row

  // --- Click / drag handlers ---
  const handleMouseDown = useCallback((e) => {
    if (mode !== 'pattern') return
    const pt = eventToBoard(e, svgRef, last)
    if (pt) {
      setDragStart(pt)
      setDragEnd(pt)
    }
  }, [mode, last])

  const handleMouseMove = useCallback((e) => {
    // Pattern drag
    if (mode === 'pattern' && dragStart) {
      const pt = eventToBoard(e, svgRef, last)
      if (pt) setDragEnd(pt)
      return
    }
    // Ghost stone hover (play mode only)
    if (mode === 'play') {
      const pt = eventToBoard(e, svgRef, last)
      if (pt) {
        // Only show ghost on empty intersections
        const occupied = stones.some((s) => s.x === pt.x && s.y === pt.y)
        setHoverPos(occupied ? null : pt)
      } else {
        setHoverPos(null)
      }
    }
  }, [mode, dragStart, last, stones])

  const handleMouseUp = useCallback((e) => {
    if (mode !== 'pattern' || !dragStart || !dragEnd) return
    const sel = {
      x1: Math.min(dragStart.x, dragEnd.x),
      y1: Math.min(dragStart.y, dragEnd.y),
      x2: Math.max(dragStart.x, dragEnd.x),
      y2: Math.max(dragStart.y, dragEnd.y),
    }
    onSelectionChange?.(sel)
    setDragStart(null)
    setDragEnd(null)
  }, [mode, dragStart, dragEnd, onSelectionChange])

  const handleClick = useCallback((e) => {
    if (mode === 'pattern') return // handled by drag
    if (!onIntersectionClick) return
    const pt = eventToBoard(e, svgRef, last)
    if (pt) {
      if (mode === 'play') setHoverPos(null) // clear ghost immediately on click
      onIntersectionClick(pt)
    }
  }, [mode, onIntersectionClick, last])

  // Compute drag preview rect
  const dragRect = (dragStart && dragEnd) ? {
    x1: Math.min(dragStart.x, dragEnd.x),
    y1: Math.min(dragStart.y, dragEnd.y),
    x2: Math.max(dragStart.x, dragEnd.x),
    y2: Math.max(dragStart.y, dragEnd.y),
  } : null

  // The active selection to render (either in-progress drag or committed selection)
  const activeSelection = dragRect || selection

  return (
    <svg
      ref={svgRef}
      className="go-board"
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      style={{ width, height, cursor: mode === 'pattern' ? 'crosshair' : 'default' }}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        setHoverPos(null)
        if (dragStart) { setDragStart(null); setDragEnd(null) }
      }}
    >
      {/* Board background */}
      <rect x={vbX} y={vbY} width={vbW} height={vbH} className="board-bg" />

      {/* Grid lines */}
      {Array.from({ length: size }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={i} x2={last} y2={i} className="grid-line" />
      ))}
      {Array.from({ length: size }, (_, i) => (
        <line key={`v${i}`} x1={i} y1={0} x2={i} y2={last} className="grid-line" />
      ))}

      {/* Star points */}
      {starPoints.map(([x, y]) => (
        <circle key={`star-${x}-${y}`} cx={x} cy={y} r={starRadius} className="star-point" />
      ))}

      {/* Labels */}
      {letters.map((letter, i) => (
        <g key={`col-${i}`}>
          <text x={i} y={-pad / 2} className="coord-label" style={{ fontSize: labelFontSize }}>{letter}</text>
          <text x={i} y={last + pad / 2 + 0.15} className="coord-label" style={{ fontSize: labelFontSize }}>{letter}</text>
        </g>
      ))}
      {Array.from({ length: size }, (_, i) => (
        <g key={`row-${i}`}>
          <text x={-pad / 2} y={i + 0.05} className="coord-label" style={{ fontSize: labelFontSize }}>{rowLabel(i)}</text>
          <text x={last + pad / 2} y={i + 0.05} className="coord-label" style={{ fontSize: labelFontSize }}>{rowLabel(i)}</text>
        </g>
      ))}

      {/* Stones */}
      {stones.map((stone, i) => (
        <circle key={`stone-${i}`} cx={stone.x} cy={stone.y} r={stoneRadius}
          className={`stone stone-${stone.color}`} />
      ))}

      {/* Last move marker — hidden if there's an SGF annotation at that position */}
      {lastMove && !sgfLabels.some((l) => l.x === lastMove.x && l.y === lastMove.y) && (
        <circle cx={lastMove.x} cy={lastMove.y} r={stoneRadius * 0.45}
          className={`last-move-marker last-move-on-${lastMove.color === 'B' ? 'black' : 'white'}`} />
      )}

      {/* SGF annotations: labels (LB), circles (CR), triangles (TR), squares (SQ), X marks (MA) */}
      {sgfLabels.map((label, i) => {
        // Determine color based on whether there's a stone at this position
        const stone = stones.find((s) => s.x === label.x && s.y === label.y)
        const onBlack = stone?.color === 'black'
        const onWhite = stone?.color === 'white'
        const color = onBlack ? '#fff' : onWhite ? '#000' : '#000'
        const r = stoneRadius * 0.38

        if (label.type === 'label') {
          return (
            <g key={`sgf-label-${i}`}>
              {/* Background to make text readable on intersections */}
              {!stone && (
                <rect x={label.x - 0.3} y={label.y - 0.3} width={0.6} height={0.6}
                  rx={0.08} fill="rgba(245, 222, 179, 0.85)" />
              )}
              <text x={label.x} y={label.y} className="sgf-label-text"
                style={{ fontSize: 0.45, fill: color }}>
                {label.text}
              </text>
            </g>
          )
        }

        if (label.type === 'circle') {
          return (
            <circle key={`sgf-label-${i}`} cx={label.x} cy={label.y} r={r}
              fill="none" stroke={color} strokeWidth={0.06} />
          )
        }

        if (label.type === 'triangle') {
          const tr = r * 1.15
          const points = [
            `${label.x},${label.y - tr}`,
            `${label.x - tr * 0.87},${label.y + tr * 0.5}`,
            `${label.x + tr * 0.87},${label.y + tr * 0.5}`,
          ].join(' ')
          return (
            <polygon key={`sgf-label-${i}`} points={points}
              fill="none" stroke={color} strokeWidth={0.06} />
          )
        }

        if (label.type === 'square') {
          return (
            <rect key={`sgf-label-${i}`} x={label.x - r} y={label.y - r}
              width={r * 2} height={r * 2}
              fill="none" stroke={color} strokeWidth={0.06} />
          )
        }

        if (label.type === 'xmark') {
          return (
            <g key={`sgf-label-${i}`}>
              <line x1={label.x - r} y1={label.y - r} x2={label.x + r} y2={label.y + r}
                stroke={color} strokeWidth={0.07} />
              <line x1={label.x + r} y1={label.y - r} x2={label.x - r} y2={label.y + r}
                stroke={color} strokeWidth={0.07} />
            </g>
          )
        }

        return null
      })}

      {/* KataGo analysis overlays — only on empty intersections */}
      {katagoMoves.map((m, i) => {
        // Skip if there's a stone at this position
        const occupied = stones.some((s) => s.x === m.x && s.y === m.y)
        if (occupied) return null

        // Color: best=cyan, good=green, gradient=yellow→orange, poor=orange
        const best = katagoMoves[0]
        const leadDiff = best ? best.scoreLead - m.scoreLead : 0
        const wrDiff = best ? best.winrate - m.winrate : 0

        let fillColor
        if (i === 0) fillColor = 'rgba(10, 214, 210, 0.85)'       // cyan — best
        else if (leadDiff <= 0.5 || wrDiff <= 0.02) fillColor = 'rgba(32, 215, 6, 0.85)' // green — near-best
        else if (leadDiff > 5) fillColor = 'rgba(217, 154, 49, 0.85)' // orange — poor
        else {
          const t = Math.min(1, (leadDiff - 0.5) / 4.5)
          const hue = Math.round(66 - 30 * t)
          const sat = Math.round(80 - 12 * t)
          const lit = Math.round(45 + 7 * t)
          fillColor = `hsla(${hue}, ${sat}%, ${lit}%, 0.85)`
        }

        return (
          <g key={`kata-${i}`} className="katago-overlay">
            <circle cx={m.x} cy={m.y} r={stoneRadius} fill={fillColor} />
            <text x={m.x} y={m.y - 0.12} className="katago-label" style={{ fontSize: 0.22 }}>
              {(m.winrate * 100).toFixed(1)}%
            </text>
            <text x={m.x} y={m.y + 0.1} className="katago-label" style={{ fontSize: 0.18 }}>
              {m.visits}
            </text>
            <text x={m.x} y={m.y + 0.3} className="katago-label" style={{ fontSize: 0.18 }}>
              {m.scoreLead > 0 ? '+' : ''}{m.scoreLead.toFixed(1)}
            </text>
          </g>
        )
      })}

      {/* Board markers (answer indicators: ✓ for correct, ✗ for wrong) */}
      {markers.map((m, i) => (
        <g key={`marker-${i}`} className="board-marker">
          <circle cx={m.x} cy={m.y} r={stoneRadius * 0.6}
            className={m.type === 'wrong-answer' ? 'wrong-marker-bg' : 'answer-marker-bg'} />
          <text x={m.x} y={m.y}
            className={m.type === 'wrong-answer' ? 'wrong-marker-text' : 'answer-marker-text'}
            style={{ fontSize: 0.5 }}>
            {m.type === 'wrong-answer' ? '✗' : '✓'}
          </text>
        </g>
      ))}

      {/* Ghost stone (hover preview) */}
      {hoverPos && mode === 'play' && (
        <circle
          cx={hoverPos.x}
          cy={hoverPos.y}
          r={stoneRadius}
          className={`ghost-stone ghost-stone-${currentTurn === 'B' ? 'black' : 'white'}`}
        />
      )}

      {/* Pattern selection overlay */}
      {activeSelection && (
        <rect
          x={activeSelection.x1 - 0.5}
          y={activeSelection.y1 - 0.5}
          width={activeSelection.x2 - activeSelection.x1 + 1}
          height={activeSelection.y2 - activeSelection.y1 + 1}
          className="pattern-selection"
        />
      )}
    </svg>
  )
}
