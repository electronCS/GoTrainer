Vue.component('variation-tree-node', {
    template: `
      <g>
        <rect
          v-if="isCurrent"
          :x="x - 20"
          :y="y - 20"
          width="40"
          height="40"
          rx="5"
          ry="5"
          class="current-node-background"
        />

        <circle
          :cx="x"
          :cy="y"
          :r="15"
          class="node-background"
        />
        <circle
          :cx="x"
          :cy="y"
          :r="15"
          @click="onClick"
          :class="['tree-node', nodeType, branchStatus, currentStatus]"
        />
        <text
          :x="x"
          :y="y + 5"
          text-anchor="middle"
          font-size="12"
          @click="onClick"
          :class="['node-label', branchStatus, textClass]"
          style="cursor: pointer;"
        >
          {{ moveLabel }}
        </text>
      </g>
    `,
    props: {
        x: { type: Number, required: true }, // X-coordinate of the node
        y: { type: Number, required: true }, // Y-coordinate of the node
        node: { type: Object, required: true }, // The node data object
        isCurrent: { type: Boolean, default: false }, // Whether this is the current node
        isActiveBranch: { type: Boolean, default: false } // Whether this node is in the active branch
    },
    data() {
        return {
            // No local state needed; all data comes from props or computed properties
        };
    },
    computed: {
        nodeType() {
            // Determine the type of node based on the move (Black or White)
            if (this.node.props.B) return 'black-move';
            if (this.node.props.W) return 'white-move';
            return 'neutral-move';
        },
        branchStatus() {
            // Add a class if this node is part of the active branch
            return this.isActiveBranch ? 'active-branch' : '';
        },
        currentStatus() {
            // Add a class if this node is the current node
            return this.isCurrent ? 'current-node' : '';
        },
        moveLabel() {
            return this.node.moveNumber || '●';
        },
        textClass() {
            if (this.node.props.B) return 'black-text';
            if (this.node.props.W) return 'white-text';
            return '';
        }

    },
    methods: {
        onClick() {
            // Emit an event to notify the parent component that this node was clicked
            this.$emit('select-node', this.node);
            console.log("property of node that was clicked is " + JSON.stringify(this.node.props, null, 2));
        }
    }
});
