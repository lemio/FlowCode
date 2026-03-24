import * as parser from '@babel/parser';
import _traverse from '@babel/traverse';
// Babel traverse compatibility
const traverse = _traverse.default || _traverse;

/**
 * Parse position comment: //x,y optional_text  OR  //x,y,w,h optional_text
 * Returns { x, y, w, h } or null
 */
export function parsePositionComment(comment) {
  if (!comment) return null;
  const m = comment.trim().match(/^\/\/\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)(?:\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?))?/);
  if (!m) return null;
  return {
    x: parseFloat(m[1]),
    y: parseFloat(m[2]),
    w: m[3] != null ? parseFloat(m[3]) : null,
    h: m[4] != null ? parseFloat(m[4]) : null,
  };
}

/**
 * Extract trailing comment from source text at a given line.
 * Returns the comment string or null.
 */
function getTrailingComment(sourceLines, line) {
  // line is 1-based
  const srcLine = sourceLines[line - 1] || '';
  const m = srcLine.match(/\/\/.*$/);
  return m ? m[0] : null;
}

/**
 * Parse the source code and return:
 * { nodes, edges, viewport, error }
 *
 * Node shapes:
 *   function: { id, type:'function', label, params, bodyLines, x, y }
 *   variable: { id, type:'variable', label, x, y, init }
 *   call:     { id, type:'call', label, callee, args:[{kind,value}], x, y }
 *
 * Edge shape: { id, source, target, sourceHandle, targetHandle, label, animated, edgeType }
 * Viewport: { x, y, w, h } or null
 */
export function parseCode(source) {
  let ast;
  try {
    ast = parser.parse(source, {
      sourceType: 'module',
      plugins: ['jsx'],
      attachComment: true,
      errorRecovery: false,
    });
  } catch (err) {
    return { nodes: [], edges: [], viewport: null, error: err.message };
  }

  const lines = source.split('\n');

  // --- Viewport from first line ---
  let viewport = null;
  if (lines.length > 0) {
    const firstLine = lines[0].trim();
    const vp = parsePositionComment(firstLine);
    if (vp && vp.w !== null) {
      viewport = vp;
    }
  }

  const nodes = [];
  const edges = [];
  const nodeMap = {}; // id -> node
  let edgeCounter = 0;

  // --- Walk AST ---
  traverse(ast, {
    FunctionDeclaration(path) {
      const node = path.node;
      const name = node.id ? node.id.name : `fn_${nodes.length}`;
      const params = node.params.map(p => {
        if (p.type === 'Identifier') return p.name;
        if (p.type === 'AssignmentPattern' && p.left.type === 'Identifier') return p.left.name;
        return '?';
      });

      // Trailing comment on the opening line
      const startLine = node.loc.start.line;
      const comment = getTrailingComment(lines, startLine);
      const pos = parsePositionComment(comment);

      // Extract each body statement as a text snippet for visual display
      const bodyLines = node.body.body.map(stmt => {
        const text = source.slice(stmt.start, stmt.end).trim();
        return text.length > 58 ? text.slice(0, 55) + '…' : text;
      });

      const n = {
        id: name,
        type: 'function',
        label: name,
        params,
        bodyLines,
        x: pos ? pos.x : 100 + nodes.length * 220,
        y: pos ? pos.y : 150,
      };
      nodes.push(n);
      nodeMap[name] = n;
    },

    VariableDeclaration(path) {
      // Only handle top-level declarations; variables inside functions are shown in the function node body
      if (path.parent.type !== 'Program') return;

      path.node.declarations.forEach(decl => {
        if (!decl.id || decl.id.type !== 'Identifier') return;
        const name = decl.id.name;

        const startLine = path.node.loc.start.line;
        const comment = getTrailingComment(lines, startLine);
        const pos = parsePositionComment(comment);
        const x = pos ? pos.x : 400 + nodes.length * 220;
        const y = pos ? pos.y : 350;

        if (decl.init && decl.init.type === 'CallExpression') {
          // ── CALL NODE: let name = callee(arg0, arg1, …) ──────────────────
          const calleeNode = decl.init.callee;
          const calleeName = calleeNode.type === 'Identifier'
            ? calleeNode.name
            : source.slice(calleeNode.start, calleeNode.end);

          const args = decl.init.arguments.map(arg => {
            if (arg.type === 'Identifier') return { kind: 'identifier', value: arg.name };
            return { kind: 'literal', value: source.slice(arg.start, arg.end) };
          });

          const n = { id: name, type: 'call', label: name, callee: calleeName, args, x, y };
          nodes.push(n);
          nodeMap[name] = n;

          // Edge: function definition → call node (via fn handle)
          if (nodeMap[calleeName]) {
            edges.push({
              id: `e${edgeCounter++}`,
              source: calleeName,
              target: name,
              sourceHandle: 'output',
              targetHandle: 'fn',
              label: '',
              animated: false,
              edgeType: 'fn',
            });
          }

          // Edges: identifier args → call node (via arg-N handle)
          args.forEach((arg, i) => {
            if (arg.kind === 'identifier' && nodeMap[arg.value]) {
              edges.push({
                id: `e${edgeCounter++}`,
                source: arg.value,
                target: name,
                sourceHandle: 'output',
                targetHandle: `arg-${i}`,
                label: '',
                animated: true,
                edgeType: 'arg',
              });
            }
          });
        } else {
          // ── PLAIN VARIABLE NODE ───────────────────────────────────────────
          const n = {
            id: name,
            type: 'variable',
            label: name,
            x, y,
            init: decl.init ? source.slice(decl.init.start, decl.init.end) : undefined,
          };
          nodes.push(n);
          nodeMap[name] = n;
        }
      });
    },
  });

  return { nodes, edges, viewport, error: null };
}
