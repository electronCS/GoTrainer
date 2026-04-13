import Board from '@sabaki/go-board'
import { GameNode } from './GameNode.js'
import { parseSgf } from './sgfParser.js'

/**
 * GameTree — pure-JS class that manages a game tree and board state.
 *
 * Usage:
 *   const tree = new GameTree(19)
 *   tree.playMove(3, 3)   // Black at (3,3)
 *   tree.playMove(15, 15) // White at (15,15)
 *   tree.undo()           // back to Black's move
 *   tree.getStones()      // [{ x:3, y:3, color:'black' }]
 *
 * Board state is cached on each GameNode for O(1) navigation.
 */
export class GameTree {
  /**
   * @param {number} size  Board size (9, 13, or 19)
   */
  constructor(size = 19) {
    this.size = size
    const emptyBoard = Board.fromDimensions(size)

    // Root node — no move, just the empty board
    this.root = new GameNode({
      props: {},
      board: emptyBoard,
      moveNumber: 0,
    })

    this.currentNode = this.root
  }

  /** Whose turn is it? Returns 'B' or 'W'. */
  get currentTurn() {
    // After a Black move → White's turn, and vice-versa.
    const lastColor = this.currentNode.color
    if (lastColor === 'B') return 'W'
    if (lastColor === 'W') return 'B'

    // No move at this node (root or setup node) — check for handicap / PL property
    // Walk up to find the nearest node with setup info
    let node = this.currentNode
    while (node) {
      // PL property explicitly sets who plays next
      if (node.props.PL) return node.props.PL === 'W' || node.props.PL === 'w' ? 'W' : 'B'
      // AB without AW on root = handicap → White plays first
      if (node.props.AB && !node.props.AW) return 'W'
      node = node.parent
    }
    return 'B' // default: Black goes first
  }

  /**
   * Play a stone at (x, y) for the current turn.
   * Returns true if the move was made, false if illegal.
   *
   * If a child node already exists with this exact move, navigates there
   * instead of creating a duplicate.
   */
  playMove(x, y) {
    const turn = this.currentTurn
    const sgfCoord = this._toSgfCoord(x, y)

    // Check if a child already exists with this move
    const existing = this.currentNode.children.find(
      (child) => child.props[turn] === sgfCoord
    )
    if (existing) {
      this.currentNode = existing
      return true
    }

    // Compute the new board state
    // sabaki sign: 1 = black, -1 = white
    const sign = turn === 'B' ? 1 : -1
    const parentBoard = this.currentNode.board

    // Check if intersection is already occupied
    if (parentBoard.get([x, y]) !== 0) {
      return false
    }

    let newBoard
    try {
      newBoard = parentBoard.makeMove(sign, [x, y])
    } catch {
      // Illegal move (e.g. suicide without capture)
      return false
    }

    // Create and attach the new node
    const newNode = new GameNode({
      props: { [turn]: sgfCoord },
      board: newBoard,
      moveNumber: this.currentNode.moveNumber + 1,
    })

    this.currentNode.addChild(newNode)
    // Update parent's currentChildIndex to point to the new child
    // so undo→redo returns to this branch
    this.currentNode.currentChildIndex = this.currentNode.children.length - 1
    this.currentNode = newNode
    return true
  }

  /** Navigate to the parent node. Returns false if already at root.
   *  Updates the parent's currentChildIndex so redo() returns to the same branch. */
  undo() {
    if (!this.currentNode.parent) return false
    const parent = this.currentNode.parent
    // Remember which child we came from so redo() follows the same branch
    const idx = parent.children.indexOf(this.currentNode)
    if (idx >= 0) {
      parent.currentChildIndex = idx
    }
    this.currentNode = parent
    return true
  }

  /** Navigate to the next child. Returns false if no children. */
  redo() {
    const next = this.currentNode.getNextChild()
    if (!next) return false
    this.currentNode = next
    return true
  }

  /** Jump to the root node. */
  goToStart() {
    this.currentNode = this.root
  }

  /** Follow the main line to the end. */
  goToEnd() {
    let node = this.currentNode
    while (node.children.length > 0) {
      node = node.getNextChild()
    }
    this.currentNode = node
  }

  /** Go back N moves (or to root). */
  goBackN(n) {
    for (let i = 0; i < n; i++) {
      if (!this.undo()) break
    }
  }

  /** Go forward N moves along the main line. */
  goForwardN(n) {
    for (let i = 0; i < n; i++) {
      if (!this.redo()) break
    }
  }

  /** Navigate to a specific node.
   *  Updates currentChildIndex along the path so the branch is remembered. */
  goToNode(node) {
    // Walk from node up to root, updating each parent's currentChildIndex
    let child = node
    let parent = child.parent
    while (parent) {
      const idx = parent.children.indexOf(child)
      if (idx >= 0) {
        parent.currentChildIndex = idx
      }
      child = parent
      parent = child.parent
    }
    this.currentNode = node
  }

  /** Save the current tree state (root + currentNode). */
  saveSnapshot() {
    return { root: this.root, currentNode: this.currentNode, size: this.size }
  }

  /** Restore a previously saved tree state. */
  restoreSnapshot(snapshot) {
    this.root = snapshot.root
    this.currentNode = snapshot.currentNode
    this.size = snapshot.size
  }

  /**
   * Extract the stones array from the current board state.
   * Returns [{ x, y, color: 'black'|'white' }, ...]
   */
  getStones() {
    const board = this.currentNode.board
    if (!board) return []

    const stones = []
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        const sign = board.get([x, y])
        if (sign === 1) {
          stones.push({ x, y, color: 'black' })
        } else if (sign === -1) {
          stones.push({ x, y, color: 'white' })
        }
      }
    }
    return stones
  }

  /**
   * Get the last move's coordinates, or null.
   * Returns { x, y, color: 'B'|'W' } or null.
   */
  getLastMove() {
    const node = this.currentNode
    if (!node.isMoveNode) return null
    const coord = node.moveCoord
    const [x, y] = this._fromSgfCoord(coord)
    return { x, y, color: node.color }
  }

  /**
   * Load a game from an SGF string. Replaces the current tree.
   * @param {string} sgfString
   */
  loadSgf(sgfString) {
    const parsed = parseSgf(sgfString)

    // Detect board size from root props (SZ property), default 19
    const sz = parseInt(parsed.props.SZ, 10)
    if (sz && sz > 0) this.size = sz

    const emptyBoard = Board.fromDimensions(this.size)

    // Convert the parsed tree into GameNodes with cached boards
    const convertNode = (parsedNode, parentGameNode, parentBoard, moveNumber) => {
      const props = parsedNode.props
      const isMoveNode = props.B !== undefined || props.W !== undefined

      let board = parentBoard
      const newMoveNumber = isMoveNode ? moveNumber + 1 : moveNumber

      // Handle setup properties AB (Add Black) and AW (Add White)
      // These are used for handicap stones and arbitrary board setup
      if (props.AB || props.AW) {
        // Clone board first — board.set() mutates in place, unlike makeMove()
        board = board.clone()
        const addStones = (propValue, sign) => {
          // propValue can be a single string or an array of strings
          const coords = Array.isArray(propValue) ? propValue : [propValue]
          for (const coord of coords) {
            if (coord && coord.length === 2) {
              const [x, y] = this._fromSgfCoord(coord)
              if (board.has([x, y])) {
                board.set([x, y], sign)
              }
            }
          }
        }
        if (props.AB) addStones(props.AB, 1)   // black stones
        if (props.AW) addStones(props.AW, -1)  // white stones
      }

      if (isMoveNode) {
        const color = props.B !== undefined ? 'B' : 'W'
        const coord = props[color]
        const sign = color === 'B' ? 1 : -1

        if (coord && coord.length === 2) {
          const [x, y] = this._fromSgfCoord(coord)
          try {
            // Use `board` (not parentBoard) so setup stones (AB/AW) are preserved
            board = board.makeMove(sign, [x, y])
          } catch {
            // Invalid move in SGF — keep current board state
          }
        }
        // else: pass move — board stays the same
      }

      const gameNode = new GameNode({
        props,
        board,
        moveNumber: newMoveNumber,
      })

      if (parentGameNode) {
        parentGameNode.addChild(gameNode)
      }

      // Recurse into children
      for (const child of parsedNode.children) {
        convertNode(child, gameNode, board, newMoveNumber)
      }

      return gameNode
    }

    this.root = convertNode(parsed, null, emptyBoard, 0)
    this.currentNode = this.root
  }

  /**
   * Inject variation branches from a problem SGF at the current node.
   * Parses the problem SGF, takes its root's children (answer branches),
   * and attaches them as new children of the current node with proper
   * board state caching.
   *
   * @param {string} problemSgf  SGF string with problem variations
   * @returns {number} number of variations injected
   */
  injectVariations(problemSgf) {
    const parsed = parseSgf(problemSgf)
    if (!parsed?.children?.length) return 0

    const currentBoard = this.currentNode.board
    const currentMoveNumber = this.currentNode.moveNumber
    let count = 0

    const convertAndAttach = (parsedNode, parentGameNode, parentBoard, moveNumber) => {
      const props = parsedNode.props
      const isMoveNode = props.B !== undefined || props.W !== undefined
      let board = parentBoard
      const newMoveNumber = isMoveNode ? moveNumber + 1 : moveNumber

      if (isMoveNode) {
        const color = props.B !== undefined ? 'B' : 'W'
        const coord = props[color]
        const sign = color === 'B' ? 1 : -1

        if (coord && coord.length === 2) {
          const [x, y] = this._fromSgfCoord(coord)
          try {
            board = board.makeMove(sign, [x, y])
          } catch {
            // Invalid move — keep current board
          }
        }
      }

      const gameNode = new GameNode({
        props,
        board,
        moveNumber: newMoveNumber,
      })

      parentGameNode.addChild(gameNode)

      for (const child of parsedNode.children) {
        convertAndAttach(child, gameNode, board, newMoveNumber)
      }
    }

    // Copy the problem root's comment to the injection node (problem description)
    if (parsed.props?.C && !this.currentNode.props.C) {
      this.currentNode.props.C = parsed.props.C
    }

    // Attach each child of the problem root as a variation at the current node
    // Skip if a child with the same move already exists (dedup on re-inject)
    for (const child of parsed.children) {
      const move = child.props?.B || child.props?.W
      const color = child.props?.B !== undefined ? 'B' : 'W'
      const alreadyExists = move && this.currentNode.children.some(
        (existing) => existing.props[color] === move && existing.props.C === child.props?.C
      )
      if (!alreadyExists) {
        convertAndAttach(child, this.currentNode, currentBoard, currentMoveNumber)
        count++
      }
    }

    return count
  }

  // --- Internal helpers ---

  _toSgfCoord(x, y) {
    return String.fromCharCode(97 + x) + String.fromCharCode(97 + y)
  }

  _fromSgfCoord(coord) {
    return [
      coord.charCodeAt(0) - 97,
      coord.charCodeAt(1) - 97,
    ]
  }
}
