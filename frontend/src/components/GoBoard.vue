
<template>
    <div class="board-container"
         :style = "{
      'grid-template-columns': cellSize * 1.3 + 'px 1fr' + cellSize * 1.3 + 'px',
      'grid-template-rows': cellSize * 1.3 + 'px 1fr' + cellSize * 1.3 + 'px'} "
    >


<!--      :style="{ transform: \`translate(\${translateX}px, \${translateY}px) scale(\${scale})\` }"-->
      <!-- Scale doesn't work bc it messes up hovering -->

      <!-- Top Labels -->
      <div class="top-labels">
          <div class="label" v-for="letter in letters" :key="'top-' + letter">
              {{ letter }}
          </div>
      </div>

      <!-- Left Labels -->
      <div class="left-labels">
          <div class="label" v-for="number in numbers" :key="'left-' + number">
              {{ number }}
          </div>
      </div>


      <!-- Board -->
      <div class="board"
        @mousemove="handleMouseMove"
        @mouseleave="handleMouseLeave"
      @click="handleMouseClick"

           :style="{
               width: (board_size - 1) * cellSize + 'px',
               height: (board_size - 1) * cellSize + 'px',
           }">
          <!-- Grid Lines -->
          <div
              v-for="i in board_size"
              :key="'h' + i"
              class="grid-line"
              :style="{
                  top: (i - 1) * cellSize + 'px',
                  left: '0',
                  width: (board_size - 1) * cellSize + 'px',
                  height: '1px'
              }">
          </div>


          <div
              v-for="j in board_size"
              :key="'v' + j"
              class="grid-line"
              :style="{
                  left: (j - 1) * cellSize + 'px',
                  top: '0',
                  width: '1px',
                  height: (board_size - 1) * cellSize + 'px'
              }">
          </div>

          <!-- Stones -->
          <div
              v-for="(stone, index) in stonePositions"
              :key="index"
              :class="['stone', stone.color]"
              :style="{
                  top: stone.top + 'px',
                  left: stone.left + 'px',
                  width: cellSize-1 + 'px',
                  height: cellSize-1 + 'px'
              }">
          </div>

          <div v-if="hoveredPosition"
               :class="['ghost-stone', 'ghost-stone-' + ghostMode]"
               :style="{
                   left: hoveredPosition.x * cellSize + 'px',
                   top: hoveredPosition.y * cellSize + 'px',
                   width: cellSize-1 + 'px',
                   height: cellSize-1 + 'px',
                   'font-size': cellSize - 5 + 'px'

                   // backgroundColor: ghostMode === 'B' ? 'black' : 'white',
                   // borderColor: ghostMode === 'W' ? 'black' : 'transparent'
               }">
              <span v-if="ghostMode === 'A'">X</span>

          </div>

          <!-- Star Points -->
          <div
              v-for="(point, index) in starPoints"
              :key="'star' + index"
              class="star-point"
              :style="{
                  top:  point[1] * cellSize + 'px',
                  left: point[0] * cellSize + 'px'
              }">
          </div>

          <!-- Labels -->
          <div
              v-for="(label, index) in labels"
              :key="'label-' + index"
              :class="['label2', { circle: label.isCircle }]"
              :style="{
                  top: label.row  * cellSize + 'px',
                  left: label.col * cellSize + 'px',
                  color: label.color,
                  backgroundColor: label.background // Set the background color dynamically
              }">
              {{ label.isCircle ? '' : label.text }}
          </div>

                <!-- KataGo Suggested Move Overlays -->
        <div v-for="move in topKatagoMoves" :key="move.move">
          <div
            class="katago-overlay-circle"
            :class="getKataMoveColor(move)"
            :style="{
              top: katagoCoordToBoardXY(move.move).y * cellSize + 'px',
              left: katagoCoordToBoardXY(move.move).x * cellSize + 'px',
              width: cellSize-1 + 'px',
              height: cellSize-1 + 'px'
            }"
          ></div>

          <div
            class="katago-overlay-label"

            :style="{
              top: katagoCoordToBoardXY(move.move).y * cellSize + 'px',
              left: katagoCoordToBoardXY(move.move).x * cellSize + 'px'
            }"
          >
            {{ (move.winrate * 100).toFixed(1) }}<br>
            {{ move.visits }}<br />

            {{ move.scoreLead.toFixed(1) }}
          </div>
        </div>


      </div>

      <!-- Right Labels -->
      <div class="right-labels">
          <div class="label" v-for="number in numbers" :key="'right-' + number">
              {{ number }}
          </div>
      </div>

      <!-- Bottom Labels -->
      <div class="bottom-labels">
          <div class="label" v-for="letter in letters" :key="'bottom-' + letter">
              {{ letter }}
          </div>
      </div>
  </div>
</template>

<script>

import {parseCoordinates, katagoCoordToBoardXY, boardXYToKatagoCoord} from "../js/utils";
import Board from "@sabaki/go-board";

export default {
  name: 'GoBoard',
    data() {
      return {
        board_size: 19,
        stonePositions: [],
        labels: [], // Keep labels here
        starPoints: [
            [3, 3], [3, 9], [3, 15],
            [9, 3], [9, 9], [9, 15],
            [15, 3], [15, 9], [15, 15]
        ],
        katagoMoveMap: {},  // move string -> { scoreLead, visits, winrate, ... }
        gtpCommandLog: [],
        currentPathMoves: [],
        sabakiBoard: Board.fromDimensions(19),


        letters: ['A','B','C','D','E','F','G','H','J','K','L','M','N','O','P','Q','R','S','T'],
        numbers: Array.from({length: 19}, (_, i) => 19 - i),
        cellSize: 38,
        hoveredPosition: null, // Track the hovered position
        katagoSocket: null,
        katagoMoves: [],
        gtpCommand: ""  // optional if you want a dev test field
      };
    },
    props: {
      initialBoardState: {
          type: Array,  // Changed from Array to Object to match the new structure
          required: true
      },
      currentNode: {
          type: Object,
          required: true
      },
      translateX: {
          type: Number,
          default: 0
      },
      translateY: {
          type: Number,
          default: 0
      },
      scale: {
          type: Number,
          default: 1
      },
      ghostMode: {
          type: String,
          default: 'B' // Default to Black stones
      },
    },
    mounted() {

        // this.updateCellSize();
        this.connectToKataGo();
        // this.getBoardFromNode(this.rootNode);

        console.log("cell size is " + this.cellSize);
        console.log("board size is " + this.board_size);
        // this.$forceUpdate();
        // this.updateCellSize();
        // window.addEventListener('resize', this.updateCellSize);

        // console.log("the initialBoardState upon mount is " + this.initialBoardState);
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.updateCellSize);
    },
    watch: {
      // initialBoardState: {
      //   handler(newVal, oldVal) {
      //       this.generateStonePositions();
      //   },
      //   deep: true
      // },
      currentNode: {
        handler(newNode, oldNode) {

          // const oldMoves = oldNode.getMovesToNode(this.rootNode);
          // const newMoves = newNode.getMovesToNode(this.rootNode);
          if (oldNode != null && newNode != null && this.katagoSocket != null) {
            this.syncKatagoToNewNode(newNode, oldNode);

          }
            this.generateLabels();
            this.getBoardFromNode(this.rootNode);
            this.generateStonePositions();

        },
        deep: true
      },
      ghostMode: {
        handler(newVal, oldVal) {
              console.log("ghostMode changed " + this.ghostMode);
          },

      }

    },

computed: {
  topKatagoMoves() {
    console.log("katago move map is ", this.katagoMoveMap)
    return Object.values(this.katagoMoveMap)
      .filter(m => m.visits > 10)
      .sort((a, b) => {
        if (b.scoreLead !== a.scoreLead) return b.scoreLead - a.scoreLead;
        return b.visits - a.visits;
      })
      .slice(0, 10);
  },
  bestKatagoMove() {
    return this.topKatagoMoves.length > 0 ? this.topKatagoMoves[0] : null;
  }

},

    methods: {
      katagoCoordToBoardXY,
      connectToKataGo() {
        this.katagoSocket = new WebSocket("ws://localhost:8000/ws/katago/");

        this.katagoSocket.onopen = () => {
          console.log("KataGo WebSocket connected.");
          // Optional: send command automatically
          this.katagoSocket.send("clear_board");
          this.katagoSocket.send("time_settings 0 2 1");
          // this.katagoSocket.send("play b Q16");
          // this.katagoSocket.send("kata-analyze w 10");
        };

        this.katagoSocket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          const line = data.line;

          if (!line.startsWith("info move")) return;

          // Split on "info move", add it back to each part
          const chunks = line.split(/info move\s+/).filter(Boolean);
          console.log("got katago message")
          for (const chunk of chunks) {
            const fullLine = "info move " + chunk.trim();
            const moveInfo = this.parseInfoMove(fullLine);
            const key = moveInfo.move;

            if (!this.katagoMoveMap[key]) {
              // console.log("adding...", moveInfo);
              this.katagoMoveMap[key] = moveInfo;
            } else {
              // console.log("updating...", moveInfo);
              Object.assign(this.katagoMoveMap[key], moveInfo);
            }
          }
        };
      },

      getKataMoveColor(move) {
        // if (!this.bestKatagoMove) return "katago-move-orange";

        const leadDiff = this.bestKatagoMove.scoreLead - move.scoreLead;
        const winrateDiff = this.bestKatagoMove.winrate - move.winrate;

        if (move.move === this.bestKatagoMove.move) {
          return "katago-move-blue";
        } else if (leadDiff <= 0.2 || winrateDiff <= 0.01) {
          return "katago-move-green";
        } else {
          return "katago-move-orange";
        }
      },
      handleMouseMove(event) {
        const rect = event.currentTarget.getBoundingClientRect(); // Board's position
        const x = Math.floor((event.clientX - rect.left + this.cellSize / 2) / this.cellSize);
        const y = Math.floor((event.clientY - rect.top + this.cellSize / 2) / this.cellSize);

        // Ensure hover stays within the board bounds
        if (x >= 0 && x < this.board_size && y >= 0 && y < this.board_size) {
          // Check if there's an existing stone and ghostMode is 'B' or 'W'
          if (this.ghostMode === 'A' || this.ghostMode === '1') {
            this.hoveredPosition = {x, y};
          } else if ((this.ghostMode === 'B' || this.ghostMode === 'W') && this.initialBoardState[y][x] === 0) {
            this.hoveredPosition = {x, y};
          } else {
            this.hoveredPosition = null;
          }
        } else {
          this.hoveredPosition = null; // Reset if outside bounds
        }
      },
      handleMouseLeave() {
        this.hoveredPosition = null; // Clear hover state
      },
      handleMouseClick(event) {
        const rect = event.currentTarget.getBoundingClientRect(); // Board's position
        const x = Math.floor((event.clientX - rect.left + this.cellSize / 2) / this.cellSize);
        const y = Math.floor((event.clientY - rect.top + this.cellSize / 2) / this.cellSize);

        // Ensure the click is within board bounds
        if (x >= 0 && x < this.board_size && y >= 0 && y < this.board_size) {
          // Block clicks on existing stones if ghostMode is 'B' or 'W'
          if ((this.ghostMode === 'B' || this.ghostMode === 'W') && this.initialBoardState[y][x] !== 0) {
            console.log(`Click blocked at (${x}, ${y}) - Stone already exists.`);
            return;
          }

          // Allow the click for other modes or empty positions
          console.log(`Clicked coordinate: (${x}, ${y})`);
          this.$emit('board-clicked', {x, y}); // Emit event with coordinates
          this.hoveredPosition = null; // Clear hover state

          // Convert (x, y) to GTP coordinate
          const colLetter = this.letters[x];       // 'A'...'T' (skipping I)
          const rowNumber = 19 - y;                // Flip Y for bottom-up

          const gtpCoord = `${colLetter}${rowNumber}`;
          const color = this.ghostMode.toLowerCase();  // 'b' or 'w'

          // if (this.katagoSocket) {
          //   let gtpCmd = `play ${color} ${gtpCoord}`;
          //   console.log("Sending to KataGo:", gtpCmd);
          //   this.katagoSocket.send(gtpCmd);
          //   this.gtpCommandLog.push(`[${new Date().toLocaleTimeString()}] ${gtpCmd}`);
          //
          //
          //   // Optional: re-analyze after move
          //   this.katagoMoves = [];  // clear previous analysis
          //   gtpCmd = "kata-analyze " + (color === "b" ? "w" : "b") + " 100";
          //   this.katagoSocket.send(gtpCmd);
          //
          //   this.gtpCommandLog.push(`[${new Date().toLocaleTimeString()}] ${gtpCmd}`);
          //
          //   console.log("clicked move, reseting katagoMoveMap");
          //   this.katagoMoveMap = {};
          //
          // }

        }
      },
      parseInfoMove(line) {
        const parts = line.split(/\s+/);
        const result = {};
        for (let i = 0; i < parts.length; i++) {
          if (parts[i] === "move") result.move = parts[++i];
          else if (parts[i] === "visits") result.visits = parseInt(parts[++i]);
          else if (parts[i] === "winrate") result.winrate = parseFloat(parts[++i]);
          else if (parts[i] === "scoreLead") result.scoreLead = parseFloat(parts[++i]);
          else if (parts[i] === "prior") result.prior = parseFloat(parts[++i]);
          else if (parts[i] === "order") result.order = parseInt(parts[++i]);
        }
        return result;
      },
      updateCellSize() {
        console.log("calling updateCellSize");
        const container = this.$el; // Reference the current component's root element
        if (container) {
          const availableWidth = container.clientWidth;
          // Account for labels
          this.cellSize = Math.floor(availableWidth / (this.board_size + 2));
          console.log("cell size is " + this.cellSize);
        }
        // this.generateStonePositions();
      },

      getBoardFromNode(rootNode) {
        console.log("getting board form curr node")
        const moves = this.currentNode.getMovesToNode(rootNode);
        this.sabakiBoard = Board.fromDimensions(19);
        moves.forEach(move => {
          if (move.B) {
            const [col, row] = parseCoordinates(move.B);
            this.sabakiBoard = this.sabakiBoard.makeMove(1, [col, row]); // Black stone (1)
          }
          if (move.W) {
            const [col, row] = parseCoordinates(move.W);
            this.sabakiBoard = this.sabakiBoard.makeMove(-1, [col, row]); // White stone (-1)
          }
        });

      },

      syncKatagoToNewNode(newNode, oldNode) {

        const newMoves = newNode.getMovesToNode(this.rootNode);

        const oldMoves = oldNode.getMovesToNode(this.rootNode);
        console.log("oldMoves length is " + oldMoves.length);
        console.log("newMoves length is " + newMoves.length);

        let commonPrefixLen = 0;
        while (
            commonPrefixLen < oldMoves.length &&
            commonPrefixLen < newMoves.length &&
            JSON.stringify(oldMoves[commonPrefixLen]) === JSON.stringify(newMoves[commonPrefixLen])
            ) {
          commonPrefixLen++;
        }

        const undoCount = oldMoves.length - commonPrefixLen;
        const replayMoves = newMoves.slice(commonPrefixLen);

        for (let i = 0; i < undoCount; i++) {
          this.katagoSocket.send("undo");
          console.log("sending to katago: undo");
        }

        console.log("replay move is " + JSON.stringify(replayMoves, null, 2));
        for (const move of replayMoves) {
          const color = move.B ? 'b' : 'w';
          const coord = move.B ? move.B : move.W;
          console.log("coord is "+ coord)
          console.log("parseCoordinates(coord) is " + parseCoordinates(coord))
          const kataCoord = boardXYToKatagoCoord(parseCoordinates(coord))
          console.log("kata coord is " + kataCoord)
          if (coord !== "pass") {
            this.katagoSocket.send(`play ${color} ${kataCoord}`);
                        console.log(`Sending to katago: play ${color} ${kataCoord}`);

            // this.logGTPCommand(`play ${color} ${gtpMove}`);
          }
        }

        let nextColor = this.currentNode.props.B ? 'w' : 'b'; // default

        // if (this.currentNode?.props) {
        //   if (this.currentNode.props.B) nextColor = 'w';
        //   else if (this.currentNode.props.W) nextColor = 'b';
        // }

        this.katagoSocket.send(`kata-analyze ${nextColor} 100`);
        this.katagoMoveMap = {};

        // this.logGTPCommand("kata-analyze b");
      },

      generateStonePositions() {
        // const sgfBoard = this.getBoardFromNode(this.rootNode);
        this.stonePositions = [];

        for (let row = 0; row < this.board_size; row++) {
          for (let col = 0; col < this.board_size; col++) {
            const color = this.sabakiBoard.get([col, row]);
            // this.sabakiBoard.get()
            if (color) {
              this.stonePositions.push({
                color: color === 1 ? 'black' : 'white',
                top: row * this.cellSize,
                left: col * this.cellSize
              });
            }
          }
        }
      },

      generateLabels() {

        const props = this.currentNode.props;
        const labels = [];

        // // Extract the comment (if exists)
        // if (props.C) {
        //     labels.push({
        //         text: props.C, // Add the comment as a label
        //         row: this.board_size, // You can position it at the bottom or any preferred row
        //         col: Math.floor(this.board_size / 2), // Center it horizontally or set as needed
        //         color: 'black' // Default to black for comments
        //     });
        // }

        // Extract labels from 'LB'
        const labelPositions = new Set(); // To track which positions already have labels

        if (props.LB) {
          const labelEntries = Array.isArray(props.LB) ? props.LB : [props.LB]; // Ensure it's an array
          labelEntries.forEach(label => {
            const [position, text] = label.split(':'); // Assuming 'LB' follows "position:text" format
            const [col, row] = parseCoordinates(position);
            labelPositions.add(`${row},${col}`); // Track the labeled positions

            // Check if a stone is at this position
            // const stone = this.initialBoardState.find(stone => stone.row === row && stone.col === col);
            const stone = this.initialBoardState[row][col]; // -1 for white, 1 for black, 0 for empty
            let labelColor = 'black'; // Default label color
            let backgroundColor = 'rgba(245, 222, 179, 0.7)'; // Light background with some opacity

            if (stone === 1) {
              labelColor = 'white'; // Label on a black stone should be white
              backgroundColor = 'transparent'; // No background needed over stones

            } else if (stone === -1) {
              labelColor = 'black'; // Label on a white stone should be black
              backgroundColor = 'transparent'; // No background needed over stones
            }

            labels.push({
              text: text,
              row: row,
              col: col,
              color: labelColor,
              background: backgroundColor

            });
          });
        }

        if (props.B || props.W) {
          const movePosition = props.B ? props.B : props.W;
          const [col, row] = parseCoordinates(movePosition);

          // Only add a circle if no label exists at this position
          if (!labelPositions.has(`${row},${col}`)) {
            const stone = this.initialBoardState[row][col];
            const circleColor = stone === 1 ? 'white' : 'black'; // Match the stone color for the circle

            labels.push({
              text: '', // No text, just a circle
              row: row,
              col: col,
              color: circleColor,
              isCircle: true // Mark this as a circle
            });
          }
        }
        this.labels = labels;
      }
    }
  }

</script>