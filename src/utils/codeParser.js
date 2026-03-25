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

// ── Layout constants for function sub-flow bodies ─────────────────────────
const FN_HEADER_H = 34;   // px height of the function header bar
const FN_PAD_TOP  = 12;   // px gap below header before first body node
const FN_PAD_SIDE = 16;   // px left/right padding inside function container
const FN_PAD_BOT  = 18;   // px padding below last body node
const PARAM_ROW_H = 36;   // px height reserved for the parameter row
const STMT_H      = 38;   // px height per statement slot
const FN_W        = 310;  // px default width of function container
// x offset for then/else branches (right column inside function):
const BRANCH_X_OFFSET = 160;

/**
 * Helper: get statement list from a node that may be a BlockStatement or a
 * single statement.
 */
function getStmts(node) {
  if (!node) return [];
  return node.type === 'BlockStatement' ? node.body : [node];
}

/**
 * Parse the source code and return:
 *   { nodes, edges, viewport, error }
 *
 * Node types:
 *   function   – { id, type:'function', label, params, width, height, x, y }
 *   bodyNode   – { id, type:'bodyNode', stmtType, label, parentNode, x, y }
 *               id pattern: __fn_<funcName>_<suffix>
 *   variable   – { id, type:'variable', label, init, initKind, x, y }
 *   call       – { id, type:'call', label, callee, args, x, y }
 *               id always `__call_<varName>`
 *   expression – { id, type:'expression', label, expression, identifiers, x, y }
 *               id `__expr_<varName>_arg<N>` or `__expr_<varName>`
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
  let autoX = 100;

  function nextAutoX() {
    const x = autoX;
    autoX += 240;
    return x;
  }

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

      // ── Pre-calculate body node layout ───────────────────────────────────
      const bodyNodeData = [];
      let bodyY = FN_HEADER_H + FN_PAD_TOP;
      const hasParams = params.length > 0;

      // Param nodes (top row)
      if (hasParams) {
        const spacing = Math.floor((FN_W - FN_PAD_SIDE * 2) / params.length);
        params.forEach((param, i) => {
          bodyNodeData.push({
            id: `__fn_${name}_p${i}`,
            type: 'bodyNode',
            label: param,
            stmtType: 'param',
            parentNode: name,
            x: FN_PAD_SIDE + i * spacing,
            y: bodyY,
          });
        });
        bodyY += PARAM_ROW_H;
      }

      // Statement nodes
      node.body.body.forEach((stmt, i) => {
        const raw = source.slice(stmt.start, stmt.end).trim();

        if (stmt.type === 'IfStatement') {
          // ── Condition node ───────────────────────────────────────────────
          const condRaw = source.slice(stmt.test.start, stmt.test.end).trim();
          const condLabel = condRaw.length > 22 ? condRaw.slice(0, 19) + '…' : condRaw;
          bodyNodeData.push({
            id: `__fn_${name}_s${i}`,
            type: 'bodyNode',
            label: `if (${condLabel})`,
            stmtType: 'if',
            parentNode: name,
            x: FN_PAD_SIDE,
            y: bodyY,
          });

          // ── Then branch – right column (x = FN_PAD_SIDE + BRANCH_X_OFFSET) ─
          const thenStmts = getStmts(stmt.consequent);
          thenStmts.forEach((cs, ci) => {
            const t = source.slice(cs.start, cs.end).trim();
            const ts = t.length > 24 ? t.slice(0, 21) + '…' : t;
            bodyNodeData.push({
              id: `__fn_${name}_s${i}_t${ci}`,
              type: 'bodyNode',
              label: ts,
              stmtType: cs.type === 'ReturnStatement' ? 'return' : 'stmt',
              parentNode: name,
              x: FN_PAD_SIDE + BRANCH_X_OFFSET,
              y: bodyY + ci * STMT_H,
            });
          });

          // ── Else branch – below then, same right column ──────────────────
          if (stmt.alternate) {
            const elseStmts = getStmts(stmt.alternate);
            elseStmts.forEach((as, ai) => {
              const t = source.slice(as.start, as.end).trim();
              const ts = t.length > 24 ? t.slice(0, 21) + '…' : t;
              bodyNodeData.push({
                id: `__fn_${name}_s${i}_e${ai}`,
                type: 'bodyNode',
                label: ts,
                stmtType: as.type === 'ReturnStatement' ? 'return' : 'stmt',
                parentNode: name,
                x: FN_PAD_SIDE + BRANCH_X_OFFSET,
                y: bodyY + thenStmts.length * STMT_H + ai * STMT_H,
              });
            });
          }

          bodyY += STMT_H;
        } else {
          // ── Regular statement ────────────────────────────────────────────
          const short = raw.length > 38 ? raw.slice(0, 35) + '…' : raw;
          bodyNodeData.push({
            id: `__fn_${name}_s${i}`,
            type: 'bodyNode',
            label: short,
            stmtType: stmt.type === 'ReturnStatement' ? 'return' : 'stmt',
            parentNode: name,
            x: FN_PAD_SIDE,
            y: bodyY,
          });
          bodyY += STMT_H;
        }
      });

      const fnHeight = bodyY + FN_PAD_BOT;

      // ── Add function container FIRST (parent must precede children) ───────
      addNode({
        id: name,
        type: 'function',
        label: name,
        params,
        width: FN_W,
        height: fnHeight,
        x: pos ? pos.x : nextAutoX(),
        y: pos ? pos.y : 150,
      });

      // ── Then add body nodes ───────────────────────────────────────────────
      bodyNodeData.forEach(n => addNode(n));
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
            // Complex expression
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

          // Call node – left of variable node
          addNode({
            id: callId,
            type: 'call',
            label: `${calleeName}(…)`,
            callee: calleeName,
            args,
            x: baseX - 180,
            y: baseY,
          });

          // Variable node (stores result)
          addNode({
            id: name,
            type: 'variable',
            label: name,
            init: callId,
            initKind: 'call',
            x: baseX,
            y: baseY,
          });

          // Edge: call → variable
          addEdge({
            source: callId, target: name,
            sourceHandle: 'output', targetHandle: 'input',
            label: '', animated: true, edgeType: 'call-result',
          });

          // Edge: function def → call node
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

