import { createApp } from 'vue';
import GoBoardController from './components/GoBoardController.vue'; // Adjust path as needed

createApp(GoBoardController).mount('#app');


// import { createApp } from 'vue';
// import GoBoardController from '../components/GoBoardController.vue';
// import GoProblemInterface from '../components/ProblemView.vue';
//
// // Mount the appropriate Vue component based on the page
// if (document.getElementById('controller-app')) {
//     console.log("in controller")
//     createApp(GoBoardController).mount('#controller-app');
// } else if (document.getElementById('problem-app')) {
//     console.log("in problem")
//
//     createApp(GoProblemInterface).mount('#problem-app');
// }
