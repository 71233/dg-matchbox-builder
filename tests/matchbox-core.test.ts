import { describe, expect, it } from 'vitest';
import { generateShader } from '@/lib/matchbox/generator';
import { instantiateProject } from '@/lib/matchbox/project';
import { TEMPLATES } from '@/lib/matchbox/templates';
import { validateProject } from '@/lib/matchbox/validation';
import { buildExport } from '@/lib/matchbox/export';
import { sanitizedProjectName } from '@/lib/matchbox/project';

describe('ProjectV1 templates', () => {
  it.each(TEMPLATES)('$id is structurally valid', (template) => {
    const report = validateProject(instantiateProject(template.project));
    expect(report.issues.filter((issue) => issue.severity === 'error')).toEqual(
      [],
    );
    expect(report.valid).toBe(true);
  });

  it('rejects cycles and missing outputs', () => {
    const project = instantiateProject(TEMPLATES[0].project);
    project.edges.push({
      id: 'cycle',
      source: project.nodes[1].id,
      sourceHandle: 'image',
      target: project.nodes[0].id,
      targetHandle: 'image',
    });
    project.nodes = project.nodes.filter(
      (entry) => entry.definitionId !== 'output',
    );
    const codes = validateProject(project).issues.map((issue) => issue.code);
    expect(codes).toContain('OUTPUT_COUNT');
    expect(codes).toContain('CYCLE');
  });

  it('rejects backward pass connections and duplicate inputs', () => {
    const project = instantiateProject(TEMPLATES[0].project);
    const [front, exposure, contrast] = project.nodes;
    front.pass = 2;
    exposure.pass = 1;
    project.edges.push({
      id: 'duplicate',
      source: front.id,
      sourceHandle: 'image',
      target: contrast.id,
      targetHandle: 'image',
    });
    const codes = validateProject(project).issues.map((issue) => issue.code);
    expect(codes).toContain('PASS_DIRECTION');
    expect(codes).toContain('MULTIPLE_INPUT');
  });

  it('rejects unknown nodes and unsafe parameter ranges', () => {
    const project = instantiateProject(TEMPLATES[0].project);
    project.nodes[0].definitionId = 'arbitrary-glsl';
    project.nodes[1].parameters.stops = 999;
    const codes = validateProject(project).issues.map((issue) => issue.code);
    expect(codes).toContain('UNKNOWN_NODE');
    expect(codes).toContain('PARAMETER_RANGE');
  });
});

describe('dual shader generation', () => {
  it('emits modern Flame and WebGL sources from one project', () => {
    const project = instantiateProject(TEMPLATES[0].project);
    const generated = generateShader(project);
    expect(generated.flame).toContain('#version 430');
    expect(generated.flame).toContain(
      'layout(location = 0) out vec4 fragColor',
    );
    expect(generated.webgl).toContain('#version 300 es');
    expect(generated.xml).toContain('<ShaderNodePreset');
    expect(generated.xml).toContain('GL_CLAMP_TO_EDGE');
  });

  it('escapes user-controlled XML metadata', () => {
    const project = instantiateProject(TEMPLATES[0].project);
    project.title = 'Grade <Warm> & "Soft"';
    expect(generateShader(project).xml).toContain(
      'Grade &lt;Warm&gt; &amp; &quot;Soft&quot;',
    );
  });

  it('emits only published controls with their custom Flame UI layout', () => {
    const project = instantiateProject(TEMPLATES[0].project);
    const exposure = project.nodes.find(
      (node) => node.definitionId === 'exposure',
    );
    expect(exposure).toBeDefined();
    project.exposedParameters = [
      {
        id: 'published-exposure',
        nodeId: exposure!.id,
        parameterId: 'stops',
        displayName: 'Hero Exposure',
        tooltip: 'Adjust the hero plate',
        page: 1,
        column: 2,
        row: 3,
        min: -2,
        max: 2,
        step: 0.1,
      },
    ];
    const xml = generateShader(project).xml;
    expect(xml).toContain('DisplayName="Hero Exposure"');
    expect(xml).toContain('Tooltip="Adjust the hero plate"');
    expect(xml).toContain('Page="1"');
    expect(xml).toContain('Col="2"');
    expect(xml).toContain('Row="3"');
    expect(xml).toContain('Min="-2" Max="2" Inc="0.1"');
    expect(xml).not.toContain('DisplayName="Contrast"');
  });
});

describe('Flame UI validation', () => {
  it('rejects two published controls in the same cell', () => {
    const project = instantiateProject(TEMPLATES[0].project);
    const first = project.exposedParameters[0];
    const second = project.exposedParameters[1];
    second.page = first.page;
    second.column = first.column;
    second.row = first.row;
    expect(
      validateProject(project).issues.map((issue) => issue.code),
    ).toContain('UI_COLLISION');
  });
});

describe('export bundle', () => {
  it('is deterministic for the same project', async () => {
    const project = instantiateProject(TEMPLATES[0].project);
    const first = await buildExport(project);
    const second = await buildExport(project);
    expect(first.sha256).toBe(second.sha256);
    expect(first.files).toContain(`${first.basename}.glsl`);
    expect(first.files).toContain('validate-and-install.command');
  });

  it('normalizes hostile filenames into a DG-prefixed basename', () => {
    expect(sanitizedProjectName('../../My <Shader>')).toBe('DG_My_Shader');
  });
});
