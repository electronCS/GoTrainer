<template>
    <div class="board-container"
       @mousemove="handleMouseMove"
       @mouseleave="handleMouseLeave"
       @click="handleMouseClick">

<!--                         :style="{ transform: \`translate(\${translateX}px, \${translateY}px) scale(\${scale})\` }"-->

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
                  left: stone.left + 'px'
              }">
          </div>

          <div v-if="hoveredPosition"
               :class="['ghost-stone', 'ghost-stone-' + ghostMode]"
               :style="{
                   left: hoveredPosition.x * cellSize + 'px',
                   top: hoveredPosition.y * cellSize + 'px',
                   // backgroundColor: ghostMode === 'B' ? 'black' : 'white',
                   // borderColor: ghostMode === 'W' ? 'black' : 'transparent'
               }"></div>

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
import {parseCoordinates} from "../js/utils";

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

            letters: ['A','B','C','D','E','F','G','H','J','K','L','M','N','O','P','Q','R','S','T'],
            numbers: Array.from({length: 19}, (_, i) => 19 - i),
            cellSize: 30,
            hoveredPosition: null // Track the hovered position

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
        }

    },
    mounted() {

        // this.updateCellSize();

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
        initialBoardState: {
            handler(newVal, oldVal) {
                this.generateStonePositions();
            },
            deep: true
        },
        currentNode: {
            handler(newVal, oldVal) {
                this.generateLabels();
            },
            deep: true
        }

    },

    methods: {
    handleMouseMove(event) {
        const rect = event.currentTarget.getBoundingClientRect(); // Board's position
        const x = Math.floor((event.clientX - rect.left) / this.cellSize) - 1;
        const y = Math.floor((event.clientY - rect.top) / this.cellSize) - 1;

        // Ensure hover stays within the board bounds
        if (x >= 0 && x < this.board_size && y >= 0 && y < this.board_size) {
            // Check if there's an existing stone and ghostMode is 'B' or 'W'
            if ((this.ghostMode === 'B' || this.ghostMode === 'W') && this.initialBoardState[y][x] !== 0) {
                this.hoveredPosition = null; // Do not display ghost stone
            } else {
                this.hoveredPosition = { x, y }; // Set hovered position
            }
        } else {
            this.hoveredPosition = null; // Reset if outside bounds
        }
    },
    handleMouseLeave() {
        this.hoveredPosition = null; // Clear hover state
    },
    handleMouseClick(event) {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = Math.floor((event.clientX - rect.left) / this.cellSize) - 1;
        const y = Math.floor((event.clientY - rect.top) / this.cellSize) - 1;

        // Ensure the click is within board bounds
        if (x >= 0 && x < this.board_size && y >= 0 && y < this.board_size) {
            // Block clicks on existing stones if ghostMode is 'B' or 'W'
            if ((this.ghostMode === 'B' || this.ghostMode === 'W') && this.initialBoardState[y][x] !== 0) {
                console.log(`Click blocked at (${x}, ${y}) - Stone already exists.`);
                return;
            }

            // Allow the click for other modes or empty positions
            console.log(`Clicked coordinate: (${x}, ${y})`);
            this.$emit('board-clicked', { x, y }); // Emit event with coordinates
            this.hoveredPosition = null; // Clear hover state

        }
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
        generateStonePositions() {
            console.log("Initial Board State:", this.initialBoardState);

            this.stonePositions = [];
            for (let row = 0; row < this.board_size; row++) {
                for (let col = 0; col < this.board_size; col++) {
                    let stone = this.initialBoardState[row][col];
                    if (stone !== 0) { // Only add stones that are not empty
                        let color = stone === 1 ? 'black' : 'white'; // Map 1 to 'black', -1 to 'white'
                        this.stonePositions.push({
                            color: color,
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

            // Extract the comment (if exists)
            if (props.C) {
                labels.push({
                    text: props.C, // Add the comment as a label
                    row: this.board_size, // You can position it at the bottom or any preferred row
                    col: Math.floor(this.board_size / 2), // Center it horizontally or set as needed
                    color: 'black' // Default to black for comments
                });
            }

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