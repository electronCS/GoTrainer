<template>
      <div class="board-controller">
          <div class="columns">
              <!-- First Column: Board and Controls -->
              <div class="first-column">
                  <div class="board-container-wrapper">
                      <GoBoard
                          :initial-board-state="currentBoardState"
                          :current-node="currentNode"
                          :translate-x="translateX"
                          :translate-y="translateY"
                          :scale="scale"
                          :ghostMode="boardMode"
                          @board-clicked="handleBoardClick">
                      </GoBoard>

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
                <div class="control-panel-container">

                    <ControlPanel
                      :currentMode="mode"
                      @mode-selected="updateMode"
                      @action-selected="handleAction"/>
                </div>

                <div class="comment-box-container">
                  <CommentBox
                    :node="currentNode"
                    @update-comment="updateNodeComment"
                  />
                </div>

                  <div class="variation-tree-container">
                      <VariationTree
                          :root-node="rootNode"
                          :current-node="currentNode"
                          @select-node="navigateToNode">
                      </VariationTree>
                  </div>
              </div>
          </div>
      </div>
</template>

<script>
import { Node } from '../js/game-node.js';
import Board from '@sabaki/go-board';  // Correctly import the Board class from @sabaki/go-board
import { parseCoordinates, convertNodeToSgf, convertSgfToNode } from '../js/utils.js';
import '../css/board.css';
import '../css/board-controller.css';
import '../css/variation-tree.css';
import '../css/variation-tree-node.css';
import GoBoard from "./GoBoard.vue";
import VariationTree from "./VariationTree.vue";
import SGF from 'sgfjs';
import ControlPanel from "./ControlPanel.vue";
import CommentBox from './CommentBox.vue';

export default {
  name: 'GoBoardController',
  components: {
    GoBoard,
    ControlPanel,
    CommentBox,
    VariationTree
  },
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
          turn: 'B', // Default to Black stones
          mode: 'Play', // Default mode

      };
  },
  computed: {
    boardMode() {
      console.log("board mode is " + (this.mode === 'Play' ? this.turn : this.mode));
      return this.mode === 'Play' ? this.turn : 'A';
    }
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
      // window.removeEventListener('resize', this.calculateScale);
  },
  methods: {
      updateMode(newMode) {
        console.log(`Mode changed to: ${newMode}`);
        this.mode = newMode; // Update the mode
      },
        updateNodeComment(newComment) {
      // Update the comment in the current node's props
      this.currentNode.props.C = newComment;
      console.log('Updated comment:', newComment);
    },

      handleAction(action) {
    console.log(`Action selected: ${action}`);
    if (action === 'Open') {
      this.openGame();
    } else if (action === 'Save') {
      this.saveGame();
    } else if (action === 'Game Info') {
      this.showGameInfo();
    }
  },
  openGame() {
    console.log('Open game functionality goes here');
  },
    getCsrfToken() {
            const match = document.cookie.match(/csrftoken=([^;]+)/);
            console.log("csrf token is " + (match ? match[1] : null));
            return match ? match[1] : null;
        },

  saveGame() {
    if (!this.rootNode) {
        console.error('No game data to save.');
        return;
      }

        // Convert the root node and its children to an SGF string
        const sgfString = `(${convertNodeToSgf(this.rootNode)})`;

        // Save or download the SGF string
        console.log('SGF String:', sgfString);
        // Send the SGF string to the backend
      fetch('save-sgf/', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'X-CSRFToken': this.getCsrfToken() // Add the CSRF token here

          },
          body: new URLSearchParams({ sgf_string: sgfString })
      })
      .then(response => {
          if (!response.ok) {
              // Log the full response if there's an error
              console.error('Error response from server:', response);
              return response.text(); // Parse as text to see the error page
          }
          return response.json(); // Parse as JSON if the response is OK
      })
      .then(data => {
          console.log('Response data:', data);
      })
      .catch(error => {
          console.error('Error during save request:', error);
      });

        // Example: Trigger a download
        // const blob = new Blob([sgfString], { type: 'text/plain' });
        // const link = document.createElement('a');
        // link.href = URL.createObjectURL(blob);
        // link.download = 'game.sgf';
        // document.body.appendChild(link);
        // link.click();
        // document.body.removeChild(link);

  },
  showGameInfo() {
    console.log('Game info functionality goes here');
  },

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

          if (this.mode === 'A' || this.mode === '1') {
            console.log("currnet node props");
            console.log(this.currentNode.props);
            this.addAnnotation(sgfCoord);

            this.currentNode.print();
            return;
          }

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

    addAnnotation(sgfCoord) {
        let lb = this.currentNode.props.LB || []; // Ensure LB exists as an array
          if (typeof lb === 'string') {
              lb = [lb];
          }

        const usedValues = lb.map(annotation => annotation.split(':')[1]); // Extract used annotations

        // Check if the coordinate already has an annotation
        const existingAnnotationIndex = lb.findIndex(annotation => annotation.startsWith(`${sgfCoord}:`));

        if (existingAnnotationIndex !== -1) {
            const existingAnnotation = lb[existingAnnotationIndex];
            const existingValue = existingAnnotation.split(':')[1];

            if (this.mode === 'A' && /^[A-Z]$/.test(existingValue)) {
                // If mode is 'A' and there's already a letter, remove it
                console.log(`Removing existing letter annotation: ${existingAnnotation}`);
                lb.splice(existingAnnotationIndex, 1);
                this.currentNode.props.LB = lb; // Update the props
                return; // Exit without adding a new annotation
            }

            if (this.mode === '1' && /^\d+$/.test(existingValue)) {
                // If mode is '1' and there's already a number, remove it
                console.log(`Removing existing number annotation: ${existingAnnotation}`);
                lb.splice(existingAnnotationIndex, 1);
                this.currentNode.props.LB = lb; // Update the props
                return; // Exit without adding a new annotation
            }

            // If different type exists, remove it and proceed to add the new annotation
            console.log(`Replacing ${existingAnnotation} with a new annotation.`);
            lb.splice(existingAnnotationIndex, 1);
        }

        let newAnnotation;

        if (this.mode === 'A') {
            // Handle letters
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const availableLetter = letters.split('').find(letter => !usedValues.includes(letter));

            if (availableLetter) {
                newAnnotation = `${sgfCoord}:${availableLetter}`;
            } else {
                console.log('No available letters for annotation.');
                return;
            }
        } else if (this.mode === '1') {
            // Handle numbers
            let availableNumber = 1;
            while (usedValues.includes(String(availableNumber))) {
                availableNumber++;
            }

            newAnnotation = `${sgfCoord}:${availableNumber}`;
        } else {
            console.log(`Unsupported mode: ${this.mode}`);
            return;
        }

        // Add the new annotation to LB
        lb.push(newAnnotation);
        this.currentNode.props.LB = lb; // Update the props object
        console.log(`Added annotation: ${newAnnotation}`);
    },

      determineNextColor() {
          // Determine the color of the next move based on the current node
          const parentProps = this.currentNode.props;
          if (parentProps.W || (!parentProps.W && !parentProps.B)) {
              this.turn = 'B';
              return 'B'; // If the parent is a Black move or root, the next is White
          }
          this.turn = 'W';
          return 'W'; // Otherwise, the next move is Black
      },


      // calculateScale() {
      //     // Get the size of the parent column
      //     const firstColumn = this.$el.querySelector('.first-column');
      //     if (firstColumn) {
      //         const availableWidth = firstColumn.clientWidth;
      //         const availableHeight = firstColumn.clientHeight;
      //
      //         console.log("available width is " + availableWidth + " and available height is " + availableHeight);
      //
      //         // Calculate scale based on the smaller of width or height
      //         const scaleWidth = (availableWidth * 0.98)/ this.boardBaseSize;
      //         const scaleHeight = availableHeight / this.boardBaseSize;
      //         this.scale = Math.min(scaleWidth, scaleHeight); // Maintain aspect ratio
      //         console.log("Updated scale:", this.scale);
      //     }
      // },

      loadSgf(sgfString) {
          console.log("about to parse sgf which is " + sgfString);

          this.sgfData = SGF.parse(sgfString);
          console.log("sgf data is " + JSON.stringify(this.sgfData));
          // Convert parsed SGF data to a tree of Node instances
          this.rootNode = convertSgfToNode(this.sgfData);
          this.currentNode = this.rootNode;
          console.log("the current node is " + this.currentNode.print());

          this.updateBoardState();
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
        console.log("button is being clicked");
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
          this.turn = this.determineNextColor();

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
  }
}
</script>