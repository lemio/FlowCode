/**
 * WebWorker: evaluates user code without blocking the main thread.
 * The evaluation logic is self-contained (workers cannot share module state).
 */

function instrumentSource(source) {
  let lines = source.split('\n');
  // Blank out viewport comment on first line
  if (lines.length > 0 && /^\s*\/\/\s*-?\d/.test(lines[0])) {
    lines[0] = '';
  }
  return lines.map(line => {
    // Strip trailing position comments like //123,456 or //123,456,900,600
    const stripped = line.replace(/\s*\/\/\s*-?\d[\d.,\s\w]*$/, '');
    // Wrap top-level var declarations: let x = EXPR → let x = __c('x', EXPR)
    const m = stripped.match(
      /^(\s*)(let|const|var)(\s+)([A-Za-z_$][A-Za-z0-9_$]*)(\s*=\s*)(.+?)(;?\s*)$/
    );
    if (m) {
      const [, indent, kw, sp, name, eq, expr, semi] = m;
      return `${indent}${kw}${sp}${name}${eq}__c('${name}', ${expr})${semi || ';'}`;
    }
    return stripped;
  }).join('\n');
}

function evaluateCode(source) {
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

self.onmessage = ({ data: { source, id } }) => {
  self.postMessage({ ...evaluateCode(source), id });
};
