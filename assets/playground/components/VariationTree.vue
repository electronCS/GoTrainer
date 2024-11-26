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
      <g class="tree-nodes">

      <!-- Draw nodes -->
      <VariationTreeNode
          v-for="node in nodes"
          :key="node.id"
          :x="node.x"
          :y="node.y"
          :node="node.data"
          :isCurrent="node.data === currentNode"
          :isActiveBranch="activeBranch.has(node.data)"
          @select-node="goToNode"
      />
      </g>
      </g>

    </svg>

</template>

<script>

import VariationTreeNode from "./VariationTreeNode.vue";
import * as d3 from "d3";

export default {
  name: 'VariationTree',
  components: {
    VariationTreeNode
  },
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
            svgHeight: 600, // Initial SVG height; will be updated dynamically
            activeBranch: new Set() // Initialize activeBranch as an empty Set

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
            this.highlightActiveBranch();
        }
    },
    mounted() {
        console.log("in here")
  console.log('Nodes:', this.nodes);
  console.log('Links:', this.links);
},
    methods: {
        computeTreeLayout() {
            console.log("testing changessss");
            // Convert your rootNode into a hierarchy
          console.log("d3:", d3);
          console.log("root node is " + (this.rootNode == null));
          if (this.rootNode == null) {
            return;
          }
            const root = d3.hierarchy(this.rootNode, d => d.children);

            // Initialize map to keep track of smallest x occupied at each y-level
            this.yMap = new Map();

            let currentNode = this.getRightmostNode(root);

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

                // If the vertical distance is greater than 1 level
                if (Math.abs(link.target.y - link.source.y) > 1) {
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

            if (!horizontal && this.yMap.get(y) <= x) {
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

            this.updateYMap(x, y);


            // Recursively position children
            if (node.children && node.children.length > 0) {
                const child = node.children[0];
                let increment = 0;
                if (child.x !== undefined) {
                } else if (horizontal) {
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
                    this.assignPositions(child, x + 1, nextY, false);
                }
            }
        },

        updateYMap(x, y) {
            for (let z = 1; z < y; z++) {
                if (!this.yMap.has(y - z)) this.yMap.set(y - z, Infinity);

                this.yMap.set(y - z, Math.min(this.yMap.get(y - z), x - z));
                // console.log ("on " + x + " " + y + ", setting ymap of " + (y - z) + " to " + Math.min(this.yMap.get(y - z), x - z + 1));
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

        calculateActiveBranch() {
            this.activeBranch = new Set()
            // Traverse forward to collect nodes
            let node = this.currentNode;
            while (node) {
                this.activeBranch.add(node);
                node = node.getNextChild();
                // node = node.children[node.currentChildIndex] || null; // Move to the next node in the branch
            }

            // Traverse backward to collect nodes
            node = this.currentNode;
            while (node) {

                this.activeBranch.add(node);
                node = node.parent || null; // Move to the previous node in the branch
            }

        },

        highlightActiveBranch() {
            // Calculate the active branch
            this.calculateActiveBranch();

            // Update the class for each node
            this.nodes.forEach(node => {
                const nodeElement = d3.select(`[data-id="${node.id}"]`); // Select node by ID
                if (this.activeBranch.has(node.data)) {
                    nodeElement.classed('active-branch', true);
                } else {
                    nodeElement.classed('active-branch', false);
                }
            });
        },

        goToNode(node) {
            console.log("node has coordinates " + node.x + " " + node.y)
            this.$emit('select-node', node);
        },
        getMoveLabel(nodeData) {
            return nodeData.props.B || nodeData.props.W || '●';
        },

getNodeFill(node) {
    // Highlight the current node
    if (node.data === this.currentNode) {
        return '#ffe4b5'; // Highlight color for the current node
    }

    // Determine color based on the move (Black or White)
    if (node.data.props.B) {
        return '#000000'; // Black for Black moves
    }
    if (node.data.props.W) {
        return '#ffffff'; // White for White moves
    }

    // Default color if no move is specified
    return '#f5deb3';
},

        highlightCurrentNode() {
            // Optionally implement logic to update node styles
        }
    }

}

</script>