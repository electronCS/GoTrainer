export class Node {
    constructor(props, parent = null) {
        this.props = props;         // The properties (like B, W, etc.) of this node
        this.parent = parent;       // Reference to the parent node
        this.children = [];         // Array of children nodes
    }

    addChild(childNode) {
        childNode.parent = this;
        this.children.push(childNode);
    }

    print() {
        return `Node props: ${JSON.stringify(this.props)}, Children count: ${this.children.length}, Parent props: ${this.parent ? JSON.stringify(this.parent.props) : 'null'}`;
    }
}