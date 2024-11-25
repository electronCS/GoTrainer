import { Node } from './game-node.js';
import Board from '@sabaki/go-board';  // Correctly import the Board class from @sabaki/go-board
import { parseCoordinates } from './utils.js';
import './variation-tree.js'; // Import the new component
import './board'
// import VariationTree from './components/VariationTree.vue';
import '../css/board.css';
import '../css/board-controller.css';
import '../css/variation-tree.css';
import '../css/variation-tree-node.css';
// import SGF from "@babel/core/lib/parse";

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
                            :scale="scale"
                            :ghostMode="ghostMode"
                            @board-clicked="handleBoardClick">
                        </go-board>
                      
                    </div>
                  <div class="controls">
                            <button class="button-custom" @click="goToStart"><i class="fas fa-fast-backward"></i></button>
                            <button class="button-custom" @click="goBack10Moves"><i class="fas fa-step-backward"></i></button>
                            <button class="button-custom" @click="previousMove"><i class="fas fa-chevron-left"></i></button>
                            <button class="button-custom" @click="nextMove"><i class="fas fa-chevron-right"></i></button>
                            <button class="button-custom" @click="goForward10Moves"><i class="fas fa-step-forward"></i></button>
                            <button class="button-custom" @click="goToEnd"><i class="fas fa-fast-forward"></i></button>
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
            boardBaseSize: 624, // Base size of the board at scale 1 (e.g., 19x19 with default cellSize)
            ghostMode: 'B', // Default to Black stones

        };
    },
    mounted() {
        if (window.sgfString) {
            this.loadSgf(window.sgfString);
            console.log("sgf data is " + this.sgfData);
        }
        // this.calculateScale(); // Calculate initial scale
        // window.addEventListener('resize', this.calculateScale); // Update scale on window resize

    },
    beforeDestroy() {
        window.removeEventListener('resize', this.calculateScale);
    },
    methods: {
        handleBoardClick({ x, y }) {
            console.log(`Clicked on (${x}, ${y})`);

            // Convert board coordinates to SGF coordinates (e.g., A1 = 'aa')
            const sgfX = String.fromCharCode(97 + x); // 'a' + x
            const sgfY = String.fromCharCode(97 + y); // 'a' + y
            const sgfCoord = `${sgfX}${sgfY}`;
            console.log(`SGF coordinate: ${sgfCoord}`);

            // Check if a child node exists with this move
            const existingChild = this.currentNode.children.find(
                child => child.props.B === sgfCoord || child.props.W === sgfCoord
            );

            if (existingChild) {
                // Navigate to the existing node
                // this.currentNode = existingChild;
                this.navigateToNode(existingChild)

                console.log(`Navigated to existing node at ${sgfCoord}`);
            } else {
                // Determine the color of the next move
                const color = this.determineNextColor();

                // Create a new Node instance
                const newNode = new Node(
                    { [color]: sgfCoord }, // Props for the new node (e.g., { B: 'aa' })
                    this.currentNode, // Set parent to currentNode
                    this.currentNode.isMoveNode ? this.currentNode.moveNumber + 1 : 1 // Increment move number
                );

                // Add the new node to the current node
                this.currentNode.addChild(newNode);

                // Update the current node
                this.navigateToNode(newNode)
                // this.currentNode = newNode;

                console.log(`Added new node: ${JSON.stringify(newNode.props)}`);
            }

            // Update board state and reflect changes on the board
            this.updateBoardState();
        },

        determineNextColor() {
            // Determine the color of the next move based on the current node
            const parentProps = this.currentNode.props;
            if (parentProps.W || (!parentProps.W && !parentProps.B)) {
                this.ghostMode = 'B';
                return 'B'; // If the parent is a Black move or root, the next is White
            }
            this.ghostMode = 'W';
            return 'W'; // Otherwise, the next move is Black
        },


        calculateScale() {
            // Get the size of the parent column
            const firstColumn = this.$el.querySelector('.first-column');
            if (firstColumn) {
                const availableWidth = firstColumn.clientWidth;
                const availableHeight = firstColumn.clientHeight;

                console.log("available width is " + availableWidth + " and available height is " + availableHeight);

                // Calculate scale based on the smaller of width or height
                const scaleWidth = (availableWidth * 0.98)/ this.boardBaseSize;
                const scaleHeight = availableHeight / this.boardBaseSize;
                this.scale = Math.min(scaleWidth, scaleHeight); // Maintain aspect ratio
                console.log("Updated scale:", this.scale);
            }
        },

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
            // console.log ()
            console.log("sgf data props is " + JSON.stringify(sgfData.props, null, 2));

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
                this.currentNode = this.currentNode.getNextChild(); // Move to the next node in the main line
                count++;
            }
            console.log(`Moved forward ${count} moves.`);
            this.updateBoardState();
        },
        goToEnd() {
            while (this.currentNode && this.currentNode.children.length > 0) {
                this.currentNode = this.currentNode.getNextChild(); // Move to the next node in the main line
            }
            console.log("Moved to end of the game.");
            this.updateBoardState();
        },

        updateBoardState() {
            this.ghostMode = this.determineNextColor();

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
