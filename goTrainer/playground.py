from sgfmill import sgf, boards, ascii_boards


if __name__ == "__main__":

    path = [1,0,0]
    with open("../example.sgf", 'rb') as f:
        game = sgf.Sgf_game.from_bytes(f.read())
        node = game.root
        board = boards.Board(19)
        for index in path:
            print(index)
            node = node[index]
            move = node.get_move()
            if move is not None:
                color, (row, col) = move
                board.play(row, col, color)

            print(node.get_move())
        print("rendering board")
        print(ascii_boards.render_board(board))
        print("rendered board")

    #     for n in game.get_main_sequence():
    #         print(n);
    #         if n.get_move() is not None:
    #             n.add_comment_text("testing comment")
    #             break
    #
    # updated_game = game.serialise()
    # with open("../example.sgf", 'wb') as f:
    #     f.write(updated_game)


