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

const nodeTypes = {
  functionNode: FunctionNode,
  variableNode: VariableNode,
};

function buildFlowNodes(parsedNodes, bindings) {
  return parsedNodes.map(n => ({
    id: n.id,
    type: n.type === 'function' ? 'functionNode' : 'variableNode',
    position: { x: n.x, y: n.y },
    data: {
      label: n.label,
      params: n.params,
      value: bindings[n.id],
      init: n.init,
      liveValues: {},
    },
  }));
}

function buildFlowEdges(parsedEdges) {
  return parsedEdges.map(e => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: e.animated,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#7c3aed' },
    style: { stroke: '#7c3aed', strokeWidth: 2 },
    labelStyle: { fill: '#e2e8f0', fontSize: 10 },
    labelBgStyle: { fill: '#1e1e2e', fillOpacity: 0.8 },
  }));
}

export default function FlowCanvas({ parsedNodes, parsedEdges, viewport, bindings, onNodePositionChange }) {
  const [nodes, setNodes, onNodesChange] = useNodesState(buildFlowNodes(parsedNodes, bindings));
  const [edges, setEdges, onEdgesChange] = useEdgesState(buildFlowEdges(parsedEdges));

  // Sync when parsed data changes
  useEffect(() => {
    setNodes(prev => {
      const newNodes = buildFlowNodes(parsedNodes, bindings);
      // Preserve positions that were manually dragged
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
          nodeColor={n => n.type === 'functionNode' ? '#7c3aed' : '#0ea5e9'}
        />
      </ReactFlow>
    </div>
  );
}
