/**
 * codeGenerator.js
 * Text-based utilities for patching specific lines in the source code
 * in response to visual graph operations (connect, delete, edit).
 */

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extract the trailing position comment from a line, e.g. " //484,22" or " //484,22 result3"
 * Returns the comment string (with leading space) or ''.
 */
function extractPosComment(line) {
  const m = line.match(/(\s*\/\/\s*-?\d[\d.,\s\w]*)$/);
  return m ? m[1] : '';
}

/**
 * Update the init expression of a top-level variable declaration.
 *   let varName = OLD_INIT; //x,y  →  let varName = newInit; //x,y
 */
export function updateVariableInit(source, varName, newInit) {
  const lines = source.split('\n');
  const varRe = new RegExp(`^(\\s*(?:let|const|var)\\s+${escapeRegex(varName)}\\s*=\\s*)`);
  return lines.map(line => {
    if (!varRe.test(line)) return line;
    const prefix = line.match(varRe)[0];
    const posComment = extractPosComment(line);
    return `${prefix}${newInit};${posComment}`;
  }).join('\n');
}

/**
 * Append a new top-level variable declaration at the end of the source.
 *   → let varName = init; //x,y
 */
export function appendVariable(source, varName, init, x, y) {
  const pos = x != null ? ` //${Math.round(x)},${Math.round(y)}` : '';
  const decl = `let ${varName} = ${init};${pos}`;
  return source.trimEnd() + '\n' + decl + '\n';
}

/**
 * Remove a top-level variable declaration (and its blank lines if any).
 */
export function removeVariable(source, varName) {
  const varRe = new RegExp(`^\\s*(?:let|const|var)\\s+${escapeRegex(varName)}\\b.*\n?`);
  return source.replace(varRe, '');
}

/**
 * Split a top-level argument list string by commas, respecting nested parens/brackets/braces.
 * e.g. "a, foo(b, c), d" → ["a", "foo(b, c)", "d"]
 */
function splitArgs(argsStr) {
  const args = [];
  let depth = 0;
  let current = '';
  for (const ch of argsStr) {
    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

/**
 * Update a specific argument in a top-level function-call variable declaration.
 *   let varName = callee(arg0, arg1, …); //x,y
 *   → let varName = callee(arg0, newArg, …); //x,y
 */
export function updateCallArg(source, varName, argIndex, newArg) {
  const lines = source.split('\n');
  // Match: let varName = someCallee(
  const prefixRe = new RegExp(
    `^(\\s*(?:let|const|var)\\s+${escapeRegex(varName)}\\s*=\\s*)([\\w.]+)\\s*\\(`
  );
  return lines.map(line => {
    const m = line.match(prefixRe);
    if (!m) return line;
    const [fullMatch, declPrefix, callee] = m;
    const afterOpenParen = line.slice(fullMatch.length);

    // Walk to find the matching close paren
    let depth = 1;
    let i = 0;
    for (; i < afterOpenParen.length && depth > 0; i++) {
      if (afterOpenParen[i] === '(') depth++;
      else if (afterOpenParen[i] === ')') depth--;
    }
    // i now points to char after the closing paren
    const argsStr = afterOpenParen.slice(0, i - 1);   // content inside parens
    const afterClose = afterOpenParen.slice(i);         // e.g. "; //680,380"

    const args = splitArgs(argsStr);
    if (argIndex >= args.length) return line;
    args[argIndex] = newArg;
    return `${declPrefix}${callee}(${args.join(', ')})${afterClose}`;
  }).join('\n');
}

/**
 * Update the callee in a top-level function-call variable declaration.
 *   let varName = oldCallee(args); //x,y
 *   → let varName = newCallee(args); //x,y
 */
export function updateCallCallee(source, varName, newCallee) {
  const lines = source.split('\n');
  const prefixRe = new RegExp(
    `^(\\s*(?:let|const|var)\\s+${escapeRegex(varName)}\\s*=\\s*)`
  );
  return lines.map(line => {
    const pm = line.match(prefixRe);
    if (!pm) return line;
    const declPrefix = pm[0];
    const rest = line.slice(declPrefix.length); // e.g. "fibonacci(number); //680,380"
    const parenIdx = rest.indexOf('(');
    if (parenIdx === -1) return line;
    return declPrefix + newCallee + rest.slice(parenIdx);
  }).join('\n');
}
