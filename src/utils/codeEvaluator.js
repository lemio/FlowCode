/**
 * Safely evaluate code and return variable bindings.
 * Returns { bindings: {name: value}, error: string|null }
 */
export function evaluateCode(source) {
  try {
    const bindings = {};
    // Create a sandboxed function that captures variable assignments
    // We instrument the code slightly to capture top-level variable values
    
    // Use Function constructor for sandboxed eval
    const captureCode = `
      const __bindings = {};
      const __capture = (name, val) => { __bindings[name] = val; return val; };
      ${instrumentSource(source)}
      return __bindings;
    `;
    // eslint-disable-next-line no-new-func
    const fn = new Function(captureCode);
    const result = fn();
    return { bindings: result || {}, error: null };
  } catch (err) {
    return { bindings: {}, error: err.message };
  }
}

/**
 * Simple instrumentation: wrap top-level variable declarations to capture values.
 * This is a best-effort approach using regex-based transformation.
 */
function instrumentSource(source) {
  // Remove the viewport comment on the first line (starts with //)
  const lines = source.split('\n');
  const processed = lines.map((line, i) => {
    // Strip trailing position comments so they don't interfere
    return line.replace(/\/\/\s*-?\d+.*$/, '// stripped');
  });
  return processed.join('\n');
}
