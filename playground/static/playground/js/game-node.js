import { parseCoordinates } from './utils.js';

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