import { useState, useCallback, useRef, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import FlowCanvas from './components/FlowCanvas';
import { parseCode } from './utils/codeParser';
import { updateVariableInit } from './utils/codeGenerator';
import './App.css';

const DEFAULT_CODE = `//0,0,1200,650 viewport
let number = 3; //148,287

function fibonacci(n) { //162,80
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

let result = fibonacci(number); //680,287
let result2 = fibonacci(7); //680,400
let result3 = fibonacci(number); //680,170
`;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Update the //x,y part of a trailing position comment in `line`,
 * preserving any freetext that follows.
 */
function updatePositionComment(line, x, y) {
  const lastSlash = line.lastIndexOf('//');
  if (lastSlash !== -1) {
    const comment = line.slice(lastSlash);
    const posMatch = comment.match(/^\/\/\s*(-?\d[\d.]*)\s*,\s*(-?\d[\d.]*)([\s,].*)?$/);
    if (posMatch) {
      const freetext = posMatch[3] || '';
      return `${line.slice(0, lastSlash)}//${Math.round(x)},${Math.round(y)}${freetext}`;
    }
  }
  return `${line.trimEnd()} //${Math.round(x)},${Math.round(y)}`;
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

export default function App() {
  const [parsed, setParsed] = useState(() => parseCode(DEFAULT_CODE));
  const [bindings, setBindings] = useState({});
  const [parseError, setParseError] = useState(null);
  const [evalError, setEvalError] = useState(null);
  const [debugOpen, setDebugOpen] = useState(false);
  const [debugLog, setDebugLog] = useState([]);
  const debounceRef = useRef(null);
  const editorRef = useRef(null);
  const workerRef = useRef(null);
  const evalIdRef = useRef(0);

  const addDebug = useCallback((type, msg) => {
    const ts = new Date().toLocaleTimeString();
    setDebugLog(prev => [...prev.slice(-49), { type, msg, ts }]);
  }, []);

  const triggerEval = useCallback((source) => {
    const id = ++evalIdRef.current;
    workerRef.current && workerRef.current.postMessage({ source, id });
  }, []);

  // ── WebWorker setup ──────────────────────────────────────────────────────
  useEffect(() => {
    const worker = new Worker(
      new URL('./utils/evaluator.worker.js', import.meta.url),
      { type: 'module' }
    );
    worker.onmessage = ({ data }) => {
      if (data.id !== evalIdRef.current) return; // stale result
      setBindings(data.bindings || {});
      if (data.error) {
        setEvalError(data.error);
        addDebug('eval-error', data.error);
      } else {
        setEvalError(null);
      }
    };
    worker.onerror = (e) => {
      setEvalError(`Worker error: ${e.message}`);
      addDebug('worker-error', e.message);
    };
    workerRef.current = worker;
    // Initial evaluation
    triggerEval(DEFAULT_CODE);
    return () => worker.terminate();
  }, [addDebug, triggerEval]);

  // ── Code change handler (Monaco editor) ─────────────────────────────────
  const handleCodeChange = useCallback((value) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const result = parseCode(value);
      if (!result.error) {
        setParsed(result);
        setParseError(null);
      } else {
        setParseError(result.error);
        addDebug('parse-error', result.error);
      }
      triggerEval(value);
    }, 350);
  }, [addDebug, triggerEval]);

  // ── Node drag → update //x,y comment in editor ─────────────────────────
  const handleNodePositionChange = useCallback((nodeId, x, y) => {
    // Skip virtual nodes – they don't have their own code line
    if (nodeId.startsWith('__call_') || nodeId.startsWith('__expr_')) return;

    const currentCode = editorRef.current ? editorRef.current.getValue() : DEFAULT_CODE;
    const lines = currentCode.split('\n');
    const updated = lines.map(line => {
      const isFnDecl = new RegExp(`^\\s*(?:async\\s+)?function\\s+${escapeRegex(nodeId)}\\s*\\(`).test(line);
      const isVarDecl = new RegExp(`^\\s*(?:let|const|var)\\s+${escapeRegex(nodeId)}\\b`).test(line);
      if (isFnDecl || isVarDecl) {
        return updatePositionComment(line, x, y);
      }
      return line;
    });
    const newCode = updated.join('\n');
    if (editorRef.current) editorRef.current.setValue(newCode);
    const result = parseCode(newCode);
    if (!result.error) setParsed(result);
  }, []);

  // ── Graph connect: user drags a connection between two nodes ─────────────
  const handleGraphConnect = useCallback((connection) => {
    const { source, target, targetHandle } = connection;
    const currentCode = editorRef.current ? editorRef.current.getValue() : DEFAULT_CODE;

    // Resolve actual variable names (strip __call_ prefix from source if present)
    const sourceVar = source.startsWith('__call_') ? source.slice(7) : source;

    let newCode = currentCode;

    // If connecting a node's output to a variable's input → let target = sourceVar
    if (targetHandle === 'input') {
      newCode = updateVariableInit(currentCode, target, sourceVar);
      if (newCode === currentCode) {
        addDebug('connect', `Could not find variable "${target}" in code to update.`);
        return;
      }
      addDebug('connect', `Connected: let ${target} = ${sourceVar}`);
    } else {
      addDebug('connect', `Connected ${source} → ${target} (handle: ${targetHandle}) — manual code update needed.`);
      return;
    }

    if (editorRef.current) editorRef.current.setValue(newCode);
    const result = parseCode(newCode);
    if (!result.error) setParsed(result);
    triggerEval(newCode);
  }, [addDebug, triggerEval]);

  // ── Graph edge delete ─────────────────────────────────────────────────────
  const handleEdgeDelete = useCallback((edge) => {
    const { target, targetHandle, edgeType } = edge;
    const currentCode = editorRef.current ? editorRef.current.getValue() : DEFAULT_CODE;

    if (edgeType === 'ref' && targetHandle === 'input') {
      const newCode = updateVariableInit(currentCode, target, 'undefined');
      if (editorRef.current) editorRef.current.setValue(newCode);
      const result = parseCode(newCode);
      if (!result.error) setParsed(result);
      triggerEval(newCode);
      addDebug('edge-delete', `Removed reference: ${target} is now undefined`);
    } else {
      addDebug('edge-delete', `Deleted edge type=${edgeType} target=${target} (read-only edge)`);
    }
  }, [addDebug, triggerEval]);

  // ── Variable value edit from VariableNode ─────────────────────────────────
  const handleValueChange = useCallback((varName, newValue) => {
    const currentCode = editorRef.current ? editorRef.current.getValue() : DEFAULT_CODE;
    const newCode = updateVariableInit(currentCode, varName, newValue);
    if (editorRef.current) editorRef.current.setValue(newCode);
    const result = parseCode(newCode);
    if (!result.error) setParsed(result);
    triggerEval(newCode);
    addDebug('edit', `${varName} = ${newValue}`);
  }, [addDebug, triggerEval]);

  const statusColor = parseError || evalError ? '#ef4444' : '#10b981';
  const statusText = parseError ? '⚠ parse error' : evalError ? '⚠ eval error' : '● live';

  return (
    <div style={{ display: 'flex', height: '100vh', background: '#0f172a', overflow: 'hidden', fontFamily: 'monospace' }}>
      {/* ── Left: Monaco Editor ────────────────────────────────────────────── */}
      <div style={{ width: '50%', display: 'flex', flexDirection: 'column', borderRight: '2px solid #1e293b' }}>
        {/* Editor header */}
        <div style={{
          background: '#1e293b', padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: '8px',
          borderBottom: '1px solid #334155',
        }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} />
          <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '8px' }}>flowcode.js</span>
          <span style={{ marginLeft: 'auto', color: statusColor, fontSize: '11px' }}>
            {statusText}
          </span>
          <button
            onClick={() => setDebugOpen(o => !o)}
            style={{
              marginLeft: '8px', background: debugLog.some(l => l.type.endsWith('error')) ? '#450a0a' : '#1e293b',
              border: '1px solid #334155', borderRadius: '4px', color: '#94a3b8',
              fontSize: '10px', padding: '2px 8px', cursor: 'pointer',
            }}
          >
            🔍 debug
          </button>
        </div>
        {/* Editor */}
        <div style={{ flex: 1, minHeight: 0 }}>
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
          background: '#1e293b', borderTop: '1px solid #334155',
          padding: '8px 16px', maxHeight: '100px', overflowY: 'auto',
        }}>
          <div style={{ color: '#64748b', fontSize: '10px', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Live Values
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {Object.entries(bindings).filter(([k]) => !k.startsWith('__')).map(([key, val]) => (
              <div key={key} style={{
                background: '#0f172a', border: '1px solid #334155', borderRadius: '4px',
                padding: '2px 8px', fontSize: '11px', color: '#e2e8f0',
                display: 'flex', gap: '4px',
              }}>
                <span style={{ color: '#94a3b8' }}>{key}</span>
                <span style={{ color: '#38bdf8' }}>=</span>
                <span style={{ color: '#34d399' }}>{formatValue(val)}</span>
              </div>
            ))}
            {Object.keys(bindings).filter(k => !k.startsWith('__')).length === 0 && (
              <span style={{ color: '#475569', fontSize: '11px' }}>no variables yet</span>
            )}
          </div>
        </div>
        {/* Debug panel */}
        {debugOpen && (
          <div style={{
            background: '#0a0a1a', borderTop: '1px solid #334155',
            padding: '8px 16px', maxHeight: '180px', overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#64748b', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Debug Log</span>
              <button
                onClick={() => setDebugLog([])}
                style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '10px' }}
              >clear</button>
            </div>
            {debugLog.length === 0 && <span style={{ color: '#475569', fontSize: '10px' }}>no events</span>}
            {debugLog.slice().reverse().map((entry, i) => (
              <div key={i} style={{
                fontSize: '10px', padding: '1px 0',
                color: entry.type.endsWith('error') ? '#f87171' : '#94a3b8',
                fontFamily: 'monospace',
              }}>
                <span style={{ color: '#475569' }}>{entry.ts} </span>
                <span style={{
                  color: entry.type === 'parse-error' ? '#fbbf24' : entry.type === 'eval-error' ? '#f87171' : '#34d399',
                  marginRight: '6px',
                }}>[{entry.type}]</span>
                {entry.msg}
              </div>
            ))}
          </div>
        )}
        {/* Inline parse/eval error banner */}
        {(parseError || evalError) && (
          <div style={{
            background: '#450a0a', borderTop: '1px solid #7f1d1d',
            padding: '6px 16px', fontSize: '11px', color: '#fca5a5',
            fontFamily: 'monospace',
          }}>
            <strong>{parseError ? '⚠ Parse error:' : '⚠ Eval error:'}</strong>{' '}
            {(parseError || evalError).split('\n')[0].slice(0, 120)}
          </div>
        )}
      </div>

      {/* ── Right: React Flow Canvas ────────────────────────────────────────── */}
      <div style={{ width: '50%', display: 'flex', flexDirection: 'column' }}>
        {/* Canvas header */}
        <div style={{
          background: '#1e293b', padding: '8px 16px',
          display: 'flex', alignItems: 'center', gap: '8px',
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
            — {parsed.nodes.filter(n => !n.id.startsWith('__')).length} user nodes,{' '}
            {parsed.edges.length} edges
          </span>
          <span style={{ marginLeft: 'auto', color: '#475569', fontSize: '10px' }}>
            drag to connect · Backspace to delete edge
          </span>
        </div>
        {/* Canvas */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <FlowCanvas
            parsedNodes={parsed.nodes}
            parsedEdges={parsed.edges}
            viewport={parsed.viewport}
            bindings={bindings}
            onNodePositionChange={handleNodePositionChange}
            onGraphConnect={handleGraphConnect}
            onEdgeDelete={handleEdgeDelete}
            onValueChange={handleValueChange}
          />
        </div>
      </div>
    </div>
  );
}
