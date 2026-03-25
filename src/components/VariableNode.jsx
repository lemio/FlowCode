import { memo, useState, useCallback, useRef } from 'react';
import { Handle, Position } from 'reactflow';

const VariableNode = memo(({ data }) => {
  const { label, value, init, initKind, onValueChange } = data;

  // Only literal-initialized variables are directly editable in the node
  const isEditable = initKind === 'literal' || initKind === undefined;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const startEdit = useCallback(() => {
    if (!isEditable) return;
    // Prefer the live value; fall back to the source literal
    const cur = value !== undefined && value !== null ? String(value) : (init !== undefined ? String(init) : '');
    setDraft(cur);
    setEditing(true);
    setTimeout(() => inputRef.current && inputRef.current.select(), 0);
  }, [isEditable, value, init]);

  const commitEdit = useCallback(() => {
    setEditing(false);
    if (onValueChange && draft.trim() !== '') {
      onValueChange(label, draft.trim());
    }
  }, [onValueChange, label, draft]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') setEditing(false);
  }, [commitEdit]);

  // ── Decide what to display ────────────────────────────────────────────────
  // For a static (literal) variable: display just one value (live if available, else init).
  // For others: display the live value.
  const isStatic = initKind === 'literal' || initKind === undefined;
  const displayVal = (value !== undefined && value !== null)
    ? value
    : (isStatic ? init : undefined);

  return (
    <div
      style={{
        background: '#1e1e2e',
        border: '2px solid #0ea5e9',
        borderRadius: '8px',
        minWidth: '140px',
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#e2e8f0',
        boxShadow: '0 4px 12px rgba(14,165,233,0.3)',
      }}
    >
      {/* ── Header ───────────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#0ea5e9',
          padding: '5px 10px',
          borderRadius: '6px 6px 0 0',
          fontWeight: 'bold',
          fontSize: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          color: '#e2e8f0',
        }}
      >
        <span style={{ opacity: 0.75, fontSize: '10px' }}>let</span>
        {label}
      </div>

      {/* ── Value body ───────────────────────────────────────────────────── */}
      <div
        style={{
          padding: '7px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '34px',
        }}
      >
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            onMouseDown={e => e.stopPropagation()}
            className="nodrag"
            style={{
              background: '#0f172a',
              border: '1px solid #0ea5e9',
              borderRadius: '4px',
              color: '#e2e8f0',
              fontSize: '13px',
              fontFamily: 'monospace',
              padding: '2px 6px',
              width: '100px',
              outline: 'none',
            }}
          />
        ) : (
          <span
            onClick={isEditable ? startEdit : undefined}
            title={isEditable ? 'Click to edit' : undefined}
            style={{
              cursor: isEditable ? 'text' : 'default',
              color: isStatic ? '#38bdf8' : initKind === 'call' ? '#34d399' : '#a78bfa',
              fontWeight: 'bold',
              fontSize: '14px',
              textDecoration: isEditable ? 'underline dotted' : 'none',
              maxWidth: '110px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              display: 'inline-block',
            }}
          >
            {displayVal !== undefined && displayVal !== null ? formatValue(displayVal) : '—'}
          </span>
        )}
      </div>

      <Handle type="target" position={Position.Left}  id="input"
        style={{ background: '#0ea5e9', width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} id="output"
        style={{ background: '#38bdf8', width: 10, height: 10 }} />
    </div>
  );
});

function formatValue(val) {
  if (val === undefined) return 'undefined';
  if (val === null)      return 'null';
  if (typeof val === 'function') return 'fn()';
  if (typeof val === 'object') {
    try { return JSON.stringify(val).slice(0, 28); } catch { return '[obj]'; }
  }
  return String(val).slice(0, 28);
}

VariableNode.displayName = 'VariableNode';
export default VariableNode;

