/**
 * Safely evaluate code and return variable bindings.
 * Returns { bindings: {name: value}, error: string|null }
 */
export function evaluateCode(source) {
  try {
    const instrumented = instrumentSource(source);
    const captureCode = `
      const __b = {};
      const __c = (n, v) => { __b[n] = v; return v; };
      ${instrumented}
      return __b;
    `;
    const result = new Function(captureCode)();
    return { bindings: result || {}, error: null };
  } catch (err) {
    return { bindings: {}, error: err.message };
  }
}

/**
 * Instrument source:
 * 1. Strip viewport/position comments (//digits,...) 
 * 2. Wrap top-level variable declarations to capture values:
 *    let x = EXPR;  →  let x = __c('x', EXPR);
 */
function instrumentSource(source) {
  let lines = source.split('\n');

  // First line may be viewport comment - replace with blank
  if (lines.length > 0 && /^\s*\/\/\s*-?\d/.test(lines[0])) {
    lines[0] = '';
  }

  return lines.map(line => {
    // Strip trailing position comments: //digits,digits...
    const stripped = line.replace(/\s*\/\/\s*-?\d[\d.,\s\w]*$/, '');

    // Match: optional-whitespace (let|const|var) NAME = REST;
    const m = stripped.match(/^(\s*)(let|const|var)(\s+)([A-Za-z_$][A-Za-z0-9_$]*)(\s*=\s*)(.+?)(;?\s*)$/);
    if (m) {
      const [, indent, kw, sp, name, eq, expr, semi] = m;
      // Wrap the expr in __c('name', expr)
      return `${indent}${kw}${sp}${name}${eq}__c('${name}', ${expr})${semi || ';'}`;
    }
    return stripped;
  }).join('\n');
}

