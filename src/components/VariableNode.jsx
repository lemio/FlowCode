import { memo, useState, useCallback, useRef } from 'react';
import { Handle, Position } from 'reactflow';

const VariableNode = memo(({ data }) => {
  const { label, value, init, initKind, onValueChange } = data;
  const isEditable = initKind === 'literal' || initKind === undefined;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const startEdit = useCallback(() => {
    if (!isEditable) return;
    setDraft(init !== undefined ? String(init) : '');
    setEditing(true);
    setTimeout(() => inputRef.current && inputRef.current.select(), 0);
  }, [isEditable, init]);

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

  return (
    <div style={{
      background: '#1e1e2e',
      border: '2px solid #0ea5e9',
      borderRadius: '8px',
      minWidth: '160px',
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#e2e8f0',
      boxShadow: '0 4px 12px rgba(14,165,233,0.3)',
    }}>
      {/* Header */}
      <div style={{
        background: '#0ea5e9',
        padding: '6px 10px',
        borderRadius: '6px 6px 0 0',
        fontWeight: 'bold',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span style={{ opacity: 0.8, fontSize: '10px' }}>let</span>
        {label}
      </div>

      {/* Init expression / editable value */}
      {initKind !== 'call' && init !== undefined && (
        <div style={{
          padding: '5px 10px',
          color: '#94a3b8',
          fontSize: '11px',
          borderBottom: '1px solid #374151',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}>
          <span style={{ color: '#64748b' }}>=</span>
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              style={{
                background: '#0f172a',
                border: '1px solid #0ea5e9',
                borderRadius: '4px',
                color: '#e2e8f0',
                fontSize: '11px',
                fontFamily: 'monospace',
                padding: '1px 4px',
                width: '100px',
                outline: 'none',
              }}
              // Prevent ReactFlow drag from consuming keydown
              onMouseDown={e => e.stopPropagation()}
              className="nodrag"
            />
          ) : (
            <span
              onClick={isEditable ? startEdit : undefined}
              title={isEditable ? 'Click to edit' : undefined}
              style={{
                cursor: isEditable ? 'text' : 'default',
                color: initKind === 'identifier' ? '#7dd3fc' : initKind === 'expression' ? '#fbbf24' : '#94a3b8',
                textDecoration: isEditable ? 'underline dotted' : 'none',
                maxWidth: '120px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                display: 'inline-block',
              }}
            >
              {String(init).length > 22 ? String(init).slice(0, 19) + '…' : String(init)}
            </span>
          )}
        </div>
      )}

      {/* Live value */}
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: '#64748b', fontSize: '10px' }}>value</span>
        <span style={{
          color: '#38bdf8',
          fontWeight: 'bold',
          fontSize: '13px',
          background: '#0c1a2e',
          padding: '2px 8px',
          borderRadius: '4px',
          maxWidth: '100px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {value !== null && value !== undefined ? formatValue(value) : '—'}
        </span>
      </div>

      <Handle type="target" position={Position.Left} id="input"
        style={{ background: '#0ea5e9', width: 10, height: 10 }} />
      <Handle type="source" position={Position.Right} id="output"
        style={{ background: '#38bdf8', width: 10, height: 10 }} />
    </div>
  );
});

function formatValue(val) {
  if (val === undefined) return 'undefined';
  if (val === null) return 'null';
  if (typeof val === 'function') return 'fn()';
  if (typeof val === 'object') {
    try { return JSON.stringify(val).slice(0, 30); } catch { return '[obj]'; }
  }
  return String(val).slice(0, 30);
}

VariableNode.displayName = 'VariableNode';
export default VariableNode;
