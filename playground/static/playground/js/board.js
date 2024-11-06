/** @typedef {import('vue/types/vue').default} Vue */
import { parseCoordinates } from './utils.js';

const appElement = document.getElementById('app');
const boardSize = parseInt(appElement.getAttribute('data-board-size'));
// const finalBoardState = JSON.parse(document.getElementById('final-board-state').textContent);

Vue.component('go-board',{
    template: `        <!-- Board Container with Grid Layout -->
        <div class="board-container"
             :style="{
                 transform: \`translate(\${translateX}px, \${translateY}px) scale(\${scale})\`
             }">

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
                     width: (board_size - 1) * 30 + 'px',
                     height: (board_size - 1) * 30 + 'px',
                 }">
                <!-- Grid Lines -->
                <div
                    v-for="i in board_size"
                    :key="'h' + i"
                    class="grid-line"
                    :style="{
                        top: (i - 1) * 30 + 'px',
                        left: '0',
                        width: (board_size - 1) * 30 + 'px',
                        height: '1px'
                    }">
                </div>
                <div
                    v-for="j in board_size"
                    :key="'v' + j"
                    class="grid-line"
                    :style="{
                        left: (j - 1) * 30 + 'px',
                        top: '0',
                        width: '1px',
                        height: (board_size - 1) * 30 + 'px'
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
              
                <!-- Star Points -->
                <div
                    v-for="(point, index) in starPoints"
                    :key="'star' + index"
                    class="star-point"
                    :style="{
                        top:  point[1] * 30 + 'px',
                        left: point[0] * 30 + 'px'
                    }">
                </div>
                
                <!-- Labels -->
                <div
                    v-for="(label, index) in labels"
                    :key="'label-' + index"
                    :class="['label2', { circle: label.isCircle }]"
                    :style="{
                        top: label.row  * 30 + 'px',
                        left: label.col * 30 + 'px',
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
        
        
        </div>`,
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
            numbers: Array.from({length: 19}, (_, i) => 19 - i)
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
        }

    },
    mounted() {
        console.log("the initialBoardState upon mount is " + this.initialBoardState);
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

    // computed: {
    //     stonePositions() {
    //         console.log("recomputing stone positions")
    //         const positions = [];
    //         for (let row = 0; row < this.board_size; row++) {
    //             for (let col = 0; col < this.board_size; col++) {
    //                 let stone = this.initialBoardState[row][col];
    //                 if (stone) {
    //                     positions.push({
    //                         color: stone.toLowerCase(),  // 'b' or 'w'
    //                         top: (this.board_size - row - 1) * 30,  // Invert row
    //                         left: col * 30
    //                     });
    //                 }
    //             }
    //         }
    //         return positions;
    //     }
    // },

    methods: {
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
                            // top: (this.board_size - row - 1) * 30, // Invert row
                            top: row * 30,
                            left: col * 30
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
        },


         zoomIn() {
            this.scale += 0.1;
        },
        zoomOut() {
            if (this.scale > 0.2) this.scale -= 0.1;
        },
        moveBoard(dx, dy) {
            this.translateX += dx;
            this.translateY += dy;
        }
    }

})

