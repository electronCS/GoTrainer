<template>
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
      :r="16"
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
</template>

<script>
export default {
  name: 'VariationTreeNode',
  props: {
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    node: { type: Object, required: true },
    isCurrent: { type: Boolean, default: false },
    isActiveBranch: { type: Boolean, default: false }
  },
  computed: {
    nodeType() {
      if (this.node.props.B) return 'black-move';
      if (this.node.props.W) return 'white-move';
      return 'neutral-move';
    },
    branchStatus() {
      return this.isActiveBranch ? 'active-branch' : '';
    },
    currentStatus() {
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
      this.$emit('select-node', this.node);
      console.log(
        "Property of node that was clicked is " +
          JSON.stringify(this.node.props, null, 2)
      );
    }
  },
  mounted() {
  // console.log('Node mounted:', this.node, this.x, this.y, this.isCurrent, this.isActiveBranch);
}

};
</script>

<style>

.tree-node {
  stroke-width: 2px;
  stroke: #ccc;
  cursor: pointer;
  opacity : 0.5; /* Makes only the fill semi-transparent */

}

.node-background {
  fill: #fff; /* Default opaque background */
  stroke: none; /* No border for the background */
}

.tree-node.active-branch {
  /*fill: #90ee90;*/
  /*stroke: #228b22;*/
  opacity: 1; /* Default transparency */

}

.current-node-background {
  fill: #add8e6; /* Light blue background */
  stroke: none;
}


.tree-node.current-node {
  /*stroke: #ff4500;*/
  stroke-width: 3px;
}


.tree-node.black-move {
      fill: #000;
  /*fill: #4d4d4d; !* Less black (dark gray) *!*/

  /*fill: rgba(0, 0, 0, 0.5); !* Semi-transparent black *!*/
  stroke: #555;
}

.tree-node.white-move {
      fill: #fff;
  /*fill: #e6e6e6; !* Less white (light gray) *!*/

  /*fill: rgba(255, 255, 255, 0.8); !* Semi-transparent white *!*/
  stroke: #aaa;
}

.tree-node.neutral-move {
      fill: #90EE90;
        /*fill: blue;*/

  /*fill: #4d4d4d; !* Less black (dark gray) *!*/

  /*fill: rgba(0, 0, 0, 0.5); !* Semi-transparent black *!*/
  stroke: #555;
}


.node-label {
  font-size: 12px;
  text-anchor: middle;
  /*fill: #000;*/
  cursor: pointer;
}

.node-label.black-text {
  opacity: 0.9;
  fill: #fff; /* White text for Black nodes */
}

.node-label.white-text {
  opacity: 0.5;

  fill: #000; /* Black text for White nodes */
}

.node-label.black-text.active-branch {
  opacity: 1;
  fill: #fff; /* White text for Black nodes */
}
.node-label.white-text.active-branch {
  opacity: 1;
  fill: #000; /* Black text for White nodes */
}

</style>
