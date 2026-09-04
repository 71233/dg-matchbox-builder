'use client';

import { useMemo, useState } from 'react';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Connection,
  type NodeProps,
} from '@xyflow/react';
import { Plus, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NODE_BY_ID, NODE_CATALOG } from '@/lib/matchbox/catalog';
import type { NodeDefinition, ProjectNode } from '@/lib/matchbox/types';
import { useProjectStore } from '@/lib/store/project-store';

interface MatchboxNodeData extends Record<string, unknown> {
  projectNode: ProjectNode;
  definition: NodeDefinition;
}

export function GraphEditor() {
  const {
    project,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode,
    setGraphOpen,
    addNode,
  } = useProjectStore();
  const [search, setSearch] = useState('');
  const nodes = useMemo(
    () =>
      project.nodes.map((projectNode) => ({
        id: projectNode.id,
        position: projectNode.position,
        type: 'matchbox',
        data: {
          projectNode,
          definition: NODE_BY_ID.get(projectNode.definitionId)!,
        },
      })),
    [project.nodes],
  );
  const edges = useMemo(
    () =>
      project.edges.map((edge) => ({
        ...edge,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#b8612a', strokeWidth: 1.5 },
      })),
    [project.edges],
  );
  const filtered = NODE_CATALOG.filter((entry) =>
    entry.label.en.toLowerCase().includes(search.toLowerCase()),
  );
  const valid = (connection: Connection) => {
    if (
      !connection.source ||
      !connection.target ||
      connection.source === connection.target
    )
      return false;
    const source = project.nodes.find(
      (entry) => entry.id === connection.source,
    );
    const target = project.nodes.find(
      (entry) => entry.id === connection.target,
    );
    const sourcePort =
      source &&
      NODE_BY_ID.get(source.definitionId)?.outputs.find(
        (port) => port.id === connection.sourceHandle,
      );
    const targetPort =
      target &&
      NODE_BY_ID.get(target.definitionId)?.inputs.find(
        (port) => port.id === connection.targetHandle,
      );
    const inputAvailable = !project.edges.some(
      (edge) =>
        edge.target === connection.target &&
        edge.targetHandle === connection.targetHandle,
    );
    const passDirectionValid = Boolean(
      source && target && source.pass <= target.pass,
    );
    const reachesSource = (
      nodeId: string,
      visited = new Set<string>(),
    ): boolean => {
      if (nodeId === connection.source) return true;
      if (visited.has(nodeId)) return false;
      visited.add(nodeId);
      return project.edges
        .filter((edge) => edge.source === nodeId)
        .some((edge) => reachesSource(edge.target, visited));
    };
    return Boolean(
      sourcePort &&
      targetPort &&
      inputAvailable &&
      passDirectionValid &&
      !reachesSource(connection.target) &&
      (sourcePort.type === targetPort.type ||
        (sourcePort.type === 'matte' && targetPort.type === 'image')),
    );
  };
  return (
    <div className="absolute inset-0 z-30 flex bg-[#0c0d0f]">
      <aside className="w-64 shrink-0 border-r border-[#2d3037] bg-[#15171b] p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#767c86]">
              Node library
            </p>
            <h2 className="text-sm font-semibold">Add a node</h2>
          </div>
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={() => setGraphOpen(false)}
            aria-label="Close graph"
          >
            <X />
          </Button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[#717681]" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-8 border-[#343840] bg-[#101215] pl-7 text-xs"
            placeholder="Search"
          />
        </div>
        <div className="max-h-[calc(100vh-130px)] space-y-1 overflow-y-auto pr-1">
          {filtered.map((definition) => (
            <button
              key={definition.id}
              onClick={() => addNode(definition.id)}
              className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left hover:border-[#3a3e46] hover:bg-[#202329]"
            >
              <span className="grid size-6 place-items-center rounded bg-[#29231f] text-[#f18a46]">
                <Plus className="size-3" />
              </span>
              <span>
                <span className="block text-xs font-medium">
                  {definition.label.en}
                </span>
                <span className="block text-[9px] uppercase text-[#6f7580]">
                  {definition.category} · {definition.cost}
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>
      <div className="relative flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={{ matchbox: MatchboxNode }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={valid}
          onNodeClick={(_, node) => selectNode(node.id)}
          fitView
          colorMode="dark"
          deleteKeyCode={['Backspace', 'Delete']}
        >
          <Background color="#2c3037" gap={22} size={1} />
          <Controls className="border-[#3a3e46]! bg-[#191b20]! fill-white!" />
          <MiniMap
            className="border border-[#343840]! bg-[#14161a]!"
            maskColor="rgb(0 0 0 / 55%)"
            nodeColor="#ff7a1a"
          />
        </ReactFlow>
        <div className="pointer-events-none absolute left-4 top-4 rounded-md border border-[#373a42] bg-[#14161a]/90 px-3 py-2 backdrop-blur">
          <p className="text-xs font-semibold">{project.title}</p>
          <p className="mt-0.5 text-[10px] text-[#7c828c]">
            {nodes.length}/50 nodes ·{' '}
            {new Set(project.nodes.map((entry) => entry.pass)).size}/4 passes
          </p>
        </div>
      </div>
    </div>
  );
}

function MatchboxNode({ data, selected }: NodeProps) {
  const { projectNode, definition } = data as MatchboxNodeData;
  return (
    <div
      className={`min-w-40 rounded-lg border bg-[#1c1f24] shadow-lg ${selected ? 'border-[#ff7a1a] shadow-[0_0_0_2px_rgb(255_122_26/15%)]' : 'border-[#3a3e46]'}`}
    >
      <div className="flex items-center justify-between border-b border-[#343840] px-3 py-2">
        <span className="text-xs font-semibold">{definition.label.en}</span>
        <span className="rounded bg-[#292c32] px-1.5 py-0.5 text-[8px] uppercase text-[#8d929c]">
          P{projectNode.pass}
        </span>
      </div>
      <div className="relative min-h-10 px-3 py-2">
        {definition.inputs.map((input, index) => (
          <div
            key={input.id}
            className="relative flex h-5 items-center text-[9px] text-[#8d929c]"
          >
            <Handle
              id={input.id}
              type="target"
              position={Position.Left}
              className="-left-[17px]! size-2.5! border-[#17191d]! bg-[#74b9d4]!"
              style={{ top: 11 + index * 20 }}
            />
            {input.id}
          </div>
        ))}
        {definition.outputs.map((output, index) => (
          <div
            key={output.id}
            className="relative flex h-5 items-center justify-end text-[9px] text-[#8d929c]"
          >
            {output.id}
            <Handle
              id={output.id}
              type="source"
              position={Position.Right}
              className="-right-[17px]! size-2.5! border-[#17191d]! bg-[#ff8a3d]!"
              style={{ top: 11 + index * 20 }}
            />
          </div>
        ))}
        {!definition.inputs.length && !definition.outputs.length && (
          <span className="text-[9px] text-[#666c76]">No ports</span>
        )}
      </div>
    </div>
  );
}
