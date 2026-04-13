import { useState, useMemo, useCallback } from 'react'
import { buildProblemSgf, getTrackedLeaves, getPathToNode } from '../lib/buildProblemSgf'
import './ProblemAuthor.css'

const API_BASE = 'http://localhost:8000'
const GTP_LETTERS = 'ABCDEFGHJKLMNOPQRSTUVWXYZ'

function coordToDisplay(sgfCoord) {
  if (!sgfCoord || sgfCoord.length !== 2) return sgfCoord
  const x = sgfCoord.charCodeAt(0) - 97
  const y = sgfCoord.charCodeAt(1) - 97
  return `${GTP_LETTERS[x]}${19 - y}`
}

/**
 * ProblemAuthor — side-panel UI for creating problems from the current position.
 *
 * The user plays moves on the board; each new/visited node is added to trackedNodes.
 * Leaf nodes are marked CORRECT or WRONG. On save, buildProblemSgf() generates
 * the problem SGF from only the tracked portion of the tree.
 *
 * Props:
 *   problemRootNode  — the GameNode that is the root of the problem
 *   trackedNodes     — Set<GameNode> of user-authored nodes
 *   currentNode      — the currently active GameNode
 *   boardSize        — board size (19)
 *   sourceSgfPath    — auto-populated source SGF file path (or null)
 *   sourceMoveNumber — move number at the problem root
 *   onCancel         — callback to exit authoring mode
 *   onSaved          — callback after successful save
 *   onGoToNode       — callback (node) => void to navigate
 *   annotationVersion — bumped after marker changes to force re-render
 *   onAnnotationBump  — callback to bump annotationVersion
 */
export default function ProblemAuthor({
  problemRootNode,
  trackedNodes,
  currentNode,
  boardSize,
  sourceSgfPath,
  sourceMoveNumber,
  onCancel,
  onSaved,
  onGoToNode,
  annotationVersion,
  onAnnotationBump,
  editingProblemId,
  initialTags,
}) {
  const [tags, setTags] = useState(initialTags || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  // Compute tracked leaves and their markers
  const leaves = useMemo(
    () => getTrackedLeaves(problemRootNode, trackedNodes),
    [problemRootNode, trackedNodes, annotationVersion]
  )

  // Build a display-friendly tree of tracked branches
  const branches = useMemo(() => {
    const result = []

    function buildBranch(node, path) {
      const step = {
        node,
        color: node.color,
        coord: node.moveCoord,
        displayCoord: coordToDisplay(node.moveCoord),
        marker: node._problemMarker || null,
        comment: node.props.C || '',
      }
      path = [...path, step]

      const trackedChildren = node.children.filter((c) => trackedNodes.has(c))
      if (trackedChildren.length === 0) {
        // Leaf — this is a complete branch
        result.push(path)
      } else if (trackedChildren.length === 1) {
        buildBranch(trackedChildren[0], path)
      } else {
        // Branch point — recurse into each
        for (const child of trackedChildren) {
          buildBranch(child, path)
        }
      }
    }

    const rootChildren = problemRootNode.children.filter((c) => trackedNodes.has(c))
    for (const child of rootChildren) {
      buildBranch(child, [])
    }

    return result
  }, [problemRootNode, trackedNodes, annotationVersion])

  // Toggle marker on a leaf node
  const toggleMarker = useCallback((node, marker) => {
    if (node._problemMarker === marker) {
      delete node._problemMarker
    } else {
      node._problemMarker = marker
    }
    onAnnotationBump?.()
  }, [onAnnotationBump])

  // Check if all leaves are marked
  const allMarked = leaves.length > 0 && leaves.every((n) => n._problemMarker)
  const hasAnyBranches = branches.length > 0

  const handleSave = useCallback(async () => {
    if (!allMarked) {
      setError('Please mark all leaf nodes as CORRECT or WRONG before saving.')
      return
    }

    const sgf = buildProblemSgf(problemRootNode, trackedNodes, boardSize)
    if (!sgf) {
      setError('Failed to build problem SGF.')
      return
    }

    const problem = {
      sgf,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      description: problemRootNode.props.C || '',
      source_sgf_file: sourceSgfPath || null,
      source_move_number: sourceMoveNumber ?? null,
    }

    setSaving(true)
    setError(null)

    try {
      const isEditing = !!editingProblemId
      const url = isEditing
        ? `${API_BASE}/api/problems/${editingProblemId}`
        : `${API_BASE}/api/problems`
      const resp = await fetch(url, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(problem),
      })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const created = await resp.json()
      onSaved?.(created)
    } catch (err) {
      setError(`Save failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }, [allMarked, problemRootNode, trackedNodes, boardSize, tags, sourceSgfPath, sourceMoveNumber, onSaved])

  // Check if current node is the problem root
  const atRoot = currentNode === problemRootNode
  // Check if current node is a tracked leaf
  const isTrackedLeaf = trackedNodes.has(currentNode) &&
    !currentNode.children.some((c) => trackedNodes.has(c))

  return (
    <div className="problem-author">
      <div className="pa-header">
        <h3>📌 {editingProblemId ? 'Editing Problem' : 'Creating Problem'}</h3>
        {editingProblemId
          ? <span className="pa-move-info">ID: {editingProblemId}</span>
          : <span className="pa-move-info">at move {problemRootNode.moveNumber}</span>
        }
      </div>

      {/* Instructions */}
      <div className="pa-instructions">
        {atRoot && !hasAnyBranches && (
          <p>Play moves on the board to create answer branches. Navigate back to this position to start new variations.</p>
        )}
        {atRoot && hasAnyBranches && (
          <p>Play more moves for new variations, or mark existing branches below.</p>
        )}
        {!atRoot && !isTrackedLeaf && (
          <p>Continue playing moves, or navigate back to the root to start a new branch.</p>
        )}
        {!atRoot && isTrackedLeaf && (
          <p>This is a leaf — mark it as correct or wrong below, then navigate back.</p>
        )}
      </div>

      {/* Comment box for current node — edits go to problem SGF */}
      <div className="pa-comment-box-wrapper">
        <label className="pa-comment-label">
          {currentNode === problemRootNode ? 'Problem prompt:' : 'Comment for this move:'}
        </label>
        <textarea
          className="pa-comment-box"
          value={currentNode?.props?.C || ''}
          placeholder={currentNode === problemRootNode
            ? 'Describe the problem (e.g. "Find the correct response after White\'s invasion")'
            : 'Add a comment explaining this move...'}
          onChange={(e) => {
            if (currentNode) {
              currentNode.props.C = e.target.value || undefined
              onAnnotationBump?.()
            }
          }}
        />
      </div>

      {/* Inline leaf marker — shown when at a tracked leaf */}
      {isTrackedLeaf && (
        <div className="pa-leaf-marker">
          <span className="pa-leaf-label">Mark this move:</span>
          <button
            className={`pa-mark-btn pa-mark-correct ${currentNode._problemMarker === 'correct' ? 'active' : ''}`}
            onClick={() => toggleMarker(currentNode, 'correct')}
          >
            ✅ Correct
          </button>
          <button
            className={`pa-mark-btn pa-mark-wrong ${currentNode._problemMarker === 'wrong' ? 'active' : ''}`}
            onClick={() => toggleMarker(currentNode, 'wrong')}
          >
            ❌ Wrong
          </button>
        </div>
      )}

      {/* Branch overview */}
      {hasAnyBranches && (
        <div className="pa-branches">
          <div className="pa-branches-header">
            Answer Branches ({branches.length})
          </div>
          <div className="pa-branches-list">
            {branches.map((path, bi) => {
              const leaf = path[path.length - 1]
              const marker = leaf.marker
              return (
                <div
                  key={bi}
                  className={`pa-branch ${marker === 'correct' ? 'pa-branch-correct' : marker === 'wrong' ? 'pa-branch-wrong' : 'pa-branch-unmarked'}`}
                  onClick={() => onGoToNode?.(leaf.node)}
                >
                  <span className="pa-branch-moves">
                    {path.map((step, si) => (
                      <span key={si} className={`pa-step pa-step-${step.color === 'B' ? 'black' : 'white'}`}>
                        {step.displayCoord}
                        {si < path.length - 1 && ' → '}
                      </span>
                    ))}
                  </span>
                  <span className="pa-branch-marker">
                    {marker === 'correct' ? '✅' : marker === 'wrong' ? '❌' : '⬜'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Problem metadata */}
      <div className="pa-meta">
        <label className="pa-field">
          <span>Tags</span>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="joseki, difficulty:2, opening..."
          />
        </label>
        {sourceSgfPath && (
          <div className="pa-source">
            Source: {sourceSgfPath.split('/').pop()} @ move {sourceMoveNumber}
          </div>
        )}
      </div>

      {/* Error message */}
      {error && <div className="pa-error">{error}</div>}

      {/* Action buttons */}
      <div className="pa-actions">
        <button className="pa-cancel-btn" onClick={onCancel}>Cancel</button>
        <button
          className="pa-save-btn"
          onClick={handleSave}
          disabled={saving || !hasAnyBranches}
          title={!hasAnyBranches ? 'Play some moves first' : !allMarked ? 'Mark all leaves first' : 'Save problem'}
        >
          {saving ? 'Saving...' : editingProblemId ? '💾 Update Problem' : '💾 Save Problem'}
        </button>
      </div>

      {/* Navigate to root button */}
      {!atRoot && (
        <button
          className="pa-goto-root-btn"
          onClick={() => onGoToNode?.(problemRootNode)}
        >
          ↩ Back to Problem Root
        </button>
      )}
    </div>
  )
}
