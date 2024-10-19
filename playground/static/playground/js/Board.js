/** @typedef {import('vue/types/vue').default} Vue */

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
              <div
                v-for="(point, index) in starPoints"
                :key="'star' + index"
                class="star-point"
                :style="{
                    top: (board_size - point[1] - 1) * 30 + 'px',
                    left: (point[0]) * 30 + 'px'
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
        
        
        </div>`,
    data() {
        return {
            board_size: 19,
            stonePositions: [],
            // currentBoardState: [], // Must be initialized here
            starPoints: [
                [3, 3], [3, 9], [3, 15],
                [9, 3], [9, 9], [9, 15],
                [15, 3], [15, 9], [15, 15]
            ],

            letters: ['A','B','C','D','E','F','G','H','J','K','L','M','N','O','P','Q','R','S','T'],
            numbers: Array.from({length: 19}, (_, i) => i + 1)
        };
    },
    props: {
        initialBoardState: {
            type: Array,
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
        console.log("go board is mounted");
        console.log("the initialBoardState is " + this.initialBoardState);
        // this.initialBoardState = JSON.parse(this.initialBoardState);
        // this.initialBoardState = window.finalBoardState;
        // console.log("final board state in board is " + window.finalBoardState);
        // this.generateStonePositions();
    },
    watch: {
        initialBoardState: {
            handler(newVal, oldVal) {
                console.log('initialBoardState changed in child component:', newVal);
                this.generateStonePositions();

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
            this.stonePositions = [];
            for (let row = 0; row < this.board_size; row++) {
                for (let col = 0; col < this.board_size; col++) {
                    let stone = this.initialBoardState[row][col];
                    if (stone !== 0) { // Only add stones that are not empty
                        let color = stone === 1 ? 'black' : 'white'; // Map 1 to 'black', -1 to 'white'
                        this.stonePositions.push({
                            color: color,
                            top: (this.board_size - row - 1) * 30, // Invert row
                            left: col * 30
                        });
                    }
                }
            }
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

