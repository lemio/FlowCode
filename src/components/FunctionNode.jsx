import { memo } from 'react';
import { Handle, Position } from 'reactflow';

const FunctionNode = memo(({ data }) => {
  const { label, params, value, liveValues } = data;
  return (
    <div style={{
      background: '#1e1e2e',
      border: '2px solid #7c3aed',
      borderRadius: '8px',
      minWidth: '160px',
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#e2e8f0',
      boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
    }}>
      {/* Header */}
      <div style={{
        background: '#7c3aed',
        padding: '6px 10px',
        borderRadius: '6px 6px 0 0',
        fontWeight: 'bold',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}>
        <span style={{ opacity: 0.8, fontSize: '10px' }}>ƒ</span>
        {label}
      </div>
      {/* Params */}
      <div style={{ padding: '8px 10px' }}>
        {params && params.length > 0 ? (
          params.map((param, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: '4px', position: 'relative' }}>
              <Handle
                type="target"
                position={Position.Left}
                id={`param-${param}`}
                style={{ top: 'auto', left: -8, background: '#a78bfa', width: 10, height: 10 }}
              />
              <span style={{ marginLeft: '8px', color: '#a78bfa' }}>{param}</span>
              {liveValues && liveValues[param] !== undefined && (
                <span style={{
                  marginLeft: 'auto',
                  background: '#2d1b69',
                  color: '#c4b5fd',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  fontSize: '10px',
                  maxWidth: '80px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {formatValue(liveValues[param])}
                </span>
              )}
            </div>
          ))
        ) : (
          <span style={{ color: '#64748b', fontSize: '11px' }}>no params</span>
        )}
      </div>
      {/* Return value */}
      {value !== undefined && value !== null && (
        <div style={{
          borderTop: '1px solid #374151',
          padding: '4px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{ color: '#64748b', fontSize: '10px' }}>returns</span>
          <span style={{ color: '#34d399', fontSize: '11px', fontWeight: 'bold' }}>
            {formatValue(value)}
          </span>
        </div>
      )}
      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ background: '#34d399', width: 10, height: 10 }}
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

FunctionNode.displayName = 'FunctionNode';
export default FunctionNode;
