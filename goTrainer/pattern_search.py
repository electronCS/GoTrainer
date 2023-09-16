import copy
import os

from sgfmill import sgf, boards
from katago_sample import KataGo
import numpy as np


def print_board(board):
    board_ascii = {-1: '', 0:'.', 1: 'O', 2: 'X', 3: '.'}
    for i in range(len(board)):
        for j in range(len(board[0])):
            print(board_ascii[board[i][j]], end=' ')
        print()
    print()


def generate_orientations(pattern):
    pattern = np.array(pattern)
    orientations = []

    # Four rotations
    for _ in range(4):
        orientations.append(pattern.tolist())
        pattern = np.rot90(pattern)

    # Flip and four rotations
    pattern = np.fliplr(pattern)
    for _ in range(4):
        orientations.append(pattern.tolist())
        pattern = np.rot90(pattern)

    return orientations


def reverse_pattern_colors(pattern):
    new_pattern = copy.deepcopy(pattern)
    for i in range(len(pattern)):
        for j in range(len(pattern[0])):
            if pattern[i][j] == 1 or pattern[i][j] == 2:
                new_pattern[i][j] = pattern[i][j] % 2 + 1
    return new_pattern


def generate_board_with_borders(size):
    board = [[0] * (size + 2) for i in range(size + 2)]
    for i in range(size + 2):
        board[0][i] = -1
        board[size + 1][i] = -1
        board[i][0] = -1
        board[i][size + 1] = -1
    return board


def pattern_search(pattern_template, pattern_turn, filepath):
    f = open(filepath, 'rb')
    game = sgf.Sgf_game.from_bytes(f.read())

    all_patterns_b = generate_orientations(pattern_template)
    all_patterns_w = generate_orientations(reverse_pattern_colors(pattern_template))
    all_patterns = [all_patterns_b, all_patterns_w]
    board = generate_board_with_borders(19)
    color = 1
    move_num = 0

    # katago = KataGo("katago.exe", "katago-gtp80.cfg", "6-23_18block.bin.gz")
    # board2 = boards.Board(19)
    # moves = []

    for node in game.get_main_sequence():
        move = node.get_move()

        if move[0] is None:
            continue

        # board2.play(move[1][0], move[1][1], move[0])
        # katago.query(board2, [], 6.5)
        # moves.append(move)

        coor = (move[1][0] + 1, move[1][1] + 1)

        move_num += 1

        if move[0] == 'b':
            color = 1
            board[coor[0]][coor[1]] = 1
        elif move[0] == 'w':
            color = 2
            board[coor[0]][coor[1]] = 2
        for pattern in all_patterns[color == pattern_turn]:
            for i in range(len(pattern)):
                for j in range(len(pattern[0])):
                    if pattern[i][j] == color:
                        temp_board = [row[coor[1] - j: coor[1] - j + len(pattern[0])] for row in
                                      board[coor[0] - i: coor[0] - i + len(pattern)]]
                        if temp_board == pattern:
                            print(f"found pattern on move {move_num} in {filepath}")
                            print_board(temp_board)

    f.close()


if __name__ == '__main__':
    # pattern_template = [[1,2,2],[2,1,1],[0,2,0]]
    # who played the last move
    # pattern_turn = 1;

    # -1 - border
    # 0 - empty
    # 1 - black
    # 2 - white (colors for 1 and two are swapped also during search)
    # 3 - anything
    # 4 - candidate move?
    pattern_template = [[0,0,0,1,0,0,-1],
                        [0,0,0,0,0,0,-1],
                        [0,1,1,0,0,0,-1],
                        [2,1,2,1,0,0,-1],
                        [0,2,2,2,0,0,-1],
                        [0,0,0,0,0,0,-1],
                        [-1,-1,-1,-1,-1,-1,-1]]
    pattern_turn = 1

    count = 0
    for filename in os.listdir('go4go_collection'):
        if (filename < "__go4go_2019"):
            continue
        full_file_path = os.path.join('go4go_collection', filename)
        print(f"trying {filename}")
        pattern_search(pattern_template, pattern_turn, full_file_path)
        count += 1
        if count == 30:
            break

    # pattern_search(pattern_template, pattern_turn, 'test.sgf')

    # katago = KataGo("katago.exe", "katago-gtp80.cfg", "6-23_18block.bin.gz")
    # board = sgfmill.boards.Board(19)



