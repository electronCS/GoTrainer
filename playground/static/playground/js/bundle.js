(()=>{var t={915:t=>{const e="ABCDEFGHJKLMNOPQRSTUVWXYZ";function r([t,e],[r,i]){return t===r&&e===i}class i{constructor(t=[]){if(this.signMap=t,this.height=t.length,this.width=0===this.height?0:t[0].length,t.some((t=>t.length!==this.width)))throw new Error("signMap is not well-formed");this._players=[1,-1],this._captures=[0,0],this._koInfo={sign:0,vertex:[-1,-1]}}get([t,e]){return null!=this.signMap[e]?this.signMap[e][t]:null}set([t,e],r){return this.has([t,e])&&(this.signMap[e][t]=r),this}has([t,e]){return 0<=t&&t<this.width&&0<=e&&e<this.height}clear(){return this.signMap=this.signMap.map((t=>t.map((t=>0)))),this}makeMove(t,e,{preventSuicide:i=!1,preventOverwrite:n=!1,preventKo:o=!1}={}){let s=this.clone();if(0===t||!this.has(e))return s;if(n&&this.get(e))throw new Error("Overwrite prevented");if(t=t>0?1:-1,o&&this._koInfo.sign===t&&r(this._koInfo.vertex,e))throw new Error("Ko prevented");s.set(e,t);let h=s.getNeighbors(e),a=[],u=h.filter((e=>s.get(e)===-t&&!s.hasLiberties(e)));for(let e of u)if(0!==s.get(e))for(let r of s.getChain(e))s.set(r,0).setCaptures(t,(t=>t+1)),a.push(r);let l=s.getLiberties(e),c=1===a.length&&1===l.length&&r(l[0],a[0])&&h.every((e=>s.get(e)!==t));if(s._koInfo={sign:c?-t:0,vertex:c?a[0]:[-1,-1]},0===a.length&&0===l.length){if(i)throw new Error("Suicide prevented");for(let r of s.getChain(e))s.set(r,0).setCaptures(-t,(t=>t+1))}return s}analyzeMove(t,e){let i=0===t||!this.has(e),n=!i&&!!this.get(e),o=this._koInfo.sign===t&&r(this._koInfo.vertex,e),s=this.get(e);this.set(e,t);let h=!i&&this.getNeighbors(e).some((e=>this.get(e)===-t&&!this.hasLiberties(e))),a=!i&&!h&&!this.hasLiberties(e);return this.set(e,s),{pass:i,overwrite:n,capturing:h,suicide:a,ko:o}}getCaptures(t){let e=this._players.indexOf(t);return e<0?null:this._captures[e]}setCaptures(t,e){let r=this._players.indexOf(t);return r>=0&&(this._captures[r]="function"==typeof e?e(this._captures[r]):e),this}isSquare(){return this.width===this.height}isEmpty(){return this.signMap.every((t=>t.every((t=>!t))))}isValid(){let t={};for(let e=0;e<this.width;e++)for(let r=0;r<this.height;r++){let i=[e,r];if(0!==this.get(i)&&!(i in t)){if(!this.hasLiberties(i))return!1;this.getChain(i).forEach((e=>t[e]=!0))}}return!0}getDistance([t,e],[r,i]){return Math.abs(r-t)+Math.abs(i-e)}getNeighbors(t){if(!this.has(t))return[];let[e,r]=t;return[[e-1,r],[e+1,r],[e,r-1],[e,r+1]].filter((t=>this.has(t)))}getConnectedComponent(t,e,i=null){if(!this.has(t))return[];i||(i=[t]);for(let n of this.getNeighbors(t))e(n)&&(i.some((t=>r(t,n)))||(i.push(n),this.getConnectedComponent(n,e,i)));return i}getChain(t){let e=this.get(t);return this.getConnectedComponent(t,(t=>this.get(t)===e))}getRelatedChains(t){if(!this.has(t)||0===this.get(t))return[];let e=[this.get(t),0];return this.getConnectedComponent(t,(t=>e.includes(this.get(t)))).filter((e=>this.get(e)===this.get(t)))}getLiberties(t){if(!this.has(t)||0===this.get(t))return[];let e=this.getChain(t),r=[],i={};for(let t of e){let e=this.getNeighbors(t).filter((t=>0===this.get(t)));r.push(...e.filter((t=>!(t in i)))),e.forEach((t=>i[t]=!0))}return r}hasLiberties(t,e={}){let r=this.get(t);if(!this.has(t)||0===r)return!1;if(t in e)return!1;let i=this.getNeighbors(t);return!!i.some((t=>0===this.get(t)))||(e[t]=!0,i.filter((t=>this.get(t)===r)).some((t=>this.hasLiberties(t,e))))}clone(){let t=new i(this.signMap.map((t=>[...t]))).setCaptures(1,this.getCaptures(1)).setCaptures(-1,this.getCaptures(-1));return t._koInfo=this._koInfo,t}diff(t){if(t.width!==this.width||t.height!==this.height)return null;let e=[];for(let r=0;r<this.width;r++)for(let i=0;i<this.height;i++){let n=t.get([r,i]);this.get([r,i])!==n&&e.push([r,i])}return e}stringifyVertex(t){return this.has(t)?e[t[0]]+(this.height-t[1]):""}parseVertex(t){if(t.length<2)return[-1,-1];let r=[e.indexOf(t[0].toUpperCase()),this.height-+t.slice(1)];return this.has(r)?r:[-1,-1]}getHandicapPlacement(t,{tygem:e=!1}={}){if(Math.min(this.width,this.height)<=6||t<2)return[];let[r,i]=[this.width,this.height].map((t=>t>=13?3:2)),[n,o]=[this.width-r-1,this.height-i-1],[s,h]=[this.width,this.height].map((t=>(t-1)/2)),a=e?[[r,o],[n,i],[r,i],[n,o]]:[[r,o],[n,i],[n,o],[r,i]];return this.width%2!=0&&this.height%2!=0&&7!==this.width&&7!==this.height?(5===t&&a.push([s,h]),a.push([r,h],[n,h]),7===t&&a.push([s,h]),a.push([s,i],[s,o],[s,h])):this.width%2!=0&&7!==this.width?a.push([s,i],[s,o]):this.height%2!=0&&7!==this.height&&a.push([r,h],[n,h]),a.slice(0,t)}}i.fromDimensions=(t,e=null)=>{null==e&&(e=t);let r=[...Array(e)].map((e=>Array(t).fill(0)));return new i(r)},t.exports=i},772:(t,e,r)=>{const i=r(915);t.exports=i}},e={};function r(i){var n=e[i];if(void 0!==n)return n.exports;var o=e[i]={exports:{}};return t[i](o,o.exports,r),o.exports}r.n=t=>{var e=t&&t.__esModule?()=>t.default:()=>t;return r.d(e,{a:e}),e},r.d=(t,e)=>{for(var i in e)r.o(e,i)&&!r.o(t,i)&&Object.defineProperty(t,i,{enumerable:!0,get:e[i]})},r.o=(t,e)=>Object.prototype.hasOwnProperty.call(t,e),(()=>{"use strict";function t(e){return t="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(t){return typeof t}:function(t){return t&&"function"==typeof Symbol&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},t(e)}function e(t,e){for(var r=0;r<e.length;r++){var n=e[r];n.enumerable=n.enumerable||!1,n.configurable=!0,"value"in n&&(n.writable=!0),Object.defineProperty(t,i(n.key),n)}}function i(e){var r=function(e){if("object"!=t(e)||!e)return e;var r=e[Symbol.toPrimitive];if(void 0!==r){var i=r.call(e,"string");if("object"!=t(i))return i;throw new TypeError("@@toPrimitive must return a primitive value.")}return String(e)}(e);return"symbol"==t(r)?r:r+""}var n=function(){return t=function t(e){var r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:null;!function(t,e){if(!(t instanceof e))throw new TypeError("Cannot call a class as a function")}(this,t),this.props=e,this.parent=r,this.children=[]},(r=[{key:"addChild",value:function(t){t.parent=this,this.children.push(t)}},{key:"print",value:function(){return"Node props: ".concat(JSON.stringify(this.props),", Children count: ").concat(this.children.length,", Parent props: ").concat(this.parent?JSON.stringify(this.parent.props):"null")}}])&&e(t.prototype,r),Object.defineProperty(t,"prototype",{writable:!1}),t;var t,r}(),o=r(772),s=r.n(o);function h(t,e){return function(t){if(Array.isArray(t))return t}(t)||function(t,e){var r=null==t?null:"undefined"!=typeof Symbol&&t[Symbol.iterator]||t["@@iterator"];if(null!=r){var i,n,o,s,h=[],a=!0,u=!1;try{if(o=(r=r.call(t)).next,0===e){if(Object(r)!==r)return;a=!1}else for(;!(a=(i=o.call(r)).done)&&(h.push(i.value),h.length!==e);a=!0);}catch(t){u=!0,n=t}finally{try{if(!a&&null!=r.return&&(s=r.return(),Object(s)!==s))return}finally{if(u)throw n}}return h}}(t,e)||function(t,e){if(t){if("string"==typeof t)return a(t,e);var r={}.toString.call(t).slice(8,-1);return"Object"===r&&t.constructor&&(r=t.constructor.name),"Map"===r||"Set"===r?Array.from(t):"Arguments"===r||/^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r)?a(t,e):void 0}}(t,e)||function(){throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.")}()}function a(t,e){(null==e||e>t.length)&&(e=t.length);for(var r=0,i=Array(e);r<e;r++)i[r]=t[r];return i}Vue.component("go-board-controller",{template:'\n        <div class="board-controller">\n            \x3c!-- Controls --\x3e\n            <div class="controls">\n                <button @click="previousMove">Previous Move</button>\n                <button @click="nextMove">Next Move</button>\n\x3c!--                <button @click="resetBoard">Reset</button>--\x3e\n            </div>\n\n            \x3c!-- Go Board Component --\x3e\n            <go-board\n                :initial-board-state="currentBoardState"\n                :translate-x="translateX"\n                :translate-y="translateY"\n                :scale="scale">\n            </go-board>\n\n            \x3c!-- Variation Tree (Optional) --\x3e\n            <div class="variation-tree">\n                \x3c!-- Render variations here --\x3e\n            </div>\n        </div>\n    ',data:function(){return{sgfData:null,board:new(s())(19),currentBoardState:[],currentNode:null,rootNode:null,translateX:0,translateY:0,scale:1}},mounted:function(){window.sgfString&&this.loadSgf(window.sgfString)},methods:{loadSgf:function(t){console.log("about to parse sgf which is "+t),this.sgfData=SGF.parse(t),console.log("sgf data is "+JSON.stringify(this.sgfData)),this.rootNode=this.convertSgfToNode(this.sgfData),this.currentNode=this.rootNode,this.updateBoardState()},convertSgfToNode:function(t){var e=this,r=arguments.length>1&&void 0!==arguments[1]?arguments[1]:null,i=new n(t.props,r);return t.childs&&t.childs.forEach((function(t){var r=e.convertSgfToNode(t,i);i.addChild(r)})),i},nextMove:function(){this.currentNode&&this.currentNode.children.length>0&&(this.currentNode=this.currentNode.children[0],console.log("Moved to next node:",this.currentNode.print()),this.updateBoardState())},previousMove:function(){this.currentNode&&this.currentNode.parent&&(this.currentNode=this.currentNode.parent,console.log("Moved to previous node:",this.currentNode.print()),this.updateBoardState())},updateBoardState:function(){this.board=new(s())(19),console.log("new change picked up??");for(var t=this.rootNode;t&&t!==this.currentNode;){if(t.props){if(t.props.B){var e=h(this.parseCoordinates(t.props.B),2),r=e[0],i=e[1];this.board.play(r,i,"B")}if(t.props.W){var n=h(this.parseCoordinates(t.props.W),2),o=n[0],a=n[1];this.board.play(o,a,"W")}}t=t.children[0]}this.currentBoardState=this.board.getBoard()},getMovesToCurrentNode:function(){for(var t=[],e=this.currentNode;e&&e!==this.rootNode;)e.props&&t.unshift(e.props),e=e.parent;return t},convertMovesToBoardState:function(t){var e=this,r=Array.from({length:19},(function(){return Array(19).fill(null)}));return t.forEach((function(t){if(t.B){var i=h(e.parseCoordinates(t.B),2),n=i[0],o=i[1];r[o][n]="B"}if(t.W){var s=h(e.parseCoordinates(t.W),2),a=s[0],u=s[1];r[u][a]="W"}})),r},parseCoordinates:function(t){return[t.charCodeAt(0)-"a".charCodeAt(0),t.charCodeAt(1)-"a".charCodeAt(0)]}}})})()})();