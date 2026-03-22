/**
 * computeTreeLayout — pure function that computes (x, y) grid positions
 * for every node in a game tree.
 *
 * Layout rules:
 *   - x-axis = move depth (left → right, horizontal)
 *   - y-axis = variation row (top → bottom, vertical)
 *   - Mainline (first child) continues horizontally when possible
 *   - Variations branch downward
 *   - Collision detection via yMap prevents overlaps
 *
 * @param {GameNode} rootNode
 * @param {Object}   opts  { hSpacing, vSpacing, margin }
 * @returns {{ nodes: Array, links: Array, width: number, height: number }}
 */
export function computeTreeLayout(rootNode, opts = {}) {
  const hSpacing = opts.hSpacing ?? 36
  const vSpacing = opts.vSpacing ?? 36
  const margin = opts.margin ?? { top: 20, right: 40, bottom: 20, left: 20 }

  if (!rootNode) return { nodes: [], links: [], width: 0, height: 0 }

  // Wrap each GameNode in a layout node with depth and parent reference
  const layoutMap = new Map() // GameNode → layoutNode

  function wrap(gameNode, parent, depth) {
    if (layoutMap.has(gameNode)) return layoutMap.get(gameNode)
    const ln = { node: gameNode, parent, depth, x: undefined, y: undefined, children: [] }
    layoutMap.set(gameNode, ln)
    for (const child of gameNode.children) {
      const childLn = wrap(child, ln, depth + 1)
      ln.children.push(childLn)
    }
    return ln
  }

  const root = wrap(rootNode, null, 0)

  // yMap: for each row y, store the smallest x occupied (for collision detection)
  const yMap = new Map()

  function getYMin(y) {
    return yMap.get(y) ?? Infinity
  }

  function updateYMap(x, y) {
    if (!yMap.has(y)) yMap.set(y, Infinity)
    yMap.set(y, Math.min(yMap.get(y), x))
    // Propagate constraint upward: rows above must have even smaller x values
    // Note: z < y (not <=) — don't propagate all the way to row 0
    for (let z = 1; z < y; z++) {
      const row = y - z
      if (!yMap.has(row)) yMap.set(row, Infinity)
      yMap.set(row, Math.min(yMap.get(row), x - z))
    }
  }

  function branchLength(ln) {
    let length = 1
    let n = ln
    while (n.children.length > 0) {
      n = n.children[0]
      length++
    }
    return length
  }

  function assignPositions(ln, x, y, horizontal) {
    // Skip if already positioned
    if (ln.x !== undefined) return

    // Collision: if this row already has a node at or before this x, bump down
    if (!horizontal && getYMin(y) <= x) {
      assignPositions(ln, x, y + 1, false)
      return
    }

    ln.x = x
    ln.y = y

    // Read the previous minimum x for this row BEFORE updating —
    // this tells us how much room is left on this row for the branch.
    const oldYMin = getYMin(y)

    updateYMap(x, y)

    if (ln.children.length === 0) return

    const firstChild = ln.children[0]
    let increment = 0

    if (firstChild.x !== undefined) {
      // Already positioned — skip
    } else if (horizontal) {
      assignPositions(firstChild, x + 1, y, true)
    } else {
      const bl = branchLength(firstChild)
      if (x + bl >= oldYMin) {
        increment = 1
        assignPositions(firstChild, x + 1, y + increment, false)
      } else {
        assignPositions(firstChild, x + 1, y, true)
      }
    }

    // Remaining children are variations — each goes to a new row
    for (let i = 1; i < ln.children.length; i++) {
      const child = ln.children[i]
      if (child.x !== undefined) continue
      const nextY = y + increment + i
      assignPositions(child, x + 1, nextY, false)
    }
  }

  // Start from the rightmost (end-of-mainline) node and work backward,
  // just like the Vue version does with d3.hierarchy's .depth
  let cursor = root
  while (cursor.children.length > 0) {
    cursor = cursor.children[0]
  }

  // Walk backward from end of mainline to root
  let current = cursor
  while (current) {
    assignPositions(current, current.depth, 0, false)
    current = current.parent
  }

  // Collect nodes and links
  const nodes = []
  const links = []

  function collect(ln) {
    // x = depth → horizontal pixel position
    // y = row  → vertical pixel position
    const px = ln.x * hSpacing + margin.left
    const py = ln.y * vSpacing + margin.top

    nodes.push({
      gameNode: ln.node,
      x: px,
      y: py,
    })

    for (const child of ln.children) {
      const cx = child.x * hSpacing + margin.left
      const cy = child.y * vSpacing + margin.top

      // If vertical distance > 1 level, add intermediate connector
      if (Math.abs(child.y - ln.y) > 1) {
        const ix = px
        const iy = cy - vSpacing
        links.push({ x1: px, y1: py, x2: ix, y2: iy })
        links.push({ x1: ix, y1: iy, x2: cx, y2: cy })
      } else {
        links.push({ x1: px, y1: py, x2: cx, y2: cy })
      }

      collect(child)
    }
  }

  collect(root)

  const maxX = nodes.length > 0 ? Math.max(...nodes.map((n) => n.x)) : 0
  const maxY = nodes.length > 0 ? Math.max(...nodes.map((n) => n.y)) : 0
  const width = maxX + margin.right
  const height = maxY + margin.bottom

  return { nodes, links, width, height }
}

/**
 * Compute the set of nodes on the "active branch" — from root through
 * currentNode to the end of its mainline.
 */
export function computeActiveBranch(currentNode) {
  const set = new Set()
  if (!currentNode) return set

  // Walk up to root
  let node = currentNode
  while (node) {
    set.add(node)
    node = node.parent
  }

  // Walk down the mainline from currentNode
  node = currentNode.getNextChild()
  while (node) {
    set.add(node)
    node = node.getNextChild()
  }

  return set
}
