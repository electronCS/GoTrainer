import { useState, useRef, useCallback } from 'react'
import { GameTree } from '../lib/GameTree.js'

/**
 * useGameTree — React hook wrapping GameTree.
 *
 * Returns an object with:
 *   stones        — current stones array for GoBoard
 *   currentTurn   — 'B' | 'W'
 *   moveNumber    — current move number
 *   lastMove      — { x, y, color } | null
 *   rootNode      — the root GameNode (for VariationTree)
 *   currentNode   — the current GameNode (for VariationTree)
 *   version       — increments on every mutation (for memoization)
 *   playMove(x, y) — play a stone
 *   undo()        — go back one move
 *   redo()        — go forward one move
 *   goToStart()   — jump to root
 *   goToEnd()     — jump to end of main line
 *   goBackN(n)    — go back N moves
 *   goForwardN(n) — go forward N moves
 *   goToNode(node) — navigate to a specific GameNode
 *   reset()       — start a new game
 */
export function useGameTree(size = 19) {
  const treeRef = useRef(new GameTree(size))

  // Version counter to force re-renders when the tree mutates.
  const [version, setVersion] = useState(0)
  const bump = () => setVersion((v) => v + 1)

  const reset = useCallback(
    (newSize) => {
      treeRef.current = new GameTree(newSize ?? size)
      bump()
    },
    [size]
  )

  const playMove = useCallback((x, y) => {
    const ok = treeRef.current.playMove(x, y)
    if (ok) bump()
    return ok
  }, [])

  const undo = useCallback(() => {
    if (treeRef.current.undo()) bump()
  }, [])

  const redo = useCallback(() => {
    if (treeRef.current.redo()) bump()
  }, [])

  const goToStart = useCallback(() => {
    treeRef.current.goToStart()
    bump()
  }, [])

  const goToEnd = useCallback(() => {
    treeRef.current.goToEnd()
    bump()
  }, [])

  const goBackN = useCallback((n) => {
    treeRef.current.goBackN(n)
    bump()
  }, [])

  const goForwardN = useCallback((n) => {
    treeRef.current.goForwardN(n)
    bump()
  }, [])

  const goToNode = useCallback((node) => {
    treeRef.current.goToNode(node)
    bump()
  }, [])

  const loadSgf = useCallback((sgfString) => {
    treeRef.current.loadSgf(sgfString)
    bump()
  }, [])

  const saveSnapshot = useCallback(() => {
    return treeRef.current.saveSnapshot()
  }, [])

  const restoreSnapshot = useCallback((snapshot) => {
    treeRef.current.restoreSnapshot(snapshot)
    bump()
  }, [])

  const injectVariations = useCallback((problemSgf) => {
    const count = treeRef.current.injectVariations(problemSgf)
    if (count > 0) bump()
    return count
  }, [])

  const tree = treeRef.current

  return {
    stones: tree.getStones(),
    currentTurn: tree.currentTurn,
    moveNumber: tree.currentNode.moveNumber,
    lastMove: tree.getLastMove(),
    rootNode: tree.root,
    currentNode: tree.currentNode,
    version,
    playMove,
    undo,
    redo,
    goToStart,
    goToEnd,
    goBackN,
    goForwardN,
    goToNode,
    loadSgf,
    saveSnapshot,
    injectVariations,
    restoreSnapshot,
    reset,
  }
}
