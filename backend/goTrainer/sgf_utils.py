from sgfmill import sgf
from sgfmill import boards

def get_sgf_string(file_path):
    with open(file_path, "rb") as f:
        sgf_content = f.read()
    return sgf_content.decode('utf-8')

def read_sgf_file(file_path):
    with open(file_path, "rb") as f:
        sgf_content = f.read()

    sgf_game = sgf.Sgf_game.from_bytes(sgf_content)
    root_node = sgf_game.get_root()
    board_size = root_node.get_size()

    board = boards.Board(board_size)  # Initialize the board

    for node in sgf_game.get_main_sequence():
        color, move = node.get_move()
        if move is not None:
            row, col = move
            board.play(row, col, color)  # Play the move on the board

    # Extract the final board state after all moves
    final_board_state = []
    for row in range(board_size):
        row_state = []
        for col in range(board_size):
            stone = board.get(row, col)
            row_state.append(stone)
        final_board_state.append(row_state)

    print(f"Board Size: {board_size}")
    print("Final Board State:")
    for row in final_board_state:
        print(row)

    return {
        "board_size": board_size,
        "final_board_state": final_board_state
    }
