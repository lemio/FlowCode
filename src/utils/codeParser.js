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
 * Node shape: { id, type: 'function'|'variable'|'call', label, params, x, y, value }
 * Edge shape: { id, source, target, label }
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

      const n = {
        id: name,
        type: 'function',
        label: name,
        params,
        x: pos ? pos.x : 100 + nodes.length * 220,
        y: pos ? pos.y : 150,
        value: null,
      };
      nodes.push(n);
      nodeMap[name] = n;
    },

    VariableDeclaration(path) {
      const decls = path.node.declarations;
      decls.forEach(decl => {
        if (!decl.id || decl.id.type !== 'Identifier') return;
        const name = decl.id.name;

        // trailing comment on the declaration line
        const startLine = path.node.loc.start.line;
        const comment = getTrailingComment(lines, startLine);
        const pos = parsePositionComment(comment);

        const n = {
          id: name,
          type: 'variable',
          label: name,
          params: [],
          x: pos ? pos.x : 400 + nodes.length * 220,
          y: pos ? pos.y : 350,
          value: null,
          init: decl.init ? source.slice(decl.init.start, decl.init.end) : undefined,
        };
        nodes.push(n);
        nodeMap[name] = n;

        // If init is a call expression, create edge from callee
        if (decl.init && decl.init.type === 'CallExpression') {
          const callee = decl.init.callee;
          const calleeName = callee.type === 'Identifier' ? callee.name : null;
          if (calleeName && nodeMap[calleeName]) {
            edges.push({
              id: `e${edgeCounter++}`,
              source: calleeName,
              target: name,
              label: '',
              animated: true,
            });
          }
        }
      });
    },
  });

  return { nodes, edges, viewport, error: null };
}
