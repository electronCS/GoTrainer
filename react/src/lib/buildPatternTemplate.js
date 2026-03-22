/**
 * buildPatternTemplate — creates a 2D pattern array from the current board state
 * and a rectangle selection.
 *
 * @param {Board} board  — @sabaki/go-board Board instance
 * @param {{ x1, y1, x2, y2 }} selection — rectangle in board coordinates
 * @param {number} boardSize — size of the board (e.g. 19)
 * @returns {number[][]} pattern template for the search engine
 *
 * Encoding:
 *   -1 = border (off-board)
 *    0 = empty
 *    1 = black
 *    2 = white
 *    3 = wildcard (not used currently — all selected cells are encoded)
 */
export function buildPatternTemplate(board, selection, boardSize = 19) {
  if (!board || !selection) return null

  const { x1, y1, x2, y2 } = selection
  const width = x2 - x1 + 1
  const height = y2 - y1 + 1

  // Build the base pattern from board state
  const pattern = []
  for (let dy = 0; dy < height; dy++) {
    const row = []
    for (let dx = 0; dx < width; dx++) {
      const bx = x1 + dx
      const by = y1 + dy
      const sign = board.get([bx, by])
      if (sign === 1) row.push(1)       // black
      else if (sign === -1) row.push(2)  // white
      else row.push(0)                   // empty
    }
    pattern.push(row)
  }

  const lastIdx = boardSize - 1

  // Add border rows/columns if selection touches board edges
  // Bottom edge → add border row at bottom
  if (y2 === lastIdx) {
    pattern.push(Array.from({ length: pattern[0].length }, () => -1))
  }
  // Top edge → add border row at top
  if (y1 === 0) {
    pattern.unshift(Array.from({ length: pattern[0].length }, () => -1))
  }
  // Right edge → add border column on right
  if (x2 === lastIdx) {
    for (const row of pattern) row.push(-1)
  }
  // Left edge → add border column on left
  if (x1 === 0) {
    for (const row of pattern) row.unshift(-1)
  }

  return pattern
}
