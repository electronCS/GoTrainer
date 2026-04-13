import { useState, useEffect, useCallback } from 'react'
import './ProblemView.css'

const API_BASE = 'http://localhost:8000'

/**
 * ProblemView — problem search, selection, and solving UI.
 *
 * Modes:
 *   "try"     — user plays moves, gets correct/wrong feedback
 *   "solution" — all answer branches visible, user can click through them
 *
 * Props:
 *   onLoadProblem  — callback ({ problemSgf, sourceSgfContent, sourceMoveNumber, problem }) => void
 *   currentNode    — current GameNode
 *   problemActive  — whether a problem is currently active
 *   problemData    — { correctAnswers, description, problem }
 *   answerResult   — 'correct' | 'wrong' | null
 *   onShowAnswerChange — callback (bool) => void — toggles answer markers on board
 *   onResetProblem — callback () => void — reset to problem root
 *   problemSolveMode — 'try' | 'solution'
 *   onSolveModeChange — callback (mode) => void
 */
export default function ProblemView({
  onLoadProblem,
  currentNode,
  problemActive,
  problemData,
  onCheckAnswer,
  answerResult,
  onNextProblem,
  onShowAnswerChange,
  onResetProblem,
  problemSolveMode,
  onSolveModeChange,
  onEditProblem,
  onDeleteProblem,
}) {
  const [searchTags, setSearchTags] = useState('')
  const [problems, setProblems] = useState([])
  const [allTags, setAllTags] = useState([])
  const [total, setTotal] = useState(0)
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [loading, setLoading] = useState(false)

  // Fetch available tags on mount + restore saved problem (URL hash takes priority)
  useEffect(() => {
    fetch(`${API_BASE}/api/problems/tags`)
      .then((r) => r.json())
      .then((data) => setAllTags(data.tags || []))
      .catch(() => {})

    // Check URL hash for problem ID first, then fall back to localStorage
    const hash = window.location.hash.replace(/^#\/?/, '')
    const parts = hash.split('/')
    const hashProblemId = parts[0] === 'problem' ? parts[1] : null
    const savedId = hashProblemId || localStorage.getItem('gotrainer_problem_id')

    if (savedId) {
      fetch(`${API_BASE}/api/problems/${savedId}`)
        .then((r) => r.json())
        .then((data) => {
          if (data.problem?.sgf) {
            onLoadProblem({
              problemSgf: data.problem.sgf,
              sourceSgfContent: data.source_sgf_content || null,
              sourceMoveNumber: data.problem.source_move_number ?? null,
              problem: data.problem,
            })
          }
        })
        .catch(() => {})
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (searchTags.trim()) params.set('tags', searchTags.trim())
      params.set('limit', '100')

      const resp = await fetch(`${API_BASE}/api/problems?${params}`)
      const data = await resp.json()
      setProblems(data.problems || [])
      setTotal(data.total || 0)
      setCurrentIdx(-1)
    } catch (err) {
      console.error('Failed to search problems:', err)
    }
    setLoading(false)
  }, [searchTags])

  const loadProblem = useCallback(async (problem, idx) => {
    setCurrentIdx(idx)
    try {
      const resp = await fetch(`${API_BASE}/api/problems/${problem.id}`)
      const data = await resp.json()
      if (data.problem?.sgf) {
        onLoadProblem({
          problemSgf: data.problem.sgf,
          sourceSgfContent: data.source_sgf_content || null,
          sourceMoveNumber: data.problem.source_move_number ?? null,
          problem: data.problem,
        })
      }
    } catch (err) {
      console.error('Failed to load problem:', err)
    }
  }, [onLoadProblem])

  const handlePrevProblem = () => {
    if (currentIdx > 0) {
      loadProblem(problems[currentIdx - 1], currentIdx - 1)
    }
  }

  const handleNextProblem = () => {
    if (currentIdx < problems.length - 1) {
      loadProblem(problems[currentIdx + 1], currentIdx + 1)
    }
  }

  const isSolutionMode = problemSolveMode === 'solution'

  // Format a comment — strip CORRECT:/WRONG: prefix, return { icon, text }
  const formatComment = (raw) => {
    if (!raw) return null
    if (raw.startsWith('CORRECT:')) return { icon: '✅', cls: 'pv-comment-correct', text: raw.replace(/^CORRECT:\s*/, '') }
    if (raw.startsWith('CORRECT')) return { icon: '✅', cls: 'pv-comment-correct', text: raw.replace(/^CORRECT\s*/, '') }
    if (raw.startsWith('WRONG:')) return { icon: '❌', cls: 'pv-comment-wrong', text: raw.replace(/^WRONG:\s*/, '') }
    if (raw.startsWith('WRONG')) return { icon: '❌', cls: 'pv-comment-wrong', text: raw.replace(/^WRONG\s*/, '') }
    return { icon: null, cls: '', text: raw }
  }

  const commentInfo = formatComment(currentNode?.props?.C)

  return (
    <div className="problem-view">
      <h3>Problems</h3>

      {/* Tag search */}
      <div className="pv-search">
        <input
          type="text"
          value={searchTags}
          onChange={(e) => setSearchTags(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search tags (comma-separated)..."
        />
        <button onClick={handleSearch} disabled={loading}>
          {loading ? '...' : '🔍'}
        </button>
      </div>

      {/* Available tags */}
      {allTags.length > 0 && !problems.length && (
        <div className="pv-tags">
          {allTags.map((tag) => (
            <span
              key={tag}
              className="pv-tag"
              onClick={() => {
                setSearchTags(tag)
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Problem controls — mode toggle + reset */}
      {problemActive && (
        <div className="pv-controls">
          <div className="pv-mode-toggle">
            <button
              className={`pv-mode-btn ${!isSolutionMode ? 'pv-mode-active' : ''}`}
              onClick={() => {
                onSolveModeChange?.('try')
                onShowAnswerChange?.(false)
              }}
            >
              🎯 Try
            </button>
            <button
              className={`pv-mode-btn ${isSolutionMode ? 'pv-mode-active' : ''}`}
              onClick={() => {
                onSolveModeChange?.('solution')
                onShowAnswerChange?.(true)
              }}
            >
              💡 View Solution
            </button>
          </div>

          <button
            className="pv-reset-btn"
            onClick={onResetProblem}
            title="Reset to problem start"
          >
            ↩ Reset
          </button>
        </div>
      )}

      {/* Problem answer status (try mode) — includes comment text inline */}
      {problemActive && !isSolutionMode && (
        <div className="pv-status">
          {answerResult === 'correct' && (
            <div className="pv-correct">
              ✅ {commentInfo?.text ? commentInfo.text : 'Correct!'}
              <div className="pv-after-correct">
                <button onClick={onResetProblem} className="pv-reset-small-btn">
                  ↩ Try Again
                </button>
                <button onClick={handleNextProblem} className="pv-next-btn">
                  Next Problem →
                </button>
              </div>
            </div>
          )}
          {answerResult === 'wrong' && (
            <div className="pv-wrong">❌ {commentInfo?.text ? commentInfo.text : 'Wrong — try again or view the solution'}</div>
          )}
          {answerResult === null && (
            <>
              <div className="pv-prompt">Make your move on the board.</div>
              {commentInfo && commentInfo.text && !commentInfo.icon && (
                <div className="pv-comment-display">{commentInfo.text}</div>
              )}
            </>
          )}
        </div>
      )}

      {/* Comment display in solution mode — strips CORRECT:/WRONG: prefix */}
      {problemActive && isSolutionMode && commentInfo && (
        <div className={`pv-comment-display ${commentInfo.cls}`}>
          {commentInfo.icon && <span className="pv-comment-icon">{commentInfo.icon}</span>}
          {commentInfo.text && <span className="pv-comment-text">{commentInfo.text}</span>}
        </div>
      )}

      {/* Solution mode hint */}
      {problemActive && isSolutionMode && !commentInfo && (
        <div className="pv-solution-info">
          <p>Browse the variation tree to explore all answer branches.</p>
        </div>
      )}

      {/* Edit / Delete buttons */}
      {problemActive && problemData?.problem && (
        <div className="pv-manage">
          <button
            className="pv-edit-btn"
            onClick={() => onEditProblem?.(problemData.problem)}
            title="Edit this problem in the authoring UI"
          >
            ✏️ Edit
          </button>
          <button
            className="pv-delete-btn"
            onClick={() => {
              if (window.confirm(`Delete problem "${problemData.problem.description || problemData.problem.id}"?`)) {
                onDeleteProblem?.(problemData.problem.id)
              }
            }}
            title="Delete this problem"
          >
            🗑️ Delete
          </button>
        </div>
      )}

      {/* Prev / Next navigation */}
      {problemActive && problems.length > 1 && currentIdx >= 0 && (
        <div className="pv-nav">
          <button
            className="pv-nav-btn"
            onClick={handlePrevProblem}
            disabled={currentIdx <= 0}
          >
            ← Previous
          </button>
          <span className="pv-nav-label">{currentIdx + 1} / {problems.length}</span>
          <button
            className="pv-nav-btn"
            onClick={handleNextProblem}
            disabled={currentIdx >= problems.length - 1}
          >
            Next →
          </button>
        </div>
      )}

      {/* Results list */}
      {problems.length > 0 && (
        <div className="pv-results">
          <div className="pv-results-header">
            {total} problem{total !== 1 ? 's' : ''} found
            {currentIdx >= 0 && ` — #${currentIdx + 1}`}
          </div>
          <div className="pv-results-list">
            {problems.map((p, i) => (
              <div
                key={p.id}
                className={`pv-item ${i === currentIdx ? 'pv-item-active' : ''}`}
                onClick={() => loadProblem(p, i)}
              >
                <span className="pv-item-desc">
                  {p.description || p.id}
                </span>
                <span className="pv-item-tags">
                  {p.tags.slice(0, 3).join(', ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
