/**
 * buildProblemSgf — builds a self-contained problem SGF string from tracked nodes.
 *
 * Takes the current board position at the problem root and the user's
 * authored answer branches (tracked nodes), producing an SGF with:
 *   - AB/AW setup stones from the root board state
 *   - PL[B/W] for whose turn
 *   - Root C[] comment as the problem prompt
 *   - Variation branches with CORRECT:/WRONG: leaf comments
 *
 * @param {GameNode} rootNode       The problem root node (board position becomes setup)
 * @param {Set<GameNode>} trackedNodes  Nodes the user explicitly played during authoring
 * @param {number} boardSize        Board size (default 19)
 * @returns {string|null} SGF string or null if invalid
 */
export function buildProblemSgf(rootNode, trackedNodes, boardSize = 19) {
  if (!rootNode || !rootNode.board) return null

  // 1. Extract board state as AB/AW setup stones
  const blackStones = []
  const whiteStones = []
  const board = rootNode.board

  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
      const sign = board.get([x, y])
      const coord = String.fromCharCode(97 + x) + String.fromCharCode(97 + y)
      if (sign === 1) blackStones.push(coord)
      else if (sign === -1) whiteStones.push(coord)
    }
  }

  // 2. Determine PL — whose turn to play (from first tracked child, or tree logic)
  let pl = 'B'
  for (const child of rootNode.children) {
    if (trackedNodes.has(child) && child.color) {
      pl = child.color
      break
    }
  }

  // 3. Build root node properties
  let rootProps = `GM[1]SZ[${boardSize}]`

  if (blackStones.length > 0) {
    rootProps += 'AB' + blackStones.map((c) => `[${c}]`).join('')
  }
  if (whiteStones.length > 0) {
    rootProps += 'AW' + whiteStones.map((c) => `[${c}]`).join('')
  }

  rootProps += `PL[${pl}]`

  // Root comment = problem prompt
  const rootComment = rootNode.props.C || ''
  if (rootComment) {
    rootProps += `C[${escapeSgf(rootComment)}]`
  }

  // Root annotations — include LB, SQ, CR, TR, MA from the root node
  const annoProps = ['LB', 'SQ', 'CR', 'TR', 'MA']
  for (const key of annoProps) {
    const val = rootNode.props[key]
    if (val) {
      const values = Array.isArray(val) ? val : [val]
      rootProps += key + values.map((v) => `[${escapeSgf(v)}]`).join('')
    }
  }

  // 4. Build variation branches from tracked children only
  const trackedChildren = rootNode.children.filter((c) => trackedNodes.has(c))

  if (trackedChildren.length === 0) {
    return `(;${rootProps})`
  }

  let sgf = `(;${rootProps}`
  for (const child of trackedChildren) {
    sgf += buildVariation(child, trackedNodes)
  }
  sgf += ')'

  return sgf
}

/**
 * Build a variation sub-tree (game tree) for one answer branch.
 * Produces "(;B[dd];W[pp];B[qd]C[CORRECT: ...])" etc.
 */
function buildVariation(node, trackedNodes) {
  let sgf = '(;' + buildNodeProps(node, trackedNodes)

  let current = node
  let children = current.children.filter((c) => trackedNodes.has(c))

  // Follow linear sequence
  while (children.length === 1) {
    current = children[0]
    sgf += ';' + buildNodeProps(current, trackedNodes)
    children = current.children.filter((c) => trackedNodes.has(c))
  }

  // If there's a branch point, recurse into sub-variations
  if (children.length > 1) {
    for (const child of children) {
      sgf += buildVariation(child, trackedNodes)
    }
  }

  sgf += ')'
  return sgf
}

/**
 * Build the SGF property string for a single node.
 * Handles move (B/W), comment (C), and CORRECT/WRONG leaf markers.
 */
function buildNodeProps(node, trackedNodes) {
  let props = ''

  // Move property
  const color = node.color
  const coord = node.moveCoord
  if (color && coord) {
    props += `${color}[${coord}]`
  }

  // Comment — prefix with CORRECT:/WRONG: if this is a marked leaf
  const isLeaf = !node.children.some((c) => trackedNodes.has(c))
  const marker = node._problemMarker // 'correct' | 'wrong' | undefined
  const comment = node.props.C || ''

  if (isLeaf && marker) {
    const prefix = marker === 'correct' ? 'CORRECT: ' : 'WRONG: '
    props += `C[${escapeSgf(prefix + comment)}]`
  } else if (comment) {
    props += `C[${escapeSgf(comment)}]`
  }

  // Annotations — include LB, SQ, CR, TR, MA if present
  const annoProps = ['LB', 'SQ', 'CR', 'TR', 'MA']
  for (const key of annoProps) {
    const val = node.props[key]
    if (val) {
      const values = Array.isArray(val) ? val : [val]
      props += key + values.map((v) => `[${escapeSgf(v)}]`).join('')
    }
  }

  return props
}

/**
 * Escape text for SGF value (escape backslash and closing bracket).
 */
function escapeSgf(text) {
  return text.replace(/\\/g, '\\\\').replace(/]/g, '\\]')
}

/**
 * Get all tracked leaf nodes (tracked nodes with no tracked children).
 */
export function getTrackedLeaves(rootNode, trackedNodes) {
  const leaves = []

  function walk(node) {
    if (!trackedNodes.has(node) && node !== rootNode) return
    const trackedChildren = node.children.filter((c) => trackedNodes.has(c))
    if (trackedChildren.length === 0 && trackedNodes.has(node)) {
      leaves.push(node)
    } else {
      for (const child of trackedChildren) {
        walk(child)
      }
    }
  }

  // Start from root's tracked children
  for (const child of rootNode.children) {
    walk(child)
  }

  return leaves
}

/**
 * Get the move path from rootNode down to a target node (only tracked nodes).
 * Returns an array of { color, coord } objects.
 */
export function getPathToNode(rootNode, targetNode) {
  const path = []
  let node = targetNode
  while (node && node !== rootNode) {
    if (node.color && node.moveCoord) {
      path.unshift({ color: node.color, coord: node.moveCoord })
    }
    node = node.parent
  }
  return path
}
