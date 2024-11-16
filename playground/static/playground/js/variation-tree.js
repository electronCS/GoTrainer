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
  data() {
    return {
      nodes: [],
      links: [],
      horizontalSpacing: 40, // Adjust as needed
      verticalSpacing: 40,   // Adjust as needed
      margin: {
        top: 20,
        right: 20,
        bottom: 20,
        left: 20
      },
      svgWidth: 800, // Initial SVG width; will be updated dynamically
      svgHeight: 600 // Initial SVG height; will be updated dynamically
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

          // Initialize map to keep track of smallest x occupied at each y-level
      this.yMap = new Map();

      // Assign positions to nodes based on the grid algorithm
      // this.assignPositions(root, 0, 0);
  let currentNode = this.getRightmostNode(root);

  // Loop backward from the rightmost node to the root
  while (currentNode) {
    // Start assigning positions from the current node
    this.assignPositions(currentNode, currentNode.depth, 0, false);

    // Move to the parent node to continue the backward traversal
    currentNode = currentNode.parent;
  }


      // Extract nodes and links
      this.nodes = root.descendants().map(d => ({
        id: d.data.id || d.data._id || d.data.props.MN || Math.random(),
        x: d.x * this.horizontalSpacing + this.margin.left,
        y: d.y * this.verticalSpacing + this.margin.top,
        data: d.data
      }));

        this.links = this.createLinks(root.links());

      // Update SVG dimensions based on the computed layout
      this.svgWidth = (d3.max(this.nodes, d => d.x) || 0) + this.margin.right;
      this.svgHeight = (d3.max(this.nodes, d => d.y) || 0) + this.margin.bottom;
    },

    createLinks(links) {
  const adjustedLinks = [];

  links.forEach(link => {
    const source = {
      x: link.source.x * this.horizontalSpacing + this.margin.left,
      y: link.source.y * this.verticalSpacing + this.margin.top
    };
    const target = {
      x: link.target.x * this.horizontalSpacing + this.margin.left,
      y: link.target.y * this.verticalSpacing + this.margin.top
    };

    console.log ("linking " + link.target.y + " to " + link.source.y);

    // If the vertical distance is greater than 1 level
    if (Math.abs(link.target.y - link.source.y) > 1) {
      console.log("creating intermediate point")
      // Create intermediate point
      const intermediate = {
        x: source.x,
        y: target.y - this.verticalSpacing // Move vertically toward the target
      };

      // Add two links: (source → intermediate) and (intermediate → target)
      adjustedLinks.push({
        id: `${link.source.data.id || link.source.data._id}-intermediate`,
        source,
        target: intermediate
      });

      adjustedLinks.push({
        id: `intermediate-${link.target.data.id || link.target.data._id}`,
        source: intermediate,
        target
      });
    } else {
      console.log("no intermediate link")
      // Add the original link if no adjustment is needed
      adjustedLinks.push({
        id: `${link.source.data.id || link.source.data._id}-${link.target.data.id || link.target.data._id}`,
        source,
        target
      });
    }
  });

  return adjustedLinks;
},


  getRightmostNode(node) {
    // Traverse to the rightmost node on the mainline (first child only)
    while (node.children && node.children.length > 0) {
      node = node.children[0];
    }
    return node;
  },

assignPositions(node, x, y, horizontal) {
  // console.log("x is " + x + " y is " + y + " ymap is ")
  //     for (let [key, value] of this.yMap) {
  //       console.log(`Key: ${key}, Value: ${value}`);
  //     }


    if (!horizontal && this.yMap.get(y) == x) {
      console.log("adding another increment at " + x + " " + y);
      this.assignPositions(node, x, y + 1, horizontal)
      return;
    }

  // Assign coordinates
  node.x = x;
  node.y = y;

  // Attach coordinates to the data object for use in the frontend
  node.data.x = x;
  node.data.y = y;

  // Update yMap for collision detection
  // console.log("setting " + y + " at " + Math.min(this.yMap.get(y), x));
  if (!this.yMap.has(y)) this.yMap.set(y, Infinity);
  let oldMaxY = this.yMap.get(y);
  this.yMap.set(y, Math.min(this.yMap.get(y), x));

  // Recursively position children
  if (node.children && node.children.length > 0) {
    const child = node.children[0];
    let increment = 0;
    if (child.x !== undefined) {
    }
    else if (horizontal) {
      this.assignPositions(child, x + 1, y, true);
    } else {
      let branchLength = this.calculateBranchLength(child);
      if (x + branchLength >= oldMaxY) {
        increment = 1;
        this.assignPositions(child, x + 1, y + increment, false);
      } else {
       this.assignPositions(child, x + 1, y, true);
      }
    }

    for (let i = 1; i < node.children.length; i++) {
      const child = node.children[i];
      let nextY = y + increment + i
      if (!this.yMap.has(nextY)) this.yMap.set(nextY, Infinity);
      // this.yMap.set(nextY, Math.min(this.yMap.get(nextY), x + 1));
      this.yMap.set(nextY - 1, Math.min(this.yMap.get(nextY), x));
      // console.log ("setting ymap of " + (y + increment + i) + " to " + (Math.min(this.yMap.get(y + increment + i), x + 1)))
      this.assignPositions(child, x + 1, nextY, false);
    }
  }
},

    calculateBranchLength(node) {
      // Traverse the branch to determine its length (mainline only)
      let length = 1;
      while (node.children && node.children.length > 0) {
        node = node.children[0]; // Follow the first child down the mainline of this branch
        length += 1;
      }
      return length;
    },


    goToNode(node) {
      console.log("node has coordinates " + node.x + " " + node.y)
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
});
