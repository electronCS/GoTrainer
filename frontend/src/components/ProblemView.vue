<template>
      <div class="problem-view">
        <div class="tag-search">
          <input type="text" v-model="searchTags" placeholder="Enter tags separated by commas" />
          <button @click="searchByTags">Search</button>
        </div>
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

              <div class="second-column">
                    <div class="status-display">
      <span v-if="isCorrect === true" class="correct-message">Correct!</span>
      <span v-if="isCorrect === false" class="wrong-message">Wrong, try again!</span>
      <button v-if="isCorrect === true" @click="loadNextProblem">Next Problem</button>
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
  name: 'ProblemView',
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
    currentIndex: currentIndex,
    tags: tags,
    searchTags: tags, // Pre-fill the search field

          currentBoardState: [], // Array to represent the current board state
          currentNode: null,     // Reference to the current node in the SGF tree
          rootNode: null,        // Reference to the root node of the SGF tree
          isCorrect: null,
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
          // if (this.currentNode !== this.problemNode) {
          //   return 'Play'; // Disable ghost stones
          // } else {
          //   return 'None'
          // }
    if (this.currentNode !== this.problemNode) {
      return 'None'; // Disable ghost stones
    }

      console.log("board mode is " + (this.mode === 'Play' ? this.turn : this.mode));
      return this.mode === 'Play' ? this.turn : 'A';
    }
  },
  mounted() {
      if (window.sgfString) {
          this.loadSgf(window.sgfString);
          console.log("sgf data is " + this.sgfData);
      }
        // console.log("Type of correctAnswers:", typeof window.correctAnswers);


      if (window.problemPosition) {
        this.navigateToProblemPosition(window.problemPosition);
            this.problemNode = this.currentNode; // Store the reference to the problem node

        console.log("Type of correctAnswers:", typeof window.correctAnswers);

        console.log("correct answers are " + window.correctAnswers)
    window.correctAnswers = JSON.parse(window.correctAnswers);
        console.log("Type of correctAnswers:", typeof window.correctAnswers);

        window.correctAnswers.forEach((e) => {
          console.log(parseCoordinates(e));
        })

    }

  },
  beforeDestroy() {
      // window.removeEventListener('resize', this.calculateScale);
  },
  methods: {
        updateNodeComment(newComment) {
      // Update the comment in the current node's props
      this.currentNode.props.C = newComment;
      console.log('Updated comment:', newComment);
    },

  searchByTags() {
    const tags = this.searchTags.trim();
    if (tags) {
      window.location.href = `/problem?tags=${tags}&index=0`;
    }
  },
  loadNextProblem() {
    const nextIndex = this.currentIndex + 1; // Increment index
    const tags = this.tags; // Include the current tags
    window.location.href = `/problem?tags=${tags}&index=${nextIndex}`;
  },



  //     loadNextProblem() {
  //   const nextProblemId = "problem_12346"; // Example: Set the next problem ID here
  //
  //   // Redirect to the /problem endpoint with the next problemId
  //   window.location.href = `/problem?problemId=${nextProblemId}`;
  // },

        navigateToProblemPosition(position) {
        if (!position || !this.rootNode) {
            console.error("Invalid position or root node not set.");
            return;
        }
        const pathSegments = position.split("/").map(Number); // Convert path segments to numbers
        let node = this.rootNode;

        for (let segment of pathSegments) {
            if (node.children[segment]) {
                node = node.children[segment];
            } else {
                console.error(`Invalid path segment ${segment} at position ${position}.`);
                return;
            }
        }

        this.navigateToNode(node);
        console.log(`Navigated to problem position: ${position}`);
    },


    getCsrfToken() {
            const match = document.cookie.match(/csrftoken=([^;]+)/);
            console.log("csrf token is " + (match ? match[1] : null));
            return match ? match[1] : null;
        },

      handleBoardClick({ x, y }) {
          console.log(`Clicked on (${x}, ${y})`);
  if (this.currentNode !== this.problemNode) {
    console.log("You can only interact with the board at the problem position.");
    return;
  }
          // Convert board coordinates to SGF coordinates (e.g., A1 = 'aa')
          const sgfX = String.fromCharCode(97 + x); // 'a' + x
          const sgfY = String.fromCharCode(97 + y); // 'a' + y
          const sgfCoord = `${sgfX}${sgfY}`;
          console.log(`SGF coordinate: ${sgfCoord}`);

      if (window.correctAnswers.includes(sgfCoord)) {
        console.log(`The move ${sgfCoord} is correct.`);
        this.isCorrect = true;
      } else {
        console.log(`The move ${sgfCoord} is incorrect.`);
        this.isCorrect = false;
        return; // Prevent further processing if incorrect
      }

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
              this.turn = 'B';
              return 'B'; // If the parent is a Black move or root, the next is White
          }
          this.turn = 'W';
          return 'W'; // Otherwise, the next move is Black
      },


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
          if (this.currentNode && this.currentNode.children.length > 0 && this.currentNode !== this.problemNode) {
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
          while (this.currentNode && this.currentNode.children.length > 0 && count < 10 && this.currentNode !== this.problemNode) {
              this.currentNode = this.currentNode.getNextChild(); // Move to the next node in the main line
              count++;
          }
          console.log(`Moved forward ${count} moves.`);
          this.updateBoardState();
      },
      goToEnd() {
          while (this.currentNode && this.currentNode.children.length > 0 && this.currentNode !== this.problemNode) {
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

<style scoped>

.status-display {
  margin-bottom: 20px; /* Adds space below the status display */
  text-align: center; /* Centers the content */
}

.correct-message {
  color: green;
  font-size: 1.2em;
  margin-right: 10px;
}

.wrong-message {
  color: red;
  font-size: 1.2em;
  margin-right: 10px;
}


</style>
