import { z } from 'zod';
import { NODE_BY_ID } from './catalog';
import type { ProjectV1, ValidationIssue, ValidationReport } from './types';

const projectSchema = z.object({
  schemaVersion: z.literal(1),
  generatorVersion: z.literal('0.1.0'),
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(80),
  description: z.string().max(2000),
  category: z.enum([
    'io',
    'color',
    'composite',
    'matte',
    'transform',
    'generator',
  ]),
  target: z.literal('flame-2025.1+'),
  locale: z.enum(['ja', 'en']),
  nodes: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        definitionId: z.string().min(1).max(60),
        position: z.object({ x: z.number(), y: z.number() }),
        pass: z.number().int().min(1).max(4),
        parameters: z.record(
          z.string(),
          z.union([z.number(), z.boolean(), z.string().max(100)]),
        ),
      }),
    )
    .max(50),
  edges: z
    .array(
      z.object({
        id: z.string(),
        source: z.string(),
        sourceHandle: z.string(),
        target: z.string(),
        targetHandle: z.string(),
      }),
    )
    .max(150),
  exposedParameters: z
    .array(
      z.object({
        id: z.string(),
        nodeId: z.string(),
        parameterId: z.string(),
        displayName: z.string().max(80),
        tooltip: z.string().max(300),
        page: z.number().int().min(0).max(6),
        column: z.number().int().min(0).max(5),
        row: z.number().int().min(0).max(4),
        min: z.number().optional(),
        max: z.number().optional(),
        step: z.number().positive().optional(),
      }),
    )
    .max(105),
  parentProjectId: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const parseProject = (value: unknown): ProjectV1 =>
  projectSchema.parse(value) as ProjectV1;

export function validateProject(project: ProjectV1): ValidationReport {
  const issues: ValidationIssue[] = [];
  const parsed = projectSchema.safeParse(project);
  if (!parsed.success) {
    for (const issue of parsed.error.issues)
      issues.push({
        severity: 'error',
        code: 'SCHEMA',
        message: `${issue.path.join('.')}: ${issue.message}`,
      });
    return report(issues);
  }

  const nodeIds = new Set(project.nodes.map((entry) => entry.id));
  if (nodeIds.size !== project.nodes.length)
    issues.push({
      severity: 'error',
      code: 'DUPLICATE_NODE',
      message: 'Node IDs must be unique.',
    });
  const outputs = project.nodes.filter(
    (entry) => entry.definitionId === 'output',
  );
  if (outputs.length !== 1)
    issues.push({
      severity: 'error',
      code: 'OUTPUT_COUNT',
      message: 'A project must contain exactly one Output node.',
    });
  if (new Set(project.nodes.map((entry) => entry.pass)).size > 4)
    issues.push({
      severity: 'error',
      code: 'PASS_LIMIT',
      message: 'A project may use at most four passes.',
    });

  for (const entry of project.nodes) {
    const definition = NODE_BY_ID.get(entry.definitionId);
    if (!definition) {
      issues.push({
        severity: 'error',
        code: 'UNKNOWN_NODE',
        message: `Unknown node: ${entry.definitionId}`,
        nodeId: entry.id,
      });
      continue;
    }
    for (const parameter of definition.parameters) {
      const value = entry.parameters[parameter.id] ?? parameter.defaultValue;
      if (
        typeof value === 'number' &&
        ((parameter.min !== undefined && value < parameter.min) ||
          (parameter.max !== undefined && value > parameter.max))
      ) {
        issues.push({
          severity: 'error',
          code: 'PARAMETER_RANGE',
          message: `${definition.label.en}: ${parameter.label.en} is outside its safe range.`,
          nodeId: entry.id,
          suggestion: `Use ${parameter.min}–${parameter.max}.`,
        });
      }
    }
  }

  const occupiedUiCells = new Set<string>();
  for (const exposed of project.exposedParameters) {
    const node = project.nodes.find((entry) => entry.id === exposed.nodeId);
    const parameter =
      node &&
      NODE_BY_ID.get(node.definitionId)?.parameters.find(
        (entry) => entry.id === exposed.parameterId,
      );
    if (!node || !parameter) {
      issues.push({
        severity: 'error',
        code: 'UNKNOWN_EXPOSED_PARAMETER',
        message: `Published control ${exposed.id} does not reference a known parameter.`,
      });
      continue;
    }
    if (
      exposed.min !== undefined &&
      exposed.max !== undefined &&
      exposed.min > exposed.max
    )
      issues.push({
        severity: 'error',
        code: 'UI_RANGE',
        message: `${exposed.displayName} has a minimum greater than its maximum.`,
        nodeId: node.id,
      });
    const cell = `${exposed.page}:${exposed.column}:${exposed.row}`;
    if (occupiedUiCells.has(cell))
      issues.push({
        severity: 'error',
        code: 'UI_COLLISION',
        message: `Two Flame controls occupy page ${exposed.page + 1}, column ${exposed.column + 1}, row ${exposed.row + 1}.`,
        nodeId: node.id,
        suggestion: 'Move one control to an empty Flame UI cell.',
      });
    occupiedUiCells.add(cell);
  }

  const adjacency = new Map<string, string[]>();
  const occupiedInputs = new Set<string>();
  for (const edge of project.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({
        severity: 'error',
        code: 'DANGLING_EDGE',
        message: `Edge ${edge.id} references a missing node.`,
      });
      continue;
    }
    const source = project.nodes.find((entry) => entry.id === edge.source);
    const target = project.nodes.find((entry) => entry.id === edge.target);
    const sourceDefinition = source
      ? NODE_BY_ID.get(source.definitionId)
      : undefined;
    const targetDefinition = target
      ? NODE_BY_ID.get(target.definitionId)
      : undefined;
    const inputKey = `${edge.target}:${edge.targetHandle}`;
    if (occupiedInputs.has(inputKey))
      issues.push({
        severity: 'error',
        code: 'MULTIPLE_INPUT',
        message: `Input ${edge.targetHandle} accepts one connection.`,
        nodeId: edge.target,
      });
    occupiedInputs.add(inputKey);
    if (source && target && source.pass > target.pass)
      issues.push({
        severity: 'error',
        code: 'PASS_DIRECTION',
        message: 'A connection cannot travel backward to an earlier pass.',
        nodeId: edge.target,
        suggestion: `Move the target to pass ${source.pass} or later.`,
      });
    const sourcePort =
      sourceDefinition?.outputs.find((port) => port.id === edge.sourceHandle) ??
      sourceDefinition?.outputs[0];
    const targetPort =
      targetDefinition?.inputs.find((port) => port.id === edge.targetHandle) ??
      targetDefinition?.inputs[0];
    if (
      !sourcePort ||
      !targetPort ||
      (sourcePort.type !== targetPort.type &&
        !(sourcePort.type === 'matte' && targetPort.type === 'image'))
    ) {
      issues.push({
        severity: 'error',
        code: 'PORT_TYPE',
        message: `Edge ${edge.id} connects incompatible ports.`,
      });
    }
    adjacency.set(edge.source, [
      ...(adjacency.get(edge.source) ?? []),
      edge.target,
    ]);
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const walk = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of adjacency.get(id) ?? []) if (walk(next)) return true;
    visiting.delete(id);
    visited.add(id);
    return false;
  };
  if (project.nodes.some((entry) => walk(entry.id)))
    issues.push({
      severity: 'error',
      code: 'CYCLE',
      message: 'Cycles are not supported in the public beta.',
    });

  for (const entry of project.nodes) {
    const definition = NODE_BY_ID.get(entry.definitionId);
    for (const input of definition?.inputs ?? []) {
      if (
        input.required &&
        !project.edges.some(
          (edge) => edge.target === entry.id && edge.targetHandle === input.id,
        )
      )
        issues.push({
          severity: 'error',
          code: 'MISSING_INPUT',
          message: `${definition?.label.en} requires ${input.id}.`,
          nodeId: entry.id,
        });
    }
  }

  const samplerCount = project.nodes.filter((entry) =>
    ['front', 'back', 'matte-input'].includes(entry.definitionId),
  ).length;
  if (samplerCount > 6)
    issues.push({
      severity: 'error',
      code: 'SAMPLER_LIMIT',
      message: 'Flame supports at most six image inputs.',
    });
  if (!issues.length)
    issues.push({
      severity: 'info',
      code: 'STRUCTURE_OK',
      message:
        'Project structure is ready for browser and shader_builder checks.',
    });
  return report(issues);
}

const report = (issues: ValidationIssue[]): ValidationReport => ({
  valid: !issues.some((issue) => issue.severity === 'error'),
  issues,
  browserCompile: 'pending',
  flameMac: 'untested',
  flameLinux: 'untested',
});
