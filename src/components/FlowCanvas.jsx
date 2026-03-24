import { useCallback, useEffect } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import FunctionNode from './FunctionNode';
import VariableNode from './VariableNode';
import CallNode from './CallNode';

const nodeTypes = {
  functionNode: FunctionNode,
  variableNode: VariableNode,
  callNode: CallNode,
};

function buildFlowNodes(parsedNodes, bindings) {
  // Build function lookup for fnParams on call nodes
  const fnMap = {};
  parsedNodes.forEach(n => { if (n.type === 'function') fnMap[n.id] = n; });

  return parsedNodes.map(n => {
    let nodeType = 'variableNode';
    if (n.type === 'function') nodeType = 'functionNode';
    if (n.type === 'call') nodeType = 'callNode';

    const data = { label: n.label, value: bindings[n.id] };

    if (n.type === 'function') {
      data.params = n.params;
      data.bodyLines = n.bodyLines;
    }
    if (n.type === 'variable') {
      data.init = n.init;
    }
    if (n.type === 'call') {
      data.callee = n.callee;
      data.args = n.args;
      const fn = fnMap[n.callee];
      data.fnParams = fn ? fn.params : null;
    }

    return {
      id: n.id,
      type: nodeType,
      position: { x: n.x, y: n.y },
      data,
    };
  });
}

function buildFlowEdges(parsedEdges) {
  return parsedEdges.map(e => {
    const isFn = e.edgeType === 'fn';
    const isArg = e.edgeType === 'arg';
    const color = isFn ? '#10b981' : (isArg ? '#0ea5e9' : '#7c3aed');
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
      ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
      label: e.label || '',
      animated: !!e.animated,
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: { stroke: color, strokeWidth: 2 },
      labelStyle: { fill: '#e2e8f0', fontSize: 10 },
      labelBgStyle: { fill: '#1e1e2e', fillOpacity: 0.8 },
    };
  });
}

export default function FlowCanvas({ parsedNodes, parsedEdges, viewport, bindings, onNodePositionChange }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(buildFlowNodes(parsedNodes, bindings));
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildFlowEdges(parsedEdges));

  // Sync when parsed data changes, preserving manually-dragged positions
  useEffect(() => {
    setNodes(prev => {
      const newNodes = buildFlowNodes(parsedNodes, bindings);
      return newNodes.map(n => {
        const existing = prev.find(p => p.id === n.id);
        return existing ? { ...n, position: existing.position } : n;
      });
    });
  }, [parsedNodes, bindings, setNodes]);

  useEffect(() => {
    setEdges(buildFlowEdges(parsedEdges));
  }, [parsedEdges, setEdges]);

  const onNodeDragStop = useCallback((event, node) => {
    onNodePositionChange && onNodePositionChange(node.id, node.position.x, node.position.y);
  }, [onNodePositionChange]);

  const defaultViewport = viewport
    ? { x: -viewport.x, y: -viewport.y, zoom: 1 }
    : { x: 50, y: 50, zoom: 1 };

  return (
    <div style={{ width: '100%', height: '100%', background: '#0f172a' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        defaultViewport={defaultViewport}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#1e293b" gap={20} />
        <Controls style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }} />
        <MiniMap
          style={{ background: '#1e293b', border: '1px solid #334155' }}
          nodeColor={n => {
            if (n.type === 'functionNode') return '#7c3aed';
            if (n.type === 'callNode') return '#059669';
            return '#0ea5e9';
          }}
        />
      </ReactFlow>
    </div>
  );
}
