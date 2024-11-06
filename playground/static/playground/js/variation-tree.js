// variation-tree.js
import * as d3 from 'd3';

Vue.component('variation-tree', {
    template: `
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
    `,
    props: {
        rootNode: Object,
        currentNode: Object
    },
    data: function() {
        return {
            nodes: [],
            links: [],
            svgWidth: 800, // Adjust the width as needed
            svgHeight: 600 // Adjust the height as needed
        };
    },
    watch: {
        rootNode: {
            handler: function() {
                this.computeTreeLayout();
            },
            deep: true,
            immediate: true
        },
        currentNode: function() {
            this.highlightCurrentNode();
        }
    },
    methods: {
computeTreeLayout() {
  // Convert your rootNode into a hierarchy
  const root = d3.hierarchy(this.rootNode, d => d.children);

  // Compute the layout
  const treeLayout = d3.tree().nodeSize([50, 100]); // Adjust nodeSize as needed
  treeLayout(root);

  // Custom positioning to align the mainline horizontally
  this.adjustNodePositions(root);

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

  // Update SVG dimensions based on the computed layout
  this.svgWidth = this.computeSvgWidth(root);
  this.svgHeight = this.computeSvgHeight(root);
},

adjustNodePositions(node, moveNumber = 0, variationDepth = 0) {
  const horizontalSpacing = 100; // Adjust horizontal spacing as needed
  const verticalSpacing = 100;   // Adjust vertical spacing as needed

  // Set the x position based on move number (depth in the tree)
  node.x = moveNumber * horizontalSpacing;

  // Set the y position based on variation depth (number of branches away from mainline)
  node.y = variationDepth * verticalSpacing;

  if (node.children && node.children.length > 0) {
    node.children.forEach((child, index) => {
      if (index === 0) {
        // First child continues with the same variation depth
        this.adjustNodePositions(child, moveNumber + 1, variationDepth);
      } else {
        // Additional children (branches) increase the variation depth
        this.adjustNodePositions(child, moveNumber + 1, variationDepth + 1);
      }
    });
  }
},

adjustSubtree(node, xOffset, yOffset) {
  // Recursively adjust positions of nodes in the subtree
  node.x = xOffset;
  node.y = yOffset;

  if (node.children) {
    node.children.forEach((child, index) => {
      const newXOffset = xOffset + 100; // Adjust horizontal spacing
      const newYOffset = yOffset + index * 100; // Adjust vertical spacing
      this.adjustSubtree(child, newXOffset, newYOffset);
    });
  }
},


        computeSvgWidth(root) {
  const maxX = d3.max(root.descendants(), d => d.x);
  return maxX + 150; // Add margin
},

computeSvgHeight(root) {
  const maxY = d3.max(root.descendants(), d => d.y);
  return maxY + 150; // Add margin
},


        goToNode: function(node) {
            this.$emit('select-node', node);
        },
        getMoveLabel: function(nodeData) {
            return nodeData.props.B || nodeData.props.W || '●';
        },
        getNodeFill: function(node) {
            if (node.data === this.currentNode) {
                return '#ffe4b5'; // Highlight color for current node
            }
            return '#f5deb3'; // Default node color
        },
        highlightCurrentNode: function() {
            // Optionally implement logic to update node styles
        }
    }
});
