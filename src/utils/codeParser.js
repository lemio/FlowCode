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
 * Extract trailing comment from source text at a given line (1-based).
 */
function getTrailingComment(sourceLines, line) {
  const srcLine = sourceLines[line - 1] || '';
  const m = srcLine.match(/\/\/.*$/);
  return m ? m[0] : null;
}

/** Returns true if the AST node is a primitive literal (no sub-identifiers). */
function isSimpleArg(node) {
  return (
    node.type === 'Identifier' ||
    node.type === 'NumericLiteral' ||
    node.type === 'StringLiteral' ||
    node.type === 'BooleanLiteral' ||
    node.type === 'NullLiteral'
  );
}

/** Walk an AST node and collect all Identifier names (deduplicated). */
function collectIdentifiers(node) {
  const found = new Set();
  function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'Identifier') { found.add(n.name); return; }
    for (const key of Object.keys(n)) {
      if (['type', 'start', 'end', 'loc', 'extra'].includes(key)) continue;
      const v = n[key];
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object' && v.type) walk(v);
    }
  }
  walk(node);
  return [...found];
}

/**
 * Parse the source code and return:
 *   { nodes, edges, viewport, error }
 *
 * Node types:
 *   function   – { id, type:'function', label, params, bodyNodes, bodyEdges, x, y }
 *   variable   – { id, type:'variable', label, init, initKind, x, y }
 *   call       – { id, type:'call', label, callee, args, x, y }
 *               id is always `__call_<varName>` (virtual – shares the code line with variable)
 *   expression – { id, type:'expression', label, expression, identifiers, x, y }
 *               id is `__expr_<varName>_arg<N>` or `__expr_<varName>`
 *
 * Edge shape: { id, source, target, sourceHandle, targetHandle, label, animated, edgeType }
 * Viewport:  { x, y, w, h } or null
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
    const vp = parsePositionComment(lines[0].trim());
    if (vp && vp.w !== null) viewport = vp;
  }

  const nodes = [];
  const edges = [];
  const nodeMap = {};
  let edgeCounter = 0;
  // Fallback auto-layout x counter (used only when no //x,y comment present)
  let autoX = 100;

  function nextAutoX() {
    const x = autoX;
    autoX += 240;
    return x;
  }

  // ── Helper: push a node and register it ──────────────────────────────────
  function addNode(n) {
    nodes.push(n);
    nodeMap[n.id] = n;
  }

  function addEdge(e) {
    edges.push({ id: `e${edgeCounter++}`, ...e });
  }

  // ── Walk AST ─────────────────────────────────────────────────────────────
  traverse(ast, {
    // ── FUNCTION DECLARATIONS ──────────────────────────────────────────────
    FunctionDeclaration(path) {
      const node = path.node;
      const name = node.id ? node.id.name : `fn_${nodes.length}`;
      const params = node.params.map(p => {
        if (p.type === 'Identifier') return p.name;
        if (p.type === 'AssignmentPattern' && p.left.type === 'Identifier') return p.left.name;
        return '?';
      });

      const comment = getTrailingComment(lines, node.loc.start.line);
      const pos = parsePositionComment(comment);

      // Build mini-diagram nodes/edges for the function body
      const bodyNodes = [];
      const bodyEdges = [];

      // Param nodes (row at the top)
      params.forEach((param, i) => {
        bodyNodes.push({ id: `param_${param}`, type: 'param', label: param, x: 20 + i * 90, y: 8 });
      });

      // Statement nodes (stacked below params)
      node.body.body.forEach((stmt, i) => {
        const text = source.slice(stmt.start, stmt.end).trim();
        const short = text.length > 42 ? text.slice(0, 39) + '…' : text;
        let stmtType = 'statement';
        if (stmt.type === 'IfStatement') stmtType = 'if';
        else if (stmt.type === 'ReturnStatement') stmtType = 'return';
        const stmtId = `stmt_${i}`;
        bodyNodes.push({ id: stmtId, type: stmtType, label: short, x: 20, y: 46 + i * 40 });
        if (i > 0) {
          bodyEdges.push({ id: `be_${i}`, source: `stmt_${i - 1}`, target: stmtId });
        }
      });
      // Connect params to first statement
      if (params.length > 0 && bodyNodes.some(n => n.id === 'stmt_0')) {
        params.forEach((_, pi) => {
          bodyEdges.push({ id: `be_p${pi}`, source: `param_${params[pi]}`, target: 'stmt_0' });
        });
      }

      addNode({
        id: name,
        type: 'function',
        label: name,
        params,
        bodyNodes,
        bodyEdges,
        x: pos ? pos.x : nextAutoX(),
        y: pos ? pos.y : 150,
      });
    },

    // ── VARIABLE DECLARATIONS ──────────────────────────────────────────────
    VariableDeclaration(path) {
      // Only top-level (Program scope)
      if (path.parent.type !== 'Program') return;

      path.node.declarations.forEach(decl => {
        if (!decl.id || decl.id.type !== 'Identifier') return;
        const name = decl.id.name;

        const comment = getTrailingComment(lines, path.node.loc.start.line);
        const pos = parsePositionComment(comment);
        const baseX = pos ? pos.x : nextAutoX();
        const baseY = pos ? pos.y : 350;

        if (decl.init && decl.init.type === 'CallExpression') {
          // ── SPLIT: call node + variable node ─────────────────────────────
          const callId = `__call_${name}`;
          const calleeAst = decl.init.callee;
          const calleeName = calleeAst.type === 'Identifier'
            ? calleeAst.name
            : source.slice(calleeAst.start, calleeAst.end);

          // Process arguments – create expression nodes for complex args
          const args = decl.init.arguments.map((arg, i) => {
            if (arg.type === 'Identifier') {
              return { kind: 'identifier', value: arg.name };
            }
            if (isSimpleArg(arg)) {
              return { kind: 'literal', value: source.slice(arg.start, arg.end) };
            }
            // Complex expression ─────────────────────────────────────────
            const exprId = `__expr_${name}_arg${i}`;
            const exprText = source.slice(arg.start, arg.end);
            const identifiers = collectIdentifiers(arg).filter(id => nodeMap[id]);
            if (!nodeMap[exprId]) {
              addNode({
                id: exprId,
                type: 'expression',
                label: exprText,
                expression: exprText,
                identifiers,
                x: baseX - 360,
                y: baseY + 60 * i,
              });
            }
            return { kind: 'expression', value: exprId, exprText };
          });

          // Call node – positioned to the LEFT of the variable node (data flows left→right)
          addNode({
            id: callId,
            type: 'call',
            label: `${calleeName}(…)`,
            callee: calleeName,
            args,
            x: baseX - 180,
            y: baseY,
          });

          // Variable node (stores the call result)
          addNode({
            id: name,
            type: 'variable',
            label: name,
            init: callId,
            initKind: 'call',
            x: baseX,
            y: baseY,
          });

          // Edge: call → variable (result binding)
          addEdge({
            source: callId, target: name,
            sourceHandle: 'output', targetHandle: 'input',
            label: '', animated: true, edgeType: 'call-result',
          });

          // Edge: function definition → call node
          if (nodeMap[calleeName]) {
            addEdge({
              source: calleeName, target: callId,
              sourceHandle: 'output', targetHandle: 'fn',
              label: '', animated: false, edgeType: 'fn',
            });
          }

          // Edges: args → call node
          args.forEach((arg, i) => {
            if (arg.kind === 'identifier' && nodeMap[arg.value]) {
              addEdge({
                source: arg.value, target: callId,
                sourceHandle: 'output', targetHandle: `arg-${i}`,
                label: '', animated: true, edgeType: 'arg',
              });
            } else if (arg.kind === 'expression') {
              addEdge({
                source: arg.value, target: callId,
                sourceHandle: 'output', targetHandle: `arg-${i}`,
                label: '', animated: true, edgeType: 'expr-arg',
              });
              // Edges: identifiers in expression → expression node
              const exprN = nodeMap[arg.value];
              if (exprN) {
                exprN.identifiers.forEach((ident, j) => {
                  if (nodeMap[ident]) {
                    addEdge({
                      source: ident, target: arg.value,
                      sourceHandle: 'output', targetHandle: `id-${j}`,
                      label: '', animated: true, edgeType: 'ident-ref',
                    });
                  }
                });
              }
            }
          });

        } else if (decl.init && decl.init.type === 'Identifier') {
          // ── let name = otherVar ───────────────────────────────────────────
          const refName = decl.init.name;
          addNode({
            id: name, type: 'variable', label: name,
            init: refName, initKind: 'identifier',
            x: baseX, y: baseY,
          });
          if (nodeMap[refName]) {
            addEdge({
              source: refName, target: name,
              sourceHandle: 'output', targetHandle: 'input',
              label: '', animated: true, edgeType: 'ref',
            });
          }

        } else {
          // ── Literal or complex expression ─────────────────────────────────
          const init = decl.init ? source.slice(decl.init.start, decl.init.end) : undefined;
          const isComplex = decl.init && !isSimpleArg(decl.init);
          addNode({
            id: name, type: 'variable', label: name,
            init, initKind: isComplex ? 'expression' : 'literal',
            x: baseX, y: baseY,
          });

          if (isComplex) {
            // Create expression node for complex variable init
            const exprId = `__expr_${name}`;
            const identifiers = collectIdentifiers(decl.init).filter(id => nodeMap[id]);
            addNode({
              id: exprId, type: 'expression',
              label: init, expression: init, identifiers,
              x: baseX - 220, y: baseY,
            });
            addEdge({
              source: exprId, target: name,
              sourceHandle: 'output', targetHandle: 'input',
              label: '', animated: true, edgeType: 'expr-init',
            });
            identifiers.forEach((ident, j) => {
              if (nodeMap[ident]) {
                addEdge({
                  source: ident, target: exprId,
                  sourceHandle: 'output', targetHandle: `id-${j}`,
                  label: '', animated: true, edgeType: 'ident-ref',
                });
              }
            });
          }
        }
      });
    },
  });

  return { nodes, edges, viewport, error: null };
}
