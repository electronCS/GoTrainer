import { Node } from './game-node.js';
import Board from '@sabaki/go-board';  // Correctly import the Board class from @sabaki/go-board
import { parseCoordinates } from './utils.js';
import './variation-tree.js'; // Import the new component
// import VariationTree from './components/VariationTree.vue';

Vue.component('go-board-controller', {
    template: `
        <div class="board-controller">
            <div class="columns">
                <!-- First Column: Board and Controls -->
                <div class="first-column">
                    <div class="board-container-wrapper">
                        <go-board
                            :initial-board-state="currentBoardState"
                            :current-node="currentNode"
                            :translate-x="translateX"
                            :translate-y="translateY"
                            :scale="scale">
                        </go-board>
                        <div class="controls">
                            <button class="button-custom" @click="goToStart"><i class="fas fa-fast-backward"></i></button>
                            <button class="button-custom" @click="goBack10Moves"><i class="fas fa-step-backward"></i></button>
                            <button class="button-custom" @click="previousMove"><i class="fas fa-chevron-left"></i></button>
                            <button class="button-custom" @click="nextMove"><i class="fas fa-chevron-right"></i></button>
                            <button class="button-custom" @click="goForward10Moves"><i class="fas fa-step-forward"></i></button>
                            <button class="button-custom" @click="goToEnd"><i class="fas fa-fast-forward"></i></button>
                        </div>
                    </div>
                </div>
        
                <!-- Second Column: Variation Tree -->
                <div class="second-column">
                    <div class="variation-tree-container">
                        <variation-tree
                            :root-node="rootNode"
                            :current-node="currentNode"
                            @select-node="navigateToNode">
                        </variation-tree>
                    </div>
                </div>
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

        convertSgfToNode(sgfData, parent = null, moveNumber = 0) {
            const node = new Node(sgfData.props, parent, moveNumber);
            // console.log("sgf data props is " + sgfData.props)

            if (sgfData.props.LB) {
                // console.log("props has LB")
                // Ensure LB is an array before mapping
                const labels = Array.isArray(sgfData.props.LB) ? sgfData.props.LB : [sgfData.props.LB];
                // Extract label annotations
                node.labels = labels.map(label => {
                    const [coord, text] = label.split(':');
                    const [col, row] = parseCoordinates(coord);
                    return { col, row, text };
                });

                // console.log("node labels is " + JSON.stringify(node.labels, null, 2))
            }

            if (sgfData.childs) {
                sgfData.childs.forEach(childData => {
                    const isChildMoveNode = !!(childData.props.B || childData.props.W);
                    // Increment moveNumber only for child move nodes
                    const childMoveNumber = isChildMoveNode ? moveNumber + 1 : moveNumber;

                    // Convert the child and add it to the current node
                    const childNode = this.convertSgfToNode(childData, node, childMoveNumber);
                    node.addChild(childNode);
                });
            }
            // console.log("returned node is " + node.print())

            return node;
        },

        navigateToNode(node) {
            this.currentNode = node;
            this.updateBoardState();
        },

        nextMove() {
            if (this.currentNode && this.currentNode.children.length > 0) {
                // this.currentNode = this.currentNode.children[0]; // Move to the next node in the main line
                this.currentNode = this.currentNode.getNextChild();
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
        goToStart() {
            if (this.rootNode) {
                this.currentNode = this.rootNode; // Set current node to the root
                console.log("Moved to start of the game.");
                this.updateBoardState();
            }
        },
        goBack10Moves() {
            let count = 0;
            while (this.currentNode && this.currentNode.parent && count < 10) {
                this.currentNode = this.currentNode.parent; // Move to the previous node (parent)
                count++;
            }
            console.log(`Moved back ${count} moves.`);
            this.updateBoardState();
        },
        goForward10Moves() {
            let count = 0;
            while (this.currentNode && this.currentNode.children.length > 0 && count < 10) {
                this.currentNode = this.currentNode.children[0]; // Move to the next node in the main line
                count++;
            }
            console.log(`Moved forward ${count} moves.`);
            this.updateBoardState();
        },
        goToEnd() {
            while (this.currentNode && this.currentNode.children.length > 0) {
                this.currentNode = this.currentNode.children[0]; // Move to the next node in the main line
            }
            console.log("Moved to end of the game.");
            this.updateBoardState();
        },

        updateBoardState() {
            // Reset the board
            this.board = Board.fromDimensions(19);
            this.labels = []; // Keep track of annotations separately

            // Get all moves up to and including the current node
            const moves = this.getMovesToCurrentNode();

            // Apply each move to the board
            moves.forEach(move => {
                if (move.B) {
                    const [col, row] = parseCoordinates(move.B);
                    this.board = this.board.makeMove(1, [col, row]); // Black stone (1)
                }
                if (move.W) {
                    const [col, row] = parseCoordinates(move.W);
                    this.board = this.board.makeMove(-1, [col, row]); // White stone (-1)
                }
            });

            // Update the current board state with the board representation
            this.currentBoardState = this.board.signMap;
        },

        getMovesToCurrentNode() {
            const moves = [];
            let node = this.currentNode;
            console.log("traversing to current node which is " + this.currentNode.print());

            // Traverse up the tree from currentNode to rootNode
            while (node) {
                if (node.props) {
                    moves.push(node.props);  // Add each node's move to the moves array
                }
                if (node.parent) {
                    const index = node.parent.children.indexOf(node);
                    if (index !== -1) {
                        node.parent.setNextChild(index); // Update currentChildIndex
                    }
                }

                if (node === this.rootNode) {
                    break;  // Stop when we reach the root node
                }
                node = node.parent;  // Move up to the parent node
            }

            // Reverse the moves to have them in order from root to current node
            return moves.reverse();
        },

        convertMovesToBoardState(moves) {
            // Initialize an empty board state (19x19, for example)
            const boardSize = 19;
            const boardState = Array.from({ length: boardSize }, () => Array(boardSize).fill(null));

            // Apply each move to the board state
            moves.forEach(move => {
                if (move.B) {
                    const [col, row] = parseCoordinates(move.B);
                    boardState[row][col] = 'B'; // Black stone
                }
                if (move.W) {
                    const [col, row] = parseCoordinates(move.W);
                    boardState[row][col] = 'W'; // White stone
                }
            });

            return boardState;
        },

    }
});
