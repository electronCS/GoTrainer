/**
 * GameNode — a node in the game tree.
 *
 * Each node stores:
 *   - props   {Object}  SGF-style properties, e.g. { B: 'dd' } or { W: 'pp' }
 *   - parent  {GameNode|null}
 *   - children {GameNode[]}
 *   - board   {Board|null}  cached @sabaki/go-board state (set on first visit)
 *   - moveNumber {number}
 */
export class GameNode {
  constructor({ props = {}, parent = null, board = null, moveNumber = 0 } = {}) {
    this.props = props
    this.parent = parent
    this.children = []
    this.board = board // cached @sabaki/go-board Board instance
    this.moveNumber = moveNumber
    this.currentChildIndex = 0
  }

  /** The color of the move at this node, or null if it's not a move node. */
  get color() {
    if (this.props.B !== undefined) return 'B'
    if (this.props.W !== undefined) return 'W'
    return null
  }

  get isMoveNode() {
    return this.color !== null
  }

  /** SGF coordinate string for this move (e.g. 'dd'), or null. */
  get moveCoord() {
    return this.props.B ?? this.props.W ?? null
  }

  addChild(child) {
    child.parent = this
    this.children.push(child)
    return child
  }

  getNextChild() {
    return this.children[this.currentChildIndex] ?? null
  }
}
