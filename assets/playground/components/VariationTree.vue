<template>
  <svg :width="svgWidth" :height="svgHeight" class="variation-tree-svg">
    <!-- Draw connectors (links) -->
    <g>
      <line
        v-for="link in links"
        :key="link.id"
        :x1="link.source.x"
        :y1="link.source.y"
        :x2="link.target.x"
        :y2="link.target.y"
        stroke="#000"
      />
    </g>
    <!-- Draw nodes -->
    <g>
      <circle
        v-for="node in nodes"
        :key="node.id"
        :cx="node.x"
        :cy="node.y"
        :r="15"
        :fill="getNodeFill(node)"
        :stroke="node.data === currentNode ? 'red' : '#ccc'"
        stroke-width="2"
        @click="goToNode(node.data)"
        class="tree-node"
      />
      <!-- Move labels -->
      <text
        v-for="node in nodes"
        :key="'label-' + node.id"
        :x="node.x"
        :y="node.y + 5"
        text-anchor="middle"
        font-size="12"
        fill="#000"
        @click="goToNode(node.data)"
        class="node-label"
        style="cursor: pointer;"
      >
        {{ getMoveLabel(node.data) }}
      </text>
    </g>
  </svg>
</template>


<script>
import * as d3 from 'd3';

export default {
  name: 'VariationTree',
  props: {
    rootNode: Object,
    currentNode: Object
  },
  data() {
    return {
      nodes: [],
      links: [],
      svgWidth: 800, // Adjust the width as needed
      svgHeight: 600 // Adjust the height as needed
    };
  },
  watch: {
    rootNode: {
      handler() {
        this.computeTreeLayout();
      },
      deep: true,
      immediate: true
    },
    currentNode() {
      this.highlightCurrentNode();
    }
  },
  methods: {
    computeTreeLayout() {
      // Convert your rootNode into a hierarchy
      const root = d3.hierarchy(this.rootNode, d => d.children);

      // Compute the layout
      const treeLayout = d3.tree().size([this.svgWidth - 100, this.svgHeight - 100]);
      treeLayout(root);

      // Extract nodes and links
      this.nodes = root.descendants().map(d => ({
        id: d.data.id || d.data._id || d.data.props.MN || Math.random(),
        x: d.x + 50, // Adjust for margins
        y: d.y + 50,
        data: d.data
      }));

      this.links = root.links().map(link => ({
        id: `${link.source.data.id || link.source.data._id}-${link.target.data.id || link.target.data._id}`,
        source: {
          x: link.source.x + 50,
          y: link.source.y + 50
        },
        target: {
          x: link.target.x + 50,
          y: link.target.y + 50
        }
      }));
    },
    goToNode(node) {
      this.$emit('select-node', node);
    },
    getMoveLabel(nodeData) {
      return nodeData.props.B || nodeData.props.W || '●';
    },
    getNodeFill(node) {
      if (node.data === this.currentNode) {
        return '#ffe4b5'; // Highlight color for current node
      }
      return '#f5deb3'; // Default node color
    },
    highlightCurrentNode() {
      // Optionally implement logic to update node styles
    }
  }
};
</script>


<style scoped>
.variation-tree-svg {
  border: 1px solid #ddd;
}

.tree-node {
  cursor: pointer;
}

.node-label {
  pointer-events: none; /* Allows clicks to pass through to the circle */
}
</style>

