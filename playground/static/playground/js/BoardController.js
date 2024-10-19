import { Node } from './GameNode.js';
import Board from '@sabaki/go-board';  // Correctly import the Board class from @sabaki/go-board

Vue.component('go-board-controller', {
    template: `
        <div class="board-controller">
            <!-- Controls -->
            <div class="controls">
                <button @click="previousMove">Previous Move</button>
                <button @click="nextMove">Next Move</button>
<!--                <button @click="resetBoard">Reset</button>-->
            </div>

            <!-- Go Board Component -->
            <go-board
                :initial-board-state="currentBoardState"
                :translate-x="translateX"
                :translate-y="translateY"
                :scale="scale">
            </go-board>

            <!-- Variation Tree (Optional) -->
            <div class="variation-tree">
                <!-- Render variations here -->
            </div>
        </div>
    `,
    data() {
        return {
            sgfData: null,
            board: Board.fromDimensions(19),

            currentBoardState: [], // Array to represent the current board state
            currentNode: null,     // Reference to the current node in the SGF tree
            rootNode: null,        // Reference to the root node of the SGF tree

            translateX: 0,
            translateY: 0,
            scale: 1,
        };
    },
    mounted() {
        if (window.sgfString) {
            this.loadSgf(window.sgfString);
        }
    },
    methods: {
        loadSgf(sgfString) {
            console.log("about to parse sgf which is " + sgfString);

            this.sgfData = SGF.parse(sgfString);
            console.log("sgf data is " + JSON.stringify(this.sgfData));
            // Convert parsed SGF data to a tree of Node instances
            this.rootNode = this.convertSgfToNode(this.sgfData);
            this.currentNode = this.rootNode;
            // console.log("the current node is " + JSON.stringify(this.currentNode, null, 2));

            this.updateBoardState();
        },

        convertSgfToNode(sgfData, parent = null) {
            const node = new Node(sgfData.props, parent);

            if (sgfData.childs) {
                sgfData.childs.forEach(childData => {
                    const childNode = this.convertSgfToNode(childData, node);
                    node.addChild(childNode);
                });
            }

            return node;
        },

        nextMove() {
            if (this.currentNode && this.currentNode.children.length > 0) {
                this.currentNode = this.currentNode.children[0]; // Move to the next node in the main line
                console.log("Moved to next node:", this.currentNode.print());
                this.updateBoardState();
                // this.scale += 0.1;
            }
        },
        previousMove() {
            if (this.currentNode && this.currentNode.parent) {
                this.currentNode = this.currentNode.parent; // Move to the previous node (parent)
                console.log("Moved to previous node:", this.currentNode.print());
                this.updateBoardState();
            }
        },
        updateBoardState() {
            // Reset the board
            this.board = Board.fromDimensions(19),
            console.log("new change picked up??");
            // Traverse from the root to the current node and apply each move
            let node = this.rootNode;
            while (node && node !== this.currentNode) {
                if (node.props) {
                    if (node.props.B) {
                        const [col, row] = this.parseCoordinates(node.props.B);
                        this.board = this.board.makeMove(1, [col, row]); // Black stone (1)
                    }
                    if (node.props.W) {
                        const [col, row] = this.parseCoordinates(node.props.W);
                        this.board = this.board.makeMove(-1, [col, row]); // White stone (-1)
                    }
                }
                node = node.children[0]; // Move to the next node in the main line
            }

            // Update the current board state with the board representation
            this.currentBoardState = this.board.signMap;
        },
        getMovesToCurrentNode() {
            // Logic to traverse SGF and gather moves up to the current node
            const moves = [];
            let node = this.currentNode;

            // Traverse backwards to collect all moves from root to the current node
            while (node && node !== this.rootNode) {
                if (node.props) {
                    moves.unshift(node.props);
                }
                node = node.parent; // Move up the tree
            }
            return moves;
        },
        convertMovesToBoardState(moves) {
            // Initialize an empty board state (19x19, for example)
            const boardSize = 19;
            const boardState = Array.from({ length: boardSize }, () => Array(boardSize).fill(null));

            // Apply each move to the board state
            moves.forEach(move => {
                if (move.B) {
                    const [col, row] = this.parseCoordinates(move.B);
                    boardState[row][col] = 'B'; // Black stone
                }
                if (move.W) {
                    const [col, row] = this.parseCoordinates(move.W);
                    boardState[row][col] = 'W'; // White stone
                }
            });
            // console.log("Updated board state:", boardState);

            return boardState;
        },
        parseCoordinates(coord) {
            // Parse SGF coordinates (e.g., "aa" to [0, 0])
            const col = coord.charCodeAt(0) - 'a'.charCodeAt(0);
            const row = coord.charCodeAt(1) - 'a'.charCodeAt(0);
            return [col, row];
        }

    }
});
