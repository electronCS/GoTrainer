import copy
from datetime import datetime
import os
from opensearchpy import OpenSearch, RequestsHttpConnection
from requests_aws4auth import AWS4Auth
import boto3

from sgfmill import sgf, boards, ascii_boards
from katago_sample import KataGo
import numpy as np

problem_id_num = 0


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

def generate_orientations_with_answer(pattern, marker=3):
    pattern = np.array(pattern)
    orientations = []

    for _ in range(4):  # Four rotations
        x, y = np.where(pattern == marker)  # Locate the correct answer marker
        if x.size > 0 and y.size > 0:  # Ensure marker exists in this orientation
            orientations.append((pattern.tolist(), (x[0], y[0])))  # Store pattern and marker position
        pattern = np.rot90(pattern)

    # Flip and repeat rotations
    pattern = np.fliplr(pattern)
    for _ in range(4):
        x, y = np.where(pattern == marker)
        if x.size > 0 and y.size > 0:
            orientations.append((pattern.tolist(), (x[0], y[0])))
        pattern = np.rot90(pattern)

    return orientations


def findbest(moveInfo, color):
    best_score = -999
    best_move = None
    print("color is", color)
    for move in moveInfo:
        if move['scoreLead'] > best_score:
            best_score = move['scoreLead']
            best_move = move

    print(f"best move for {color} is {best_move['move']} with score lead {best_score}")
    print(best_move)


def pattern_search(pattern_template, pattern_turn, filepath, katago):
    global problem_id_num
    f = open(filepath, 'rb')
    game = sgf.Sgf_game.from_bytes(f.read())

    # all_patterns_b = generate_orientations(pattern_template)
    # all_patterns_w = generate_orientations(reverse_pattern_colors(pattern_template))

    all_patterns_b = generate_orientations_with_answer(pattern_template)
    all_patterns_w = generate_orientations_with_answer(reverse_pattern_colors(pattern_template))
    all_patterns = [all_patterns_b, all_patterns_w]
    board = generate_board_with_borders(19)
    move_num = 0

    board2 = boards.Board(19)
    moves = []

    relative_x = 0
    relative_y = 2
    for node in game.get_main_sequence():
        move = node.get_move()

        if move[0] is None:
            continue

        moves.append(move)
        coor = (move[1][0] + 1, move[1][1] + 1)
        move_num += 1

        if move[0] == 'b':
            color_code = 1
            board[coor[0]][coor[1]] = 1
        elif move[0] == 'w':
            color_code = 2
            board[coor[0]][coor[1]] = 2

        for pattern, (rel_x, rel_y) in all_patterns[color_code == pattern_turn]:
            for i in range(len(pattern)):
                for j in range(len(pattern[0])):
                    if pattern[i][j] == color_code:
                        temp_board = [row[coor[1] - j: coor[1] - j + len(pattern[0])] for row in
                                      board[coor[0] - i: coor[0] - i + len(pattern)]]
                        if (coor[0] - i >= 0 and coor[0] - i + len(pattern) <= len(board) and
                                coor[1] - j >= 0 and coor[1] - j + len(pattern[0]) <= len(board[0])):
                            temp_board = [row[coor[1] - j: coor[1] - j + len(pattern[0])] for row in
                                          board[coor[0] - i: coor[0] - i + len(pattern)]]

                            if matches_pattern(temp_board, pattern):


                                print(f"found pattern on move {move_num} in {filepath}")
                                node.add_comment_text("found pattern")

                                final_x = coor[0] - i + rel_x
                                final_y = coor[1] - j + rel_y

                                # Flip y-coordinate to match SGF's top-left origin
                                flipped_y = 19 - final_y
                                flipped_x = 19 - final_x
                                print(final_x, final_y, flipped_x, flipped_y)

                                # Convert to SGF coordinates
                                sgf_coord = chr(final_y + 96) + chr(flipped_x + 97)  # Convert to SGF (e.g., 'aa', 'pp')
                                correct_answer = (flipped_x - 1, final_y - 1)  # Remove border offset for debugging
                                print("correct coord is ", sgf_coord)
                                position = "/".join(["0"] * (move_num))  # Each move adds a new node
                                problem_id = f"test_joseki{problem_id_num}"
                                problem_id_num += 1
                                file_path = filepath
                                correct_answers = [sgf_coord]

                                add_to_dynamodb(problem_id, correct_answers, f"goTrainer/{file_path}", position)
                                add_to_opensearch(problem_id, file_path, ["testJoseki"])

                                displayboard = boards.Board(19)
                                for color, move in moves:
                                    if move != "pass":
                                        row, col = move
                                        displayboard.play(row, col, color)
                                print(ascii_boards.render_board(displayboard))

                                if katago:
                                    print("moves is ", moves)
                                    result = katago.query(board2, moves, 7.5)
                                    print("length is ", len(result["moveInfos"]))
                                    findbest(result["moveInfos"], moves[-2][0])



    f.close()

def matches_pattern(board_slice, pattern):
    for i in range(len(pattern)):
        for j in range(len(pattern[0])):
            if pattern[i][j] == 3:  # Wildcard matches anything except border
                if board_slice[i][j] == -1:  # Wildcard should not match border
                    return False
            elif pattern[i][j] != board_slice[i][j]:
                return False
    return True

def add_to_dynamodb(problem_id, correct_answers, file_path, position):
    # Initialize DynamoDB resource
    dynamodb = boto3.resource('dynamodb')
    table = dynamodb.Table('problems2')

    # Construct the item
    item = {
        "problemId": problem_id,
        "correctAnswers": correct_answers,
        "filePath": file_path,
        "position": position
    }

    # Insert the item into DynamoDB
    try:
        table.put_item(Item=item)
        print(f"Successfully added problem {problem_id} to DynamoDB")
    except Exception as e:
        print(f"Error adding problem {problem_id} to DynamoDB: {e}")

def add_to_opensearch(problem_id, file_path, tags, difficulty=1, patterns=None):
    # Initialize OpenSearch client
    session = boto3.Session()
    credentials = session.get_credentials().get_frozen_credentials()
    region = 'us-east-1'

    awsauth = AWS4Auth(credentials.access_key, credentials.secret_key, region, 'es',
                       session_token=credentials.token)

    client = OpenSearch(
        hosts=[{'host': 'search-domain-test-l7githvhafgmj5ckm7tt3l3wnu.us-east-1.es.amazonaws.com', 'port': 443}],
        http_auth=awsauth,
        use_ssl=True,
        verify_certs=True,
        connection_class=RequestsHttpConnection
    )

    # Construct the document
    document = {
        "doc": {
            "id": problem_id,
            "creation_date": datetime.utcnow().isoformat() + "Z",  # Current UTC timestamp
            "date_of_sgf": datetime.utcnow().isoformat() + "Z",   # Same as creation_date for now
            "difficulty": difficulty,
            "patterns": patterns if patterns else [],             # Default to empty list if not provided
            "tags": tags
        }
    }

    # Insert the document into OpenSearch
    try:
        client.index(index="problems", id=problem_id, body=document)
        print(f"Successfully added problem {problem_id} to OpenSearch")
    except Exception as e:
        print(f"Error adding problem {problem_id} to OpenSearch: {e}")


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
    use_kata = False
    pattern_template = [[0,0,0,1,0,0,-1],
                        [0,0,0,0,0,0,-1],
                        [3,1,1,0,0,0,-1],
                        [2,1,2,1,0,0,-1],
                        [0,2,2,2,0,0,-1],
                        [0,0,0,0,0,0,-1],
                        [-1,-1,-1,-1,-1,-1,-1]]

    pattern_turn = 1

    if use_kata:
        katago = KataGo("katago.exe", "katago-gtp80.cfg", "6-23_18block.bin.gz")
    else:
        katago = None

    count = 0
    for filename in os.listdir('go4go_collection'):
        if (filename < "__go4go_2019"):
            continue
        full_file_path = os.path.join('go4go_collection', filename)
        print(f"trying {filename}")
        pattern_search(pattern_template, pattern_turn, full_file_path, katago)
        count += 1
        if count == 200:
            print("done")
            break

    if use_kata:
        katago.close()
    # pattern_search(pattern_template, pattern_turn, 'test.sgf')

    # katago = KataGo("katago.exe", "katago-gtp80.cfg", "6-23_18block.bin.gz")



