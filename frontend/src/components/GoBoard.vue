
<template>
  <div class="board-outer-wrapper">

    <!-- Winrate bar -->
    <div v-if="displayWinrate !== null" class="winrate-bar-wrapper">
      <span class="winrate-label winrate-black">⚫ {{ displayWinrate }}%</span>
      <div class="winrate-bar">
        <div class="winrate-fill-black" :style="{ width: displayWinrate + '%' }"></div>
        <div class="winrate-fill-white" :style="{ width: (100 - displayWinrate) + '%' }"></div>
      </div>
      <span class="winrate-label winrate-white">⚪ {{ 100 - displayWinrate }}%</span>
      <span class="score-lead-label">{{ scoreLeadText }}</span>
    </div>

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
        @mousedown="handleMouseDown"
        @mouseup="handleMouseUp"

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

        <!-- Pattern -->

        <div
            v-for="(cell, i) in selectedPatternCells"
            :key="'pattern-cell-' + i"
            class="pattern-highlight"
            :style="{
              top: cell.y * cellSize + 'px',
              left: cell.x * cellSize + 'px',
              width: cellSize-1 + 'px',
              height: cellSize-1 + 'px'

            }"
          ></div>

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

                <!-- KataGo Suggested Move Overlays — skip positions already occupied by a stone -->
        <template v-for="move in topKatagoMoves" :key="move.move">
        <div v-if="!sabakiBoard || sabakiBoard.get([katagoCoordToBoardXY(move.move).x, katagoCoordToBoardXY(move.move).y]) === 0">
          <div
            class="katago-overlay-circle"
            :class="getKataMoveColorClass(move)"
            :style="{
              top: katagoCoordToBoardXY(move.move).y * cellSize + 'px',
              left: katagoCoordToBoardXY(move.move).x * cellSize + 'px',
              width: cellSize-1 + 'px',
              height: cellSize-1 + 'px',
              ...getKataMoveStyle(move)
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
        </template>

<div
  v-for="(pt, index) in patternVertices"
  :key="'vertex-' + index"
  class="pattern-vertex"
  :style="{
    top: pt.y * cellSize + 'px',
    left: pt.x * cellSize + 'px'
  }">
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
  </div><!-- end board-outer-wrapper -->
</template>

<script>

import {parseCoordinates, katagoCoordToBoardXY, boardXYToKatagoCoord} from "../js/utils";
import Board from "@sabaki/go-board";
import {nextTick} from "vue";


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

        dragStart: null,
        dragEnd: null,

        katagoMoveMap: {},  // move string -> { scoreLead, visits, winrate, ... }
        lastKatagoSnapshot: null, // persists last best move so bar stays visible during navigation
        katagoNavGeneration: 0,    // incremented on each navigation
        katagoActiveGeneration: 0, // set equal to navGeneration only after all nav commands sent; messages with mismatch are dropped
        gtpCommandLog: [],
        currentPathMoves: [],
        sabakiBoard: Board.fromDimensions(19),
        katagoRunning: false,
        selectedPatternCells: [],
        patternVertices: [],
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
        this.connectToKataGo();
        window.addEventListener('keydown', this.handleKeyPress);

        console.log("cell size is " + this.cellSize);
        console.log("board size is " + this.board_size);
        // this.$forceUpdate();
        // this.updateCellSize();
        // window.addEventListener('resize', this.updateCellSize);

    },
    beforeDestroy() {
        window.removeEventListener('resize', this.updateCellSize);
        window.removeEventListener('keydown', this.handleKeyPress);
    },
    watch: {

      currentNode: {
        handler(newNode, oldNode) {
          console.log("are new and old the same? " + (newNode === oldNode));

          if (oldNode != null && newNode != null && this.katagoSocket != null) {
            this.syncKatagoToNewNode(newNode, oldNode);

          }
            this.getBoardFromNode(this.rootNode);
            this.generateStonePositions();
            this.generateLabels();

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
    return Object.values(this.katagoMoveMap)
      .filter(m => m.visits > 10 && m.move && m.move !== 'pass')
      .sort((a, b) => {
        if (b.scoreLead !== a.scoreLead) return b.scoreLead - a.scoreLead;
        return b.visits - a.visits;
      })
      .slice(0, 10);
  },
  bestKatagoMove() {
    return this.topKatagoMoves.length > 0 ? this.topKatagoMoves[0] : null;
  },

  // Use live best move if available, otherwise fall back to last snapshot
  effectiveBestMove() {
    return this.bestKatagoMove || this.lastKatagoSnapshot;
  },

  // KataGo winrate is from the perspective of the player to move.
  // Convert to Black's absolute winrate. Returns null if no data ever received.
  displayWinrate() {
    if (!this.effectiveBestMove) return null;
    // Snapshot stores pre-converted absolute values to avoid perspective flip on navigation
    if (this.effectiveBestMove._absolute) {
      return Math.round(this.effectiveBestMove.blackWinrate * 100);
    }
    const wr = this.effectiveBestMove.winrate;
    const isBlackToMove = !(this.currentNode?.props?.B);
    const blackWr = isBlackToMove ? wr : (1 - wr);
    return Math.round(blackWr * 100);
  },

  // Score lead from Black's perspective (positive = Black ahead)
  scoreLeadText() {
    if (!this.effectiveBestMove) return '';
    let blackLead;
    if (this.effectiveBestMove._absolute) {
      blackLead = this.effectiveBestMove.blackScoreLead;
    } else {
      const lead = this.effectiveBestMove.scoreLead;
      const isBlackToMove = !(this.currentNode?.props?.B);
      blackLead = isBlackToMove ? lead : -lead;
    }
    const prefix = blackLead >= 0 ? 'B' : 'W';
    return `${prefix} +${Math.abs(blackLead).toFixed(1)}`;
  }

},

    methods: {

      // Re-open the message gate after a short delay.
      // Captures the current navGeneration so rapid clicks don't accidentally re-open an old gate.
      _reopenKatagoGate() {
        const gen = this.katagoNavGeneration;
        if (this._gateTimer) clearTimeout(this._gateTimer);
        this._gateTimer = setTimeout(() => {
          // Only open if no newer navigation has happened
          if (this.katagoNavGeneration === gen) {
            this.katagoMoveMap = {};  // wipe anything that snuck in
            this.katagoActiveGeneration = gen;
          }
        }, 150);  // 150ms is enough for the round-trip stop→ack to flush
      },

      clearPattern() {
        this.patternVertices = [];
        this.selectedPatternCells = [];
      },

      katagoCoordToBoardXY(coord) {
        return katagoCoordToBoardXY(coord);
      },

      handleKeyPress(event) {
        if (event.code === 'Space') {
          event.preventDefault(); // prevent page scroll
          if (!this.katagoSocket) return;

          if (this.katagoRunning) {
            this.katagoSocket.send("stop");
          } else {
            let nextColor = 'b';
            if (this.currentNode?.props) {
              if (this.currentNode.props.B) nextColor = 'w';
              else if (this.currentNode.props.W) nextColor = 'b';
            }
            this.katagoSocket.send(`kata-analyze ${nextColor} 10`);
          }
          this.katagoRunning = !this.katagoRunning;
        }
      },

      getPatternTurn() {
        // 1 = black to play, 2 = white to play
        let nextColor = 'b';
        if (this.currentNode?.props?.B) nextColor = 'w';
        else if (this.currentNode?.props?.W) nextColor = 'b';
        return nextColor === 'b' ? 1 : 2;
      },


      connectToKataGo() {
        this.katagoSocket = new WebSocket("ws://localhost:8000/ws/katago/");

        this.katagoSocket.onopen = () => {
          this.katagoSocket.send("clear_board");
          this.katagoSocket.send("time_settings 0 2 1");
        };

        this.katagoSocket.onmessage = (event) => {
          const data = JSON.parse(event.data);
          const line = data.line;

          if (!line.startsWith("info move")) return;
          // Drop stale messages that arrived during navigation (before new position is fully set up)
          if (this.katagoNavGeneration !== this.katagoActiveGeneration) return;

          // Split on "info move", add it back to each part
          const chunks = line.split(/info move\s+/).filter(Boolean);
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

      buildPatternTemplate() {
        if (!this.selectedPatternCells || this.selectedPatternCells.length === 0) return [];

        const xs = this.selectedPatternCells.map(pt => pt.x);
        const ys = this.selectedPatternCells.map(pt => pt.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);

        const width = maxX - minX + 1;
        const height = maxY - minY + 1;

        // Initialize with 3 (wildcard) — cells outside the selection are "don't care"
        const pattern = Array.from({ length: height }, () =>
          Array.from({ length: width }, () => 3)
        );

        for (const { x, y } of this.selectedPatternCells) {
          const color = this.sabakiBoard.get([x, y]); // x col, y row (sabaki: 1=black, -1=white, 0=empty)

          let mapped;
          if (color === 1) {
            mapped = 1;  // black stone
          } else if (color === -1) {
            mapped = 2;  // white stone
          } else {
            mapped = 0;  // empty intersection (even on the board edge — edge cells are still playable!)
          }

          pattern[y - minY][x - minX] = mapped;
        }

        // If the selection touches a board edge, add an extra row/column of -1 (border)
        // beyond that edge. The backend's board has a border ring OUTSIDE the 19×19 grid,
        // so -1 represents "off the board", not "on the edge".
        const lastIdx = this.board_size - 1; // 18 for a 19×19 board

        // Bottom edge → add border row at the bottom
        if (maxY === lastIdx) {
          pattern.push(Array.from({ length: pattern[0].length }, () => -1));
        }
        // Top edge → add border row at the top
        if (minY === 0) {
          pattern.unshift(Array.from({ length: pattern[0].length }, () => -1));
        }
        // Right edge → add border column on the right
        if (maxX === lastIdx) {
          for (const row of pattern) row.push(-1);
        }
        // Left edge → add border column on the left
        if (minX === 0) {
          for (const row of pattern) row.unshift(-1);
        }

        console.log("Generated pattern template:", pattern);
        return pattern;
      },

      // Returns a CSS class for blue/green/orange fixed colors, or null for the gradient range
      getKataMoveColorClass(move) {
        if (!this.bestKatagoMove) return 'katago-move-orange';
        const leadDiff = this.bestKatagoMove.scoreLead - move.scoreLead;
        const winrateDiff = this.bestKatagoMove.winrate - move.winrate;
        if (move.move === this.bestKatagoMove.move) return 'katago-move-blue';
        if (leadDiff <= 0.5 || winrateDiff <= 0.02) return 'katago-move-green';
        if (leadDiff > 5) return 'katago-move-orange';
        return null; // gradient range — handled by inline style
      },

      // Returns inline backgroundColor for the yellow→orange gradient zone (leadDiff 0.5–5)
      // Derived from the dataset: hue 66°→36°, sat 80%→68%, lightness 45%→52%
      getKataMoveStyle(move) {
        if (!this.bestKatagoMove) return {};
        const leadDiff = this.bestKatagoMove.scoreLead - move.scoreLead;
        const winrateDiff = this.bestKatagoMove.winrate - move.winrate;
        if (move.move === this.bestKatagoMove.move) return {};
        if (leadDiff <= 0.5 || winrateDiff <= 0.02) return {};
        if (leadDiff > 5) return {};
        // t goes 0→1 as leadDiff goes 0.5→5
        const t = Math.min(1, Math.max(0, (leadDiff - 0.5) / 4.5));
        const hue = Math.round(66 - 30 * t);          // 66° → 36°
        const sat = Math.round(80 - 12 * t);           // 80% → 68%
        const lit = Math.round(45 + 7 * t);            // 45% → 52%
        return { backgroundColor: `hsla(${hue}, ${sat}%, ${lit}%, 0.9)` };
      },

      // handleMouseDown(event) {
      //   if (this.boardMode !== 'Pattern') return;
      //
      //   const rect = event.currentTarget.getBoundingClientRect(); // Board's position
      //   const x = Math.floor((event.clientX - rect.left + this.cellSize / 2) / this.cellSize);
      //   const y = Math.floor((event.clientY - rect.top + this.cellSize / 2) / this.cellSize);
      //   const coords = {x,y};
      //
      //   if (coords) this.dragStart = coords;
      // },

      // handleMouseUp(event) {
      //   if (this.boardMode !== 'Pattern' || !this.dragStart || !this.dragEnd) return;
      //
      //   const xMin = Math.min(this.dragStart.x, this.dragEnd.x);
      //   const xMax = Math.max(this.dragStart.x, this.dragEnd.x);
      //   const yMin = Math.min(this.dragStart.y, this.dragEnd.y);
      //   const yMax = Math.max(this.dragStart.y, this.dragEnd.y);
      //
      //
      //   this.selectedPatternCells = [];
      //   for (let x = xMin; x <= xMax; x++) {
      //     for (let y = yMin; y <= yMax; y++) {
      //       this.selectedPatternCells.push({ x, y });
      //     }
      //   }
      //     console.log("Mouse up at", x, y);
      //
      //
      //   this.dragStart = null;
      //   this.dragEnd = null;
      // },


      handleMouseMove(event) {
        const rect = event.currentTarget.getBoundingClientRect(); // Board's position
        const x = Math.floor((event.clientX - rect.left + this.cellSize / 2) / this.cellSize);
        const y = Math.floor((event.clientY - rect.top + this.cellSize / 2) / this.cellSize);

        if (this.ghostMode === 'Pattern') {
          const coords = {x,y};
          if (coords) this.dragEnd = coords;
        }


        // Ensure hover stays within the board bounds
        if (x >= 0 && x < this.board_size && y >= 0 && y < this.board_size) {
          // Check if there's an existing stone and ghostMode is 'B' or 'W'
          if (this.ghostMode === 'A' || this.ghostMode === '1') {
            this.hoveredPosition = {x, y};
          } else if ((this.ghostMode === 'B' || this.ghostMode === 'W') && this.sabakiBoard.get([x,y]) === 0) {

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

      isInsidePolygon(p, poly, EPS = 1e-9) {
        let inside = false;

        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const xi = poly[i].x,  yi = poly[i].y;
          const xj = poly[j].x,  yj = poly[j].y;

          // ───────────── 1. Border check ─────────────
          // Cross-product == 0  ➜  p, (xi,yi) and (xj,yj) are colinear
          const cross = (p.x - xi) * (yj - yi) - (p.y - yi) * (xj - xi);
          if (Math.abs(cross) < EPS &&
              p.x >= Math.min(xi, xj) - EPS && p.x <= Math.max(xi, xj) + EPS &&
              p.y >= Math.min(yi, yj) - EPS && p.y <= Math.max(yi, yj) + EPS) {
            return true;                    // p lies exactly on this edge
          }

          // ───────────── 2. Ray-casting toggle ─────────────
          const intersects = ((yi > p.y) !== (yj > p.y)) &&
                             (p.x < (xj - xi) * (p.y - yi) / (yj - yi) + xi);
          if (intersects) inside = !inside;
        }

        return inside;
      },

      updatePatternArea() {
        const inside = [];

        for (let y = 0; y < this.board_size; y++) {
          for (let x = 0; x < this.board_size; x++) {
            if (this.isInsidePolygon({ x, y }, this.patternVertices)) {
              inside.push({ x, y });
            }
          }
        }
        this.selectedPatternCells = inside;

        let array = this.buildPatternTemplate()
        let turn = this.getPatternTurn();
        this.$emit('pattern-updated', {patternTemplate: array, patternTurn: turn});

        console.log("array is:", array);
      },


      handleMouseClick(event) {
        const rect = event.currentTarget.getBoundingClientRect(); // Board's position
        const x = Math.floor((event.clientX - rect.left + this.cellSize / 2) / this.cellSize);
        const y = Math.floor((event.clientY - rect.top + this.cellSize / 2) / this.cellSize);

        if (this.ghostMode === 'Pattern') {
          this.patternVertices.push({ x, y });
          console.log("Added vertex:", x, y);
          console.log("vertices are ", this.patternVertices);

          if (this.patternVertices.length >= 3) {
            this.updatePatternArea(); // See next step
          }
          return;
        }
        // Ensure the click is within board bounds
        if (x >= 0 && x < this.board_size && y >= 0 && y < this.board_size) {
          // Block clicks on existing stones if ghostMode is 'B' or 'W'
          if ((this.ghostMode === 'B' || this.ghostMode === 'W') && this.sabakiBoard.get([x,y]) !== 0) {

            console.log(`Click blocked at (${x}, ${y}) - Stone already exists.`);
            return;
          }

          // Allow the click for other modes or empty positions
          console.log(`Clicked coordinate: (${x}, ${y})`);
          this.$emit('board-clicked', {x, y}); // Emit event with coordinates
          this.hoveredPosition = null; // Clear hover state

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
        // Always stop any running analysis first so in-flight messages don't corrupt the new position
        this.katagoSocket.send("stop");
        // Increment generation so any in-flight messages are dropped in onmessage
        this.katagoNavGeneration++;

        const newMoves = newNode.getMovesToNode(this.rootNode);

        const oldMoves = oldNode.getMovesToNode(this.rootNode);

        let commonPrefixLen = 0;
        while (
            commonPrefixLen < oldMoves.length &&
            commonPrefixLen < newMoves.length &&
            JSON.stringify(oldMoves[commonPrefixLen]) === JSON.stringify(newMoves[commonPrefixLen])
            ) {
          commonPrefixLen++;
        }
        console.log("old moves is ", oldMoves)
        console.log("new moves is ", newMoves)

        console.log("commonPrefixLen is " + commonPrefixLen);

        const undoCount = oldMoves.length - commonPrefixLen;
        const replayMoves = newMoves.slice(commonPrefixLen);

        if (commonPrefixLen === 0) {
          this.katagoSocket.send("clear_board");
          // replay ALL moves for new position
          for (const move of newMoves) {
            if (!move.B && !move.W) continue;
            const color = move.B ? 'b' : 'w';
            const coord = move.B ? move.B : move.W;
            const kataCoord = boardXYToKatagoCoord(parseCoordinates(coord));
            if (coord !== "pass") {
              this.katagoSocket.send(`play ${color} ${kataCoord}`);
            }
          }
          if (this.katagoRunning) {
            const nextColor = this.currentNode.props.B ? 'w' : 'b';
            this.katagoSocket.send(`kata-analyze ${nextColor} 10`);
          }
          // Save absolute (Black-perspective) values using the OLD node's perspective
          // (winrate was computed for the old position, this.currentNode is already the new node)
          if (this.bestKatagoMove) {
            const wasBlackToMove = !(oldNode?.props?.B);
            this.lastKatagoSnapshot = {
              blackWinrate: wasBlackToMove ? this.bestKatagoMove.winrate : (1 - this.bestKatagoMove.winrate),
              blackScoreLead: wasBlackToMove ? this.bestKatagoMove.scoreLead : -this.bestKatagoMove.scoreLead,
              _absolute: true
            };
          }
          this.katagoMoveMap = {};
          // Re-open the message gate after a short delay so in-flight stale messages get dropped
          this._reopenKatagoGate();
          return;
        } else {
          for (let i = 0; i < undoCount; i++) {
            this.katagoSocket.send("undo");
            console.log("sending to katago: undo");
          }
        }


        console.log("replay move is " + JSON.stringify(replayMoves, null, 2));
        // return;
        for (const move of replayMoves) {
          const color = move.B ? 'b' : 'w';
          const coord = move.B ? move.B : move.W;
          console.log("coord is "+ coord)
          console.log("parseCoordinates(coord) is " + parseCoordinates(coord))
          const kataCoord = boardXYToKatagoCoord(parseCoordinates(coord))
          console.log("kata coord is " + kataCoord)
          if (coord !== "pass") {
            this.katagoSocket.send(`play ${color} ${kataCoord}`);

          }
        }

        if (this.katagoRunning) {
          let nextColor = this.currentNode.props.B ? 'w' : 'b'; // default
          this.katagoSocket.send(`kata-analyze ${nextColor} 10`);
        }
        // Save absolute (Black-perspective) values using the OLD node's perspective
        if (this.bestKatagoMove) {
          const wasBlackToMove = !(oldNode?.props?.B);
          this.lastKatagoSnapshot = {
            blackWinrate: wasBlackToMove ? this.bestKatagoMove.winrate : (1 - this.bestKatagoMove.winrate),
            blackScoreLead: wasBlackToMove ? this.bestKatagoMove.scoreLead : -this.bestKatagoMove.scoreLead,
            _absolute: true
          };
        }
        this.katagoMoveMap = {};
        // Re-open the message gate after a short delay so in-flight stale messages get dropped
        this._reopenKatagoGate();

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
            const stone = this.sabakiBoard.get([col,row]); // -1 for white, 1 for black, 0 for empty

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
            const stone = this.sabakiBoard.get([col, row]);

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

<style scoped>
.board-outer-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

/* ── Winrate bar ── */
.winrate-bar-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 720px;
  margin-bottom: 6px;
  padding: 0 4px;
}

.winrate-bar {
  flex: 1;
  display: flex;
  height: 18px;
  border-radius: 9px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0,0,0,0.25);
}

.winrate-fill-black {
  background: #1a1a1a;
  transition: width 0.4s ease;
  height: 100%;
}

.winrate-fill-white {
  background: #e8e8e8;
  transition: width 0.4s ease;
  height: 100%;
}

.winrate-label {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  min-width: 52px;
}

.winrate-black {
  color: #222;
  text-align: right;
}

.winrate-white {
  color: #555;
  text-align: left;
}

.score-lead-label {
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  color: #444;
  min-width: 52px;
}
</style>
