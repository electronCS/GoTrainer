import { useState } from 'react'
import './GameInfo.css'

/**
 * GameInfo — displays game metadata extracted from SGF root node properties.
 *
 * Layout:
 *   Top row: Black player (left) | White player (right) with captures
 *   Middle row: Rules, Komi, Handicap
 *   Expandable: Result, Date, Event (behind "ℹ Details" button)
 */
export default function GameInfo({ rootNode, currentNode }) {
  const [showDetails, setShowDetails] = useState(false)
  const props = rootNode?.props || {}

  const playerBlack = props.PB || ''
  const playerWhite = props.PW || ''
  const blackRank = props.BR || ''
  const whiteRank = props.WR || ''
  const komi = props.KM ?? ''
  const handicap = props.HA || ''
  const rules = props.RU || ''
  const result = props.RE || ''
  const date = props.DT || ''
  const gameName = props.GN || ''
  const event = props.EV || ''
  const place = props.PC || ''

  // Captures from @sabaki/go-board
  const board = currentNode?.board
  const blackCaptures = board ? board.getCaptures(1) : 0
  const whiteCaptures = board ? board.getCaptures(-1) : 0

  const hasPlayers = playerBlack || playerWhite
  const hasGameSettings = rules || komi !== '' || (handicap && handicap !== '0')
  const hasDetails = result || date || event || place || gameName

  if (!hasPlayers && !hasGameSettings) return null

  return (
    <div className="game-info">
      {/* Player cards: Black left, White right */}
      <div className="gi-players">
        <div className="gi-player gi-black">
          <div className="gi-stone gi-stone-black" />
          <div className="gi-player-info">
            <span className="gi-player-name">
              {playerBlack || 'Black'}
              {blackRank && <span className="gi-rank"> {blackRank}</span>}
            </span>
            <span className="gi-captures">⬟ {blackCaptures}</span>
          </div>
        </div>
        <div className="gi-player gi-white">
          <div className="gi-player-info gi-player-info-right">
            <span className="gi-player-name">
              {playerWhite || 'White'}
              {whiteRank && <span className="gi-rank"> {whiteRank}</span>}
            </span>
            <span className="gi-captures">⬟ {whiteCaptures}</span>
          </div>
          <div className="gi-stone gi-stone-white" />
        </div>
      </div>

      {/* Game settings row */}
      {hasGameSettings && (
        <div className="gi-settings">
          {rules && <span className="gi-tag">{rules}</span>}
          {komi !== '' && <span className="gi-tag">Komi {komi}</span>}
          {handicap && handicap !== '0' && <span className="gi-tag">H{handicap}</span>}
        </div>
      )}

      {/* Expandable details */}
      {hasDetails && (
        <>
          <button
            className="gi-details-btn"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? '▾ Details' : '▸ Details'}
          </button>
          {showDetails && (
            <div className="gi-details">
              {result && (
                <div className="gi-detail-row">
                  <span className="gi-detail-label">Result</span>
                  <span className="gi-detail-value">{result}</span>
                </div>
              )}
              {date && (
                <div className="gi-detail-row">
                  <span className="gi-detail-label">Date</span>
                  <span className="gi-detail-value">{date}</span>
                </div>
              )}
              {(event || place) && (
                <div className="gi-detail-row">
                  <span className="gi-detail-label">Event</span>
                  <span className="gi-detail-value">{event || place}</span>
                </div>
              )}
              {gameName && (
                <div className="gi-detail-row">
                  <span className="gi-detail-label">Game</span>
                  <span className="gi-detail-value">{gameName}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
