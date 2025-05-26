import { parseCoordinates } from './utils.js';

export class Node {
    constructor(props, parent = null, moveNumber) {
        this.props = props;         // The properties (like B, W, etc.) of this node
        this.parent = parent;       // Reference to the parent node
        this.children = [];         // Array of children nodes
        this.currentChildIndex = 0; // next active child in variation tree
        this.isMoveNode = !!(props.B || props.W);
        // console.log("isMoveNOde is " + this.isMoveNode);
        if (this.isMoveNode) {
            // console.log("setting with moveNumber " + moveNumber);
            this.moveNumber = moveNumber; // Move number for this node
        }
    }

    addChild(childNode) {
        childNode.parent = this;
        this.children.push(childNode);
    }

    getNextChild() {
        if (this.children.length > 0) {
            return this.children[this.currentChildIndex];
        }
        return null;
    }

    setNextChild(index) {
        if (index >= 0 && index < this.children.length) {
            this.currentChildIndex = index;
        }
    }

    getMovesToNode(rootNode) {
      const moves = [];
      let node = this;
      console.log("Traversing to node:", node.print && node.print());

      while (node) {
        if (node.props) {
          moves.push(node.props);
        }
        if (node.parent) {
          const index = node.parent.children.indexOf(node);
          if (index !== -1) {
            node.parent.setNextChild(index); // maintain child index tracking
          }
        }
        if (node === rootNode) break;
        node = node.parent;
      }

      return moves.reverse();
    }


    print() {
        const parseProps = (props) => {
            const parsed = {};
            for (const key in props) {
                if ((key === 'B' || key === 'W') && props[key]) {
                    const [col, row] = parseCoordinates(props[key]);
                    parsed[key] = `(${col}, ${row})`; // Format the parsed coordinates
                } else {
                    parsed[key] = props[key]; // Keep other properties as they are
                }
            }
            return parsed;
        };

        // Parse current node props
        const parsedProps = parseProps(this.props);

        // Parse parent node props if available
        const parsedParentProps = this.parent ? parseProps(this.parent.props) : 'null';

        return `Node props: ${JSON.stringify(parsedProps)}, Children count: ${this.children.length}, Parent props: ${JSON.stringify(parsedParentProps)}`;
    }

}