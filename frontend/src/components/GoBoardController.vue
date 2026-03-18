<template>
      <div class="board-controller">

        <input
          type="file"
          ref="fileInput"
          style="display: none"
          accept=".sgf"
          @change="handleFileUpload"
        />

          <div class="columns">
              <!-- First Column: Board and Controls -->
              <div class="first-column">
                  <div class="board-container-wrapper">
                      <GoBoard
                          ref="goBoard"
                          :current-node="currentNode"
                          :translate-x="translateX"
                          :translate-y="translateY"
                          :scale="scale"
                          :ghostMode="boardMode"
                          @board-clicked="handleBoardClick"
                          @pattern-updated="updatePatternInfo">
                      </GoBoard>


                    <div v-if="patternSearchInProgress" class="pattern-status">Searching…</div>

<div v-if="patternProgress" class="pattern-progress">
  {{ patternProgress.scanned }}/{{ patternProgress.total }} — {{ patternProgress.currentFile }}
</div>

<div v-if="!patternSearchInProgress && patternSearchDone && patternHits.length === 0" class="pattern-no-results">
  No results found in {{ patternFilesScanned }} files.
</div>

<div v-if="patternHits.length" class="pattern-hits-container">
  <div class="pattern-hits-header">
    {{ patternHits.length }} result{{ patternHits.length !== 1 ? 's' : '' }} found
  </div>
  <div class="pattern-hits-scroll">
    <div
      v-for="h in patternHits"
      :key="(h.sgf_file || h.file) + ':' + (h.position_path || h.move_number)"
      class="pattern-hit-item"
      @click="loadHit(h)">
      <span class="hit-filename">{{ (h.sgf_file || h.file || '').split('/').pop().replace(/^__go4go_/, '') }}</span>
      <span class="hit-move">Move {{ h.move_number || h.moveNumber }}</span>
    </div>
  </div>
</div>

<div v-if="!patternSearchInProgress && patternSearchDone" style="margin-top:6px;">
  <button class="action-button" @click="onSearchMore" style="font-size:13px; padding:6px 12px;">
    Search More (next 100 files)
  </button>
</div>


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

<!--                    <ControlPanel-->
<!--                      :currentMode="mode"-->
<!--                      @mode-selected="updateMode"-->
<!--                      @action-selected="handleAction"/>-->


                  <ControlPanel
                    :currentMode="mode"
                      @mode-selected="updateMode"
                    @action-selected="handleAction"
                    @pattern-search="onPatternSearch"
                    @clear-pattern="onClearPattern"
                    @next-to-play-changed="onNextToPlayChanged"
                  />

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
          currentNode: null,     // Reference to the current node in the SGF tree
          rootNode: null,        // Reference to the root node of the SGF tree
          patternWS: null,
          patternSearchInProgress: false,
          patternSearchDone: false,
          patternFilesScanned: 0,
          patternLastFile: null,   // last file scanned, for "Search More" pagination
          patternHits: [],         // streamed results
          patternProgress: null,   // {scanned, total, currentFile}
          patternTemplate: [],
          patternTurn: null,
          patternNextToPlay: 'B', // 'B' = black to play next, 'W' = white to play next

          translateX: 0,
          translateY: 0,
          turn: 'B', // Default to Black stones
          mode: 'Play', // Default mode

      };
  },
  computed: {
    boardMode() {
      console.log("board mode is " + (this.mode === 'Play' ? this.turn : this.mode));
      if (this.mode === 'Pattern') {
        return 'Pattern';
      }
      return this.mode === 'Play' ? this.turn : 'A';
    }
  },
  mounted() {
      if (window.sgfString) {
          this.loadSgf(window.sgfString);
          console.log("sgf data is " + this.sgfData);
      }

  },
  beforeDestroy() {
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
      this.$refs.fileInput.click(); // Trigger file picker
    } else if (action === 'Save') {
      this.saveGame();
    } else if (action === 'Game Info') {
      this.showGameInfo();
    }
  },

    getPatternTurn() {
  if (!this.currentNode) return 1; // default black
  if (this.currentNode.props.B) return 2; // last move black → white's turn
  if (this.currentNode.props.W) return 1; // last move white → black's turn
  return 1; // fallback
},
  handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const sgfText = e.target.result;
      console.log("sgf text is ", sgfText)
      this.loadSgf(sgfText);  // Reuse your existing loader
    };
    reader.readAsText(file);
  },

  openPatternSocket(appendMode = false) {
    if (this.patternWS && this.patternWS.readyState === WebSocket.OPEN) return;
    this.patternWS = new WebSocket("ws://localhost:8000/ws/patternsearch/");

    this.patternWS.onopen = () => {
      this.patternSearchInProgress = true;
      this.patternSearchDone = false;
      if (!appendMode) {
        this.patternHits = [];
        this.patternFilesScanned = 0;
        this.patternLastFile = null;
      }
      this.patternErrors = [];
      this.patternProgress = null;
      console.log("[Pattern] connected");
    };

    this.patternWS.onmessage = (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }

      if (msg.type === "hit") {
        this.patternHits.push(msg);
      } else if (msg.type === "progress") {
        this.patternProgress = msg;
        if (msg.currentFile) this.patternLastFile = msg.currentFile;
      } else if (msg.type === "done") {
        this.patternSearchInProgress = false;
        this.patternSearchDone = true;
        this.patternFilesScanned += (msg.scanned || 100);
        if (msg.lastFile) this.patternLastFile = msg.lastFile;
      } else if (msg.type === "error") {
        this.patternErrors = this.patternErrors || [];
        this.patternErrors.push(msg.message || "Unknown pattern search error");
      }
    };

    this.patternWS.onerror = (e) => {
      console.warn("[Pattern] ws error", e);
    };
    this.patternWS.onclose = () => {
      console.log("[Pattern] disconnected");
      this.patternSearchInProgress = false;
    };
  },

  closePatternSocket() {
    if (this.patternWS) {
      try { this.patternWS.close(); } catch {}
      this.patternWS = null;
    }
  },

// "Last move" = who played the most recent stone.
// Last move = Black → White to play next → pattern_turn=2
// Last move = White → Black to play next → pattern_turn=1
getEffectivePatternTurn() {
  return this.patternNextToPlay === 'B' ? 2 : 1;
},

onNextToPlayChanged(color) {
  this.patternNextToPlay = color;
},

onPatternSearch() {
  this.closePatternSocket();
  this.startPatternSearch({
    patternTemplate: this.patternTemplate,
    patternTurn: this.getEffectivePatternTurn(),
    appendMode: false
  });
},

onSearchMore() {
  this.closePatternSocket();
  this.startPatternSearch({
    patternTemplate: this.patternTemplate,
    patternTurn: this.getEffectivePatternTurn(),
    startAfterFilename: this.patternLastFile,
    appendMode: true
  });
},

onClearPattern() {
  if (this.$refs.goBoard) {
    this.$refs.goBoard.clearPattern();
  }
  this.patternHits = [];
  this.patternTemplate = [];
  this.patternTurn = null;
  this.patternProgress = null;
},
  // --- Kick off a search ---
  startPatternSearch({ patternTemplate, patternTurn, startAfterFilename=null, appendMode=false }) {
    console.log("pattern template is ", patternTemplate);
    this.openPatternSocket(appendMode);
    if (!this.patternWS || this.patternWS.readyState !== WebSocket.OPEN) {
      // slight delay if socket is still connecting
      setTimeout(() => this.startPatternSearch({ patternTemplate, patternTurn, startAfterFilename, appendMode }), 120);
      return;
    }
    const payload = {
      type: "start",
      pattern_template: patternTemplate,
      pattern_turn: patternTurn,
      start_after_filename: startAfterFilename
    };
    this.patternWS.send(JSON.stringify(payload));
  },

  stopPatternSearch() {
    // Optional: if you added a “stop” command in your consumer, send it here; otherwise just close the socket.
    if (this.patternWS && this.patternWS.readyState === WebSocket.OPEN) {
      this.patternWS.send(JSON.stringify({ command: "stop" })); // only if supported
    }
    this.closePatternSocket();
  },

  // --- Use a hit ---
  async loadHit(hit) {
    // hit: { sgf_file, move_number, position_path }
    const file = hit.sgf_file || hit.file;
    const resp = await fetch(`/get_sgf?file=${encodeURIComponent(file)}`);
    const sgf = await resp.text();

    // Clear pattern overlay before loading new game
    if (this.$refs.goBoard) {
      this.$refs.goBoard.clearPattern();
    }

    // 2) Reuse your existing loader
    this.loadSgf(sgf);

    // 3) Navigate to the position
    const moveNum = hit.move_number || hit.moveNumber;
    if (moveNum) {
      let node = this.rootNode;
      for (let i = 0; i < moveNum && node && node.children && node.children[0]; i++) {
        node = node.children[0];
      }
      if (node) this.navigateToNode(node);
    }
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
  updatePatternInfo({patternTemplate, patternTurn}) {
        console.log("updating pattern info with ", patternTemplate)
        this.patternTemplate = patternTemplate;
        this.patternTurn = patternTurn;
        console.log("pattern template when updating is", this.patternTemplate)
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

          this.turn = this.determineNextColor();
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


      loadSgf(sgfString) {
          console.log("about to parse sgf which is " + sgfString);

          this.sgfData = SGF.parse(sgfString);
          console.log("sgf data is " + JSON.stringify(this.sgfData));
          // Convert parsed SGF data to a tree of Node instances
          this.rootNode = convertSgfToNode(this.sgfData);
          this.currentNode = this.rootNode;
          console.log("the current node is " + this.currentNode.print());

          this.turn = this.determineNextColor();
      },

      navigateToNode(node) {
        console.log("in navigate to node");
          console.log("current node is node? " + (this.currentNode === node) )
          this.currentNode = node;
          // this.currentNode = null;
          // this.$nextTick(() => {
          //   this.currentNode = node; // or this.currentNode.getNextChild() in nextMove
          // });

          this.turn = this.determineNextColor();
      },

      nextMove() {
          if (this.currentNode && this.currentNode.children.length > 0) {
              // this.currentNode = this.currentNode.children[0]; // Move to the next node in the main line
              this.currentNode = this.currentNode.getNextChild();
              console.log("Moved to next node:", this.currentNode.print());
              this.turn = this.determineNextColor();

          }
      },
      previousMove() {
          if (this.currentNode && this.currentNode.parent) {
              this.currentNode = this.currentNode.parent; // Move to the previous node (parent)
              console.log("Moved to previous node:", this.currentNode.print());
              this.turn = this.determineNextColor();

          }
      },
      goToStart() {
        console.log("button is being clicked");
          if (this.rootNode) {
              this.currentNode = this.rootNode; // Set current node to the root
              console.log("Moved to start of the game.");
              this.turn = this.determineNextColor();
          }
      },
      goBack10Moves() {
          let count = 0;
          while (this.currentNode && this.currentNode.parent && count < 10) {
              this.currentNode = this.currentNode.parent; // Move to the previous node (parent)
              count++;
          }
          console.log(`Moved back ${count} moves.`);
          this.turn = this.determineNextColor();
      },
      goForward10Moves() {
          let count = 0;
          while (this.currentNode && this.currentNode.children.length > 0 && count < 10) {
              this.currentNode = this.currentNode.getNextChild(); // Move to the next node in the main line
              count++;
          }
          console.log(`Moved forward ${count} moves.`);
          this.turn = this.determineNextColor();
      },
      goToEnd() {
          while (this.currentNode && this.currentNode.children.length > 0) {
              this.currentNode = this.currentNode.getNextChild(); // Move to the next node in the main line
          }
          console.log("Moved to end of the game.");
          this.turn = this.determineNextColor();
      },

  }
}
</script>