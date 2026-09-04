import { NODE_BY_ID } from './catalog';
import type { ProjectV1 } from './types';

export function instantiateProject(
  template: ProjectV1,
  locale: ProjectV1['locale'] = 'en',
): ProjectV1 {
  const id =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `project-${Date.now()}`;
  const timestamp = new Date().toISOString();
  const nodes = template.nodes.map((entry) => ({
    ...entry,
    id: `${entry.definitionId}-${id.slice(0, 8)}-${entry.id.split('-').at(-1)}`,
    position: { ...entry.position },
    parameters: { ...entry.parameters },
  }));
  const idMap = new Map(
    template.nodes.map((entry, index) => [entry.id, nodes[index].id]),
  );
  let controlIndex = 0;
  const exposedParameters = nodes.flatMap((entry) =>
    (NODE_BY_ID.get(entry.definitionId)?.parameters ?? []).map((parameter) => {
      const index = controlIndex++;
      return {
        id: `${entry.id}:${parameter.id}`,
        nodeId: entry.id,
        parameterId: parameter.id,
        displayName: parameter.label[locale],
        tooltip: parameter.tooltip[locale],
        page: Math.floor(index / 30),
        column: Math.floor((index % 30) / 5),
        row: index % 5,
        min: parameter.min,
        max: parameter.max,
        step: parameter.step,
      };
    }),
  );
  return {
    ...template,
    id,
    locale,
    nodes,
    edges: template.edges.map((edge) => ({
      ...edge,
      id: `${edge.id}-${id.slice(0, 8)}`,
      source: idMap.get(edge.source) ?? edge.source,
      target: idMap.get(edge.target) ?? edge.target,
    })),
    exposedParameters,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function sanitizedProjectName(title: string) {
  const cleaned =
    title
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48) || 'Untitled';
  return cleaned.startsWith('DG_') ? cleaned : `DG_${cleaned}`;
}
