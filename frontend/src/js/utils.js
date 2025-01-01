// utils.js
import {Node} from "./game-node";

export function parseCoordinates(coord) {
    // Parse SGF coordinates (e.g., "aa" to [0, 0])
    const col = coord.charCodeAt(0) - 'a'.charCodeAt(0);
    const row = coord.charCodeAt(1) - 'a'.charCodeAt(0);
    return [col, row];
}

export function safeStringify(obj, space = 2) {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                return '[Circular]';
            }
            seen.add(value);
        }
        return value;
    }, space);
}

export function convertSgfToNode(sgfData, parent = null, moveNumber = 0) {
    const node = new Node(sgfData.props, parent, moveNumber);
    // console.log ()
    // console.log("sgf data props is " + JSON.stringify(sgfData.props, null, 2));

    if (sgfData.props.LB) {
      // console.log("props has LB")
      // Ensure LB is an array before mapping
      const labels = Array.isArray(sgfData.props.LB) ? sgfData.props.LB : [sgfData.props.LB];
      // Extract label annotations
      node.labels = labels.map(label => {
          const [coord, text] = label.split(':');
          const [col, row] = parseCoordinates(coord);
          return { col, row, text };
      });

      // console.log("node labels is " + JSON.stringify(node.labels, null, 2))
    }

    if (sgfData.childs) {
      sgfData.childs.forEach(childData => {
          const isChildMoveNode = !!(childData.props.B || childData.props.W);
          // Increment moveNumber only for child move nodes
          const childMoveNumber = isChildMoveNode ? moveNumber + 1 : moveNumber;

          // Convert the child and add it to the current node
          const childNode = convertSgfToNode(childData, node, childMoveNumber);
          node.addChild(childNode);
      });
    }
    // console.log("returned node is " + node.print())

    return node;
}

export function convertNodeToSgf(node) {
    const propsToSgf = Object.entries(node.props)
        .map(([key, value]) => {
            if (Array.isArray(value)) {
                // Handle special case for 'LB' annotations
                if (key === 'LB') {
                    return `${key}${value.map(v => `[${v}]`).join('')}`;
                }
                // Handle other arrays normally
                return value.map(v => `${key}[${v}]`).join('');
            } else if (value) {
                return `${key}[${value}]`;
            }
            return '';
        })
        .join('');

    let sgf = `;${propsToSgf}`;

    if (node.children.length > 0) {
        // Wrap all children in parentheses to ensure variations are processed inline
        node.children.forEach(child => {
            sgf += `(${convertNodeToSgf(child)})`;
        });
    }

    return sgf;
}

