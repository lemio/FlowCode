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
