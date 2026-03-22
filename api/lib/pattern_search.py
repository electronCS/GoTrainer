"""
Pattern search engine — searches SGF files for board patterns.

Pattern encoding:
  -1 = border (off-board)
   0 = empty intersection
   1 = black stone
   2 = white stone
   3 = wildcard (matches anything except border)

The search generates all 8 orientations (4 rotations × flip) and also
checks the color-swapped version, so a single pattern covers all symmetries.
"""

import copy
import logging
import os
from pathlib import Path
from typing import Generator

import numpy as np
from sgfmill import sgf

logger = logging.getLogger(__name__)

# Project root is one level up from api/
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DEFAULT_SGF_DIR = str(PROJECT_ROOT / "goTrainer" / "go4go_collection")


def generate_orientations(pattern: list[list[int]]) -> list[list[list[int]]]:
    """Generate all 8 orientations (4 rotations + mirror × 4 rotations)."""
    arr = np.array(pattern)
    orientations = []
    for _ in range(4):
        orientations.append(arr.tolist())
        arr = np.rot90(arr)
    arr = np.fliplr(arr)
    for _ in range(4):
        orientations.append(arr.tolist())
        arr = np.rot90(arr)
    return orientations


def reverse_colors(pattern: list[list[int]]) -> list[list[int]]:
    """Swap black (1) and white (2) in a pattern."""
    new = copy.deepcopy(pattern)
    for i in range(len(pattern)):
        for j in range(len(pattern[0])):
            if pattern[i][j] in (1, 2):
                new[i][j] = pattern[i][j] % 2 + 1
    return new


def make_bordered_board(size: int = 19) -> list[list[int]]:
    """Create a (size+2) × (size+2) board with -1 border."""
    board = [[0] * (size + 2) for _ in range(size + 2)]
    for i in range(size + 2):
        board[0][i] = -1
        board[size + 1][i] = -1
        board[i][0] = -1
        board[i][size + 1] = -1
    return board


def matches_pattern(board_slice: list[list[int]], pattern: list[list[int]]) -> bool:
    """Check if a board slice matches a pattern."""
    for i in range(len(pattern)):
        for j in range(len(pattern[0])):
            if pattern[i][j] == 3:  # wildcard — matches anything except border
                if board_slice[i][j] == -1:
                    return False
            elif pattern[i][j] != board_slice[i][j]:
                return False
    return True


def search_file(
    pattern_template: list[list[int]],
    pattern_turn: int,
    filepath: str,
) -> Generator[dict, None, None]:
    """
    Search a single SGF file for the pattern.

    pattern_turn: 1 = black to play next, 2 = white to play next

    Yields dicts: { sgf_file, move_number }
    """
    with open(filepath, "rb") as f:
        game = sgf.Sgf_game.from_bytes(f.read())

    # Pre-compute all orientations for both color schemes
    patterns_original = generate_orientations(pattern_template)
    patterns_swapped = generate_orientations(reverse_colors(pattern_template))
    all_patterns = [patterns_original, patterns_swapped]

    board = make_bordered_board(19)
    move_num = 0

    for node in game.get_main_sequence():
        move = node.get_move()
        if move[0] is None:
            continue

        color_str, coords = move
        row, col = coords[0] + 1, coords[1] + 1  # +1 for border offset
        move_num += 1

        color_code = 1 if color_str == "b" else 2
        board[row][col] = color_code

        # Select which pattern set to check based on whose turn it is
        if pattern_turn == 2:  # white to play next
            patterns_to_check = all_patterns[color_code - 1]
        else:  # black to play next
            patterns_to_check = all_patterns[2 - color_code]

        for pattern in patterns_to_check:
            ph, pw = len(pattern), len(pattern[0])
            matched = False
            for i in range(ph):
                if matched:
                    break
                for j in range(pw):
                    if pattern[i][j] == color_code:
                        # Check if pattern fits at this alignment
                        r0, c0 = row - i, col - j
                        if (r0 >= 0 and r0 + ph <= len(board) and
                                c0 >= 0 and c0 + pw <= len(board[0])):
                            board_slice = [
                                r[c0:c0 + pw] for r in board[r0:r0 + ph]
                            ]
                            if matches_pattern(board_slice, pattern):
                                matched = True
                                yield {
                                    "sgf_file": filepath,
                                    "move_number": move_num,
                                }


def search_directory(
    pattern_template: list[list[int]],
    pattern_turn: int,
    directory: str = None,
    max_files: int = 100,
    start_after: str | None = None,
    on_progress=None,
) -> Generator[dict, None, None]:
    """
    Search SGF files in a directory for a pattern.

    Yields hit dicts and calls on_progress(scanned, total, current_file) periodically.
    """
    if directory is None:
        directory = DEFAULT_SGF_DIR

    print(f"[PatternSearch] Searching directory: {directory}")
    print(f"[PatternSearch] Directory exists: {os.path.isdir(directory)}")

    all_files = sorted(
        [f for f in os.listdir(directory) if f.endswith(".sgf")],
        reverse=True,
    )
    print(f"[PatternSearch] Found {len(all_files)} SGF files")
    total = min(len(all_files), max_files)

    # Pagination: skip files until we pass start_after
    skip = start_after is not None
    scanned = 0

    for fname in all_files:
        if skip:
            full_check = os.path.join(directory, fname)
            if full_check == start_after or fname == os.path.basename(start_after or ""):
                skip = False
            continue

        if scanned >= max_files:
            break

        full_path = os.path.join(directory, fname)
        if not os.path.isfile(full_path):
            continue

        scanned += 1
        if on_progress:
            on_progress(scanned, total, full_path)

        try:
            yield from search_file(pattern_template, pattern_turn, full_path)
        except Exception as e:
            logger.warning("Error searching %s: %s", full_path, e)
