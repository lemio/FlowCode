import { memo } from 'react';
import { Handle, Position } from 'reactflow';

const CallNode = memo(({ data }) => {
  const { label, callee, args, value, fnParams } = data;

  // Use the connected function's param names when available; fall back to arg0, arg1, …
  const paramNames = fnParams && fnParams.length > 0
    ? fnParams
    : (args || []).map((_, i) => `arg${i}`);

  return (
    <div style={{
      background: '#1e1e2e',
      border: '2px solid #059669',
      borderRadius: '8px',
      minWidth: '190px',
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#e2e8f0',
      boxShadow: '0 4px 12px rgba(5,150,105,0.3)',
    }}>
      {/* Header */}
      <div style={{
        background: '#059669',
        padding: '6px 10px',
        borderRadius: '6px 6px 0 0',
        fontSize: '12px',
        display: 'flex',
        alignItems: 'baseline',
        gap: '4px',
        flexWrap: 'wrap',
      }}>
        <span style={{ opacity: 0.75, fontSize: '10px' }}>let</span>
        <span style={{ fontWeight: 'bold' }}>{label}</span>
        <span style={{ opacity: 0.75 }}>=</span>
        <span style={{ color: '#a7f3d0', fontWeight: 'bold' }}>{callee}</span>
        <span style={{ opacity: 0.75 }}>(…)</span>
      </div>

      {/* Function input row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '5px 10px 5px 16px',
        position: 'relative',
        borderBottom: '1px solid #1f2937',
      }}>
        <Handle
          type="target"
          position={Position.Left}
          id="fn"
          style={{ top: 'auto', left: -8, background: '#10b981', width: 10, height: 10 }}
        />
        <span style={{ fontSize: '10px', color: '#6b7280', marginRight: '6px' }}>fn:</span>
        <span style={{ color: '#a7f3d0' }}>{callee}</span>
      </div>

      {/* Argument rows */}
      {paramNames.map((param, i) => {
        const arg = (args || [])[i];
        const isIdent = arg && arg.kind === 'identifier';
        const argVal = arg ? arg.value : '?';
        return (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            padding: '4px 10px 4px 16px',
            position: 'relative',
          }}>
            {isIdent && (
              <Handle
                type="target"
                position={Position.Left}
                id={`arg-${i}`}
                style={{ top: 'auto', left: -8, background: '#0ea5e9', width: 10, height: 10 }}
              />
            )}
            <span style={{ fontSize: '10px', color: '#6b7280', marginRight: '4px' }}>{param}:</span>
            <span style={{ color: isIdent ? '#7dd3fc' : '#94a3b8' }}>{argVal}</span>
          </div>
        );
      })}

      {/* Live value */}
      <div style={{
        borderTop: '1px solid #374151',
        padding: '5px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <span style={{ color: '#6b7280', fontSize: '10px' }}>value</span>
        <span style={{
          color: '#34d399',
          fontWeight: 'bold',
          fontSize: '13px',
          background: '#052e16',
          padding: '1px 6px',
          borderRadius: '4px',
          maxWidth: '110px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {value !== null && value !== undefined ? formatValue(value) : '—'}
        </span>
      </div>

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

CallNode.displayName = 'CallNode';
export default CallNode;
