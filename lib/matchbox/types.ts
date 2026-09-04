export type Locale = 'ja' | 'en';
export type PortType = 'image' | 'matte' | 'number' | 'color' | 'time';
export type NodeCategory =
  | 'io'
  | 'color'
  | 'composite'
  | 'matte'
  | 'transform'
  | 'generator';

export interface ParameterDefinition {
  id: string;
  label: { ja: string; en: string };
  tooltip: { ja: string; en: string };
  kind: 'float' | 'boolean' | 'color' | 'select';
  defaultValue: number | boolean | string;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ label: string; value: string }>;
}

export interface NodeDefinition {
  id: string;
  version: 1;
  category: NodeCategory;
  label: { ja: string; en: string };
  description: { ja: string; en: string };
  inputs: Array<{ id: string; type: PortType; required?: boolean }>;
  outputs: Array<{ id: string; type: PortType }>;
  parameters: ParameterDefinition[];
  cost: 'low' | 'medium' | 'high';
}

export interface ProjectNode {
  id: string;
  definitionId: string;
  position: { x: number; y: number };
  pass: number;
  parameters: Record<string, number | boolean | string>;
}

export interface ProjectEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

export interface ExposedParameter {
  id: string;
  nodeId: string;
  parameterId: string;
  displayName: string;
  tooltip: string;
  page: number;
  column: number;
  row: number;
  min?: number;
  max?: number;
  step?: number;
}

export interface ProjectV1 {
  schemaVersion: 1;
  generatorVersion: '0.1.0';
  id: string;
  title: string;
  description: string;
  category: NodeCategory;
  target: 'flame-2025.1+';
  locale: Locale;
  nodes: ProjectNode[];
  edges: ProjectEdge[];
  exposedParameters: ExposedParameter[];
  parentProjectId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  nodeId?: string;
  suggestion?: string;
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
  browserCompile: 'pending' | 'passed' | 'failed' | 'unavailable';
  flameMac: 'untested' | 'passed' | 'failed';
  flameLinux: 'untested' | 'passed' | 'failed';
}
