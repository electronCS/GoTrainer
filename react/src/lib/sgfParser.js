/**
 * sgfParser — lightweight SGF parser.
 *
 * Parses an SGF string into a plain tree of { props, children }.
 * Does NOT create GameNode instances — that's GameTree's job.
 *
 * SGF format recap:
 *   (;prop1[val1]prop2[val2];B[dd];W[pp](;B[dp])(;B[qd]))
 *   - Parentheses delimit game trees / variations
 *   - Semicolons delimit nodes
 *   - Properties are KEY[value] pairs (key is uppercase letters)
 *   - A property can have multiple values: KEY[v1][v2][v3]
 */

/**
 * Parse an SGF string into a tree.
 * @param {string} sgf
 * @returns {{ props: Object, children: Array }}
 */
export function parseSgf(sgf) {
  let pos = 0

  function skipWhitespace() {
    while (pos < sgf.length && /\s/.test(sgf[pos])) pos++
  }

  function parseValue() {
    // Expect '['
    if (sgf[pos] !== '[') throw new Error(`Expected '[' at pos ${pos}`)
    pos++ // skip '['

    let value = ''
    while (pos < sgf.length && sgf[pos] !== ']') {
      // Handle escape: backslash escapes the next character
      if (sgf[pos] === '\\' && pos + 1 < sgf.length) {
        pos++
        value += sgf[pos]
      } else {
        value += sgf[pos]
      }
      pos++
    }

    if (sgf[pos] === ']') pos++ // skip ']'
    return value
  }

  function parseNode() {
    // Expect ';'
    if (sgf[pos] !== ';') throw new Error(`Expected ';' at pos ${pos}`)
    pos++ // skip ';'

    const props = {}

    skipWhitespace()

    // Parse properties until we hit ';', '(', ')' or end
    while (pos < sgf.length && sgf[pos] !== ';' && sgf[pos] !== '(' && sgf[pos] !== ')') {
      skipWhitespace()
      if (pos >= sgf.length || sgf[pos] === ';' || sgf[pos] === '(' || sgf[pos] === ')') break

      // Read property key (uppercase letters)
      let key = ''
      while (pos < sgf.length && /[A-Za-z]/.test(sgf[pos])) {
        key += sgf[pos]
        pos++
      }

      if (!key) {
        // Skip unexpected character
        pos++
        continue
      }

      skipWhitespace()

      // Read one or more values [val1][val2]...
      const values = []
      while (pos < sgf.length && sgf[pos] === '[') {
        values.push(parseValue())
        skipWhitespace()
      }

      // Store as single value or array
      if (values.length === 1) {
        props[key] = values[0]
      } else if (values.length > 1) {
        props[key] = values
      }

      skipWhitespace()
    }

    return { props, children: [] }
  }

  function parseGameTree() {
    // Expect '('
    if (sgf[pos] !== '(') throw new Error(`Expected '(' at pos ${pos}`)
    pos++ // skip '('

    skipWhitespace()

    // Parse sequence of nodes
    let firstNode = null
    let currentNode = null

    while (pos < sgf.length && sgf[pos] === ';') {
      const node = parseNode()
      if (!firstNode) {
        firstNode = node
        currentNode = node
      } else {
        currentNode.children.push(node)
        currentNode = node
      }
      skipWhitespace()
    }

    // Parse child variations (sub-game-trees)
    while (pos < sgf.length && sgf[pos] === '(') {
      const childTree = parseGameTree()
      if (childTree && currentNode) {
        currentNode.children.push(childTree)
      }
      skipWhitespace()
    }

    // Expect ')'
    if (pos < sgf.length && sgf[pos] === ')') pos++ // skip ')'

    return firstNode
  }

  skipWhitespace()

  // An SGF file can have multiple game trees; we take the first
  if (pos < sgf.length && sgf[pos] === '(') {
    return parseGameTree()
  }

  throw new Error('Invalid SGF: expected "(" at start')
}
