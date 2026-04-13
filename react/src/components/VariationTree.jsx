import { useMemo, useEffect, useRef } from 'react'
import { computeTreeLayout, computeActiveBranch } from '../lib/computeTreeLayout.js'
import './VariationTree.css'

const NODE_RADIUS = 14
const BG_RADIUS = 15

/** Pre-compute leaf result for all _isProblemNode nodes. Returns Map<GameNode, 'correct'|'wrong'|null> */
function buildProblemResultMap(rootNode) {
  const resultMap = new Map()
  const compute = (node) => {
    if (resultMap.has(node)) return resultMap.get(node)
    const c = node.props.C || ''
    const kids = node.children.filter((ch) => ch._isProblemNode)
    if (kids.length === 0) {
      let r = null
      if (c.startsWith('CORRECT:') || c.startsWith('CORRECT')) r = 'correct'
      else if (c.startsWith('WRONG:') || c.startsWith('WRONG')) r = 'wrong'
      resultMap.set(node, r)
      return r
    }
    let hasCorrect = false, hasWrong = false
    for (const kid of kids) {
      const kr = compute(kid)
      if (kr === 'correct') hasCorrect = true
      else if (kr === 'wrong') hasWrong = true
    }
    const r = hasCorrect ? 'correct' : hasWrong ? 'wrong' : null
    resultMap.set(node, r)
    return r
  }
  // Walk entire tree to find _isProblemNode nodes (they may be injected deep in the game)
  const walk = (node) => {
    if (node._isProblemNode && !resultMap.has(node)) compute(node)
    for (const child of node.children) {
      if (child._isProblemNode) compute(child)
      else walk(child) // only recurse into non-problem nodes to find injection points
    }
  }
  walk(rootNode)
  return resultMap
}

/**
 * VariationTree — renders the game tree as an SVG inside a scrollable container.
 *
 * Props:
 *   rootNode    — the root GameNode
 *   currentNode — the currently active GameNode
 *   onSelectNode — callback (gameNode) => void
 *   version     — bumped on tree mutations (triggers layout recompute)
 */
export default function VariationTree({ rootNode, currentNode, onSelectNode, version, trackedNodes, problemNodes, annotationVersion }) {
  const containerRef = useRef(null)
  const currentNodeRef = useRef(null)

  // Recompute layout only when tree structure changes (tracked by version)
  const { nodes, links, width, height } = useMemo(
    () => computeTreeLayout(rootNode),
    [rootNode, version]
  )

  // Derive active branch from currentNode (cheap — just walks the chain)
  const activeBranch = useMemo(
    () => computeActiveBranch(currentNode),
    [currentNode]
  )

  // Pre-compute problem node results once (not per-node during render)
  const problemResultMap = useMemo(
    () => (problemNodes && rootNode) ? buildProblemResultMap(rootNode) : null,
    [problemNodes, rootNode, version]
  )

  // Auto-scroll current node into view
  useEffect(() => {
    if (currentNodeRef.current && containerRef.current) {
      const el = currentNodeRef.current
      const container = containerRef.current
      const rect = el.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()

      // Scroll horizontally if needed
      if (rect.right > containerRect.right || rect.left < containerRect.left) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  }, [currentNode])

  return (
    <div className="variation-tree-container" ref={containerRef}>
      <svg
        className="variation-tree-svg"
        width={Math.max(width, 100)}
        height={Math.max(height, 60)}
      >
        {/* Connector lines */}
        {links.map((link, i) => (
          <line
            key={`link-${i}`}
            x1={link.x1}
            y1={link.y1}
            x2={link.x2}
            y2={link.y2}
            className="tree-link"
          />
        ))}

        {/* Nodes */}
        {nodes.map((n, i) => {
          const gn = n.gameNode
          const isCurrent = gn === currentNode
          const isActive = activeBranch.has(gn)
          const isBlack = gn.color === 'B'
          const isWhite = gn.color === 'W'
          const isTracked = trackedNodes?.has(gn)
          const problemMarker = gn._problemMarker // 'correct' | 'wrong' | undefined

          const nodeClass = [
            'tree-node',
            isBlack ? 'black-move' : isWhite ? 'white-move' : 'neutral-move',
            isActive ? 'active-branch' : '',
            isCurrent ? 'current-node' : '',
          ]
            .filter(Boolean)
            .join(' ')

          const labelClass = [
            'node-label',
            isBlack ? 'black-text' : isWhite ? 'white-text' : '',
            isActive ? 'active-branch' : '',
          ]
            .filter(Boolean)
            .join(' ')

          return (
            <g
              key={`node-${i}`}
              ref={isCurrent ? currentNodeRef : undefined}
              onClick={() => onSelectNode?.(gn)}
              style={{ cursor: 'pointer' }}
            >
              {/* Current-node highlight background */}
              {isCurrent && (
                <rect
                  x={n.x - 19}
                  y={n.y - 19}
                  width={38}
                  height={38}
                  rx={5}
                  ry={5}
                  className="current-node-bg"
                />
              )}

              {/* White background circle (so transparent fill doesn't show grid) */}
              <circle cx={n.x} cy={n.y} r={BG_RADIUS} className="node-bg" />

              {/* Colored node circle */}
              <circle cx={n.x} cy={n.y} r={NODE_RADIUS} className={nodeClass} />

              {/* Problem node ring (solution mode) — uses pre-computed result map */}
              {!isTracked && problemResultMap && gn._isProblemNode && (() => {
                const result = problemResultMap.get(gn)
                const ringClass = result === 'correct' ? 'tracked-correct' : result === 'wrong' ? 'tracked-wrong' : 'tracked-default'
                return (
                  <circle cx={n.x} cy={n.y} r={NODE_RADIUS + 3} className={`tracked-ring ${ringClass}`} />
                )
              })()}

              {/* Tracked node ring (problem authoring) — color based on reachable leaf result */}
              {isTracked && (() => {
                // Determine ring color: walk descendants to find if any path leads to correct/wrong
                let ringClass = 'tracked-default'
                if (problemMarker === 'correct') {
                  ringClass = 'tracked-correct'
                } else if (problemMarker === 'wrong') {
                  ringClass = 'tracked-wrong'
                } else {
                  // Intermediate node — check descendants
                  const findLeafResult = (node) => {
                    if (!trackedNodes?.has(node) && node !== gn) return null
                    const m = node._problemMarker
                    if (m) return m
                    const trackedKids = node.children.filter((c) => trackedNodes?.has(c))
                    if (trackedKids.length === 0) return null
                    for (const kid of trackedKids) {
                      if (findLeafResult(kid) === 'correct') return 'correct'
                    }
                    for (const kid of trackedKids) {
                      if (findLeafResult(kid) === 'wrong') return 'wrong'
                    }
                    return null
                  }
                  const result = findLeafResult(gn)
                  if (result === 'correct') ringClass = 'tracked-correct'
                  else if (result === 'wrong') ringClass = 'tracked-wrong'
                }
                return (
                  <circle cx={n.x} cy={n.y} r={NODE_RADIUS + 3} className={`tracked-ring ${ringClass}`} />
                )
              })()}

              {/* Move number label */}
              <text x={n.x} y={n.y + 4} className={labelClass}>
                {gn.moveNumber || '●'}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
