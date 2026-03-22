import { useState, useEffect, useCallback } from 'react'
import './ProblemView.css'

const API_BASE = 'http://localhost:8000'

/**
 * ProblemView — problem search, selection, and solving UI.
 *
 * Props:
 *   onLoadProblem  — callback ({ sgfContent, moveNumber, correctAnswers, problem }) => void
 *   currentNode    — current GameNode (to check move coordinates)
 *   problemActive  — whether a problem is currently active
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
}) {
  const [searchTags, setSearchTags] = useState('')
  const [problems, setProblems] = useState([])
  const [allTags, setAllTags] = useState([])
  const [total, setTotal] = useState(0)
  const [currentIdx, setCurrentIdx] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)

  // Fetch available tags on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/problems/tags`)
      .then((r) => r.json())
      .then((data) => setAllTags(data.tags || []))
      .catch(() => {})
  }, [])

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
    setShowAnswer(false)
    try {
      const resp = await fetch(`${API_BASE}/api/problems/${problem.id}`)
      const data = await resp.json()
      if (data.sgf_content) {
        onLoadProblem({
          sgfContent: data.sgf_content,
          moveNumber: data.problem.move_number,
          correctAnswers: data.problem.correct_answers,
          problem: data.problem,
        })
      }
    } catch (err) {
      console.error('Failed to load problem:', err)
    }
  }, [onLoadProblem])

  const handleNextProblem = () => {
    if (currentIdx < problems.length - 1) {
      loadProblem(problems[currentIdx + 1], currentIdx + 1)
    }
  }

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

      {/* Problem answer status */}
      {problemActive && (
        <div className="pv-status">
          {problemData && (
            <div className="pv-description">{problemData.description}</div>
          )}
          {answerResult === 'correct' && (
            <div className="pv-correct">
              ✅ Correct!
              <button onClick={handleNextProblem} className="pv-next-btn">
                Next Problem →
              </button>
            </div>
          )}
          {answerResult === 'wrong' && (
            <div className="pv-wrong">❌ Wrong, try again!</div>
          )}
          {answerResult === null && (
            <div className="pv-prompt">Make your move on the board.</div>
          )}
          {answerResult !== 'correct' && (
            <button
              className="pv-show-answer-btn"
              onClick={() => {
                const next = !showAnswer
                setShowAnswer(next)
                onShowAnswerChange?.(next)
              }}
            >
              {showAnswer ? '🙈 Hide Answer' : '👁 Show Answer'}
            </button>
          )}
          {showAnswer && problemData && (
            <div className="pv-answer">
              Answer: {problemData.correctAnswers.map((c) => {
                const col = String.fromCharCode(65 + (c.charCodeAt(0) - 97))  // a→A
                const row = 19 - (c.charCodeAt(1) - 97)                       // a→19
                return `${col}${row}`
              }).join(', ')}
            </div>
          )}
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
