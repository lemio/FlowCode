import { memo } from 'react';
import { Handle, Position } from 'reactflow';

const FunctionNode = memo(({ data }) => {
  const { label, params, bodyLines } = data;
  return (
    <div style={{
      background: '#1e1e2e',
      border: '2px solid #7c3aed',
      borderRadius: '8px',
      minWidth: '200px',
      maxWidth: '300px',
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
        alignItems: 'baseline',
        gap: '6px',
      }}>
        <span style={{ opacity: 0.8, fontSize: '10px' }}>ƒ</span>
        {label}
        {params && params.length > 0 && (
          <span style={{ opacity: 0.65, fontWeight: 'normal', fontSize: '11px' }}>
            ({params.join(', ')})
          </span>
        )}
      </div>

      {/* Body: one row per statement */}
      {bodyLines && bodyLines.length > 0 ? (
        <div style={{
          background: '#111827',
          padding: '6px 10px',
          borderRadius: '0 0 6px 6px',
          maxHeight: '140px',
          overflowY: 'auto',
        }}>
          {bodyLines.map((line, i) => (
            <div key={i} style={{
              fontFamily: "'Fira Code', 'Cascadia Code', monospace",
              fontSize: '11px',
              color: '#94a3b8',
              padding: '1px 0',
              whiteSpace: 'pre',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {line}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '6px 10px', color: '#475569', fontSize: '11px' }}>
          (empty body)
        </div>
      )}

      {/* Output handle — connect FROM this node TO a call node */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ background: '#a78bfa', width: 10, height: 10 }}
      />
    </div>
  );
});

FunctionNode.displayName = 'FunctionNode';
export default FunctionNode;
