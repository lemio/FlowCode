import { memo } from 'react';
import { Handle, Position } from 'reactflow';

const VariableNode = memo(({ data }) => {
  const { label, value, init } = data;
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
      {/* Init expression */}
      {init && (
        <div style={{ padding: '6px 10px', color: '#94a3b8', fontSize: '11px', borderBottom: '1px solid #374151' }}>
          = {init.length > 30 ? init.slice(0, 30) + '…' : init}
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
      {/* Input handle (reference connections come in here) */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ background: '#0ea5e9', width: 10, height: 10 }}
      />
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ background: '#38bdf8', width: 10, height: 10 }}
      />
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
