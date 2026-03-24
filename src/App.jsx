import { useState, useCallback, useRef } from 'react';
import Editor from '@monaco-editor/react';
import FlowCanvas from './components/FlowCanvas';
import { parseCode } from './utils/codeParser';
import { evaluateCode } from './utils/codeEvaluator';
import './App.css';

const DEFAULT_CODE = `//0,0,900,600 viewport
function fibonacci(n) { //100,80 fibonacci
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

let result = fibonacci(10); //500,80 result
let result2 = fibonacci(7); //500,220 result2
let result3 = fibonacci(5); //500,360 result3
`;

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [parsed, setParsed] = useState(() => parseCode(DEFAULT_CODE));
  const [bindings, setBindings] = useState(() => evaluateCode(DEFAULT_CODE).bindings);
  const [parseError, setParseError] = useState(null);
  const debounceRef = useRef(null);
  const editorRef = useRef(null);

  const handleCodeChange = useCallback((value) => {
    setCode(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const result = parseCode(value);
      if (!result.error) {
        setParsed(result);
        setParseError(null);
        const evalResult = evaluateCode(value);
        setBindings(evalResult.bindings);
      } else {
        setParseError(result.error);
      }
    }, 400);
  }, []);

  const handleNodePositionChange = useCallback((nodeId, x, y) => {
    setCode(prevCode => {
      const lines = prevCode.split('\n');
      const updated = lines.map(line => {
        const fnMatch = line.match(new RegExp(`^(\\s*(?:function|async function)\\s+${escapeRegex(nodeId)}\\s*\\([^)]*\\)\\s*\\{)\\s*(//.*)?$`));
        if (fnMatch) {
          return `${fnMatch[1]} //${Math.round(x)},${Math.round(y)}`;
        }
        const varMatch = line.match(new RegExp(`^(\\s*(?:let|const|var)\\s+${escapeRegex(nodeId)}\\b.*)\\s*(//.*)?$`));
        if (varMatch) {
          const base = varMatch[1].replace(/\s*\/\/.*$/, '').trimEnd();
          return `${base}; //${Math.round(x)},${Math.round(y)}`;
        }
        return line;
      });
      const newCode = updated.join('\n');
      const result = parseCode(newCode);
      if (!result.error) {
        setParsed(result);
      }
      return newCode;
    });
  }, []);

  function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      background: '#0f172a',
      overflow: 'hidden',
      fontFamily: 'monospace',
    }}>
      {/* Left: Monaco Editor */}
      <div style={{
        width: '50%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: '2px solid #1e293b',
      }}>
        {/* Header */}
        <div style={{
          background: '#1e293b',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '1px solid #334155',
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
          <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '8px' }}>flowcode.js</span>
          {parseError && (
            <span style={{ marginLeft: 'auto', color: '#ef4444', fontSize: '11px', background: '#450a0a', padding: '2px 8px', borderRadius: '4px' }}>
              ⚠ {parseError.split('\n')[0].slice(0, 60)}
            </span>
          )}
          {!parseError && (
            <span style={{ marginLeft: 'auto', color: '#10b981', fontSize: '11px' }}>● live</span>
          )}
        </div>
        {/* Editor */}
        <div style={{ flex: 1 }}>
          <Editor
            defaultValue={DEFAULT_CODE}
            language="javascript"
            theme="vs-dark"
            onChange={handleCodeChange}
            onMount={(editor) => { editorRef.current = editor; }}
            options={{
              fontSize: 14,
              minimap: { enabled: false },
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              padding: { top: 12 },
              fontFamily: "'Fira Code', 'Cascadia Code', monospace",
              fontLigatures: true,
              renderLineHighlight: 'all',
              cursorBlinking: 'smooth',
            }}
          />
        </div>
        {/* Live values panel */}
        <div style={{
          background: '#1e293b',
          borderTop: '1px solid #334155',
          padding: '8px 16px',
          maxHeight: '120px',
          overflowY: 'auto',
        }}>
          <div style={{ color: '#64748b', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Live Values
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {Object.entries(bindings).filter(([k]) => !k.startsWith('__')).map(([key, val]) => (
              <div key={key} style={{
                background: '#0f172a',
                border: '1px solid #334155',
                borderRadius: '4px',
                padding: '2px 8px',
                fontSize: '11px',
                color: '#e2e8f0',
                display: 'flex',
                gap: '4px',
              }}>
                <span style={{ color: '#94a3b8' }}>{key}</span>
                <span style={{ color: '#38bdf8' }}>=</span>
                <span style={{ color: '#34d399' }}>{formatValue(val)}</span>
              </div>
            ))}
            {Object.keys(bindings).filter(k => !k.startsWith('__')).length === 0 && (
              <span style={{ color: '#475569', fontSize: '11px' }}>no variables</span>
            )}
          </div>
        </div>
      </div>

      {/* Right: React Flow */}
      <div style={{ width: '50%', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{
          background: '#1e293b',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          borderBottom: '1px solid #334155',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <circle cx="4" cy="4" r="3" fill="#7c3aed" />
            <circle cx="12" cy="4" r="3" fill="#0ea5e9" />
            <circle cx="8" cy="12" r="3" fill="#10b981" />
            <line x1="4" y1="4" x2="12" y2="4" stroke="#7c3aed" strokeWidth="1" />
            <line x1="4" y1="4" x2="8" y2="12" stroke="#0ea5e9" strokeWidth="1" />
          </svg>
          <span style={{ color: '#e2e8f0', fontSize: '12px', fontWeight: 'bold' }}>FlowCode</span>
          <span style={{ color: '#64748b', fontSize: '11px' }}>
            — {parsed.nodes.length} nodes, {parsed.edges.length} edges
          </span>
        </div>
        {/* Canvas */}
        <div style={{ flex: 1 }}>
          <FlowCanvas
            parsedNodes={parsed.nodes}
            parsedEdges={parsed.edges}
            viewport={parsed.viewport}
            bindings={bindings}
            onNodePositionChange={handleNodePositionChange}
          />
        </div>
      </div>
    </div>
  );
}

function formatValue(val) {
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';
  if (typeof val === 'function') return 'fn()';
  if (typeof val === 'object') {
    try { return JSON.stringify(val).slice(0, 40); } catch { return '[obj]'; }
  }
  return String(val).slice(0, 40);
}
