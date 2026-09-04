import { NODE_BY_ID } from './catalog';
import type { ParameterDefinition, ProjectNode, ProjectV1 } from './types';

const safe = (value: string) =>
  value.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^([0-9])/, '_$1');
const uniformName = (node: ProjectNode, parameter: ParameterDefinition) =>
  `u_${safe(node.id)}_${safe(parameter.id)}`;
const hexToVec3 = (value: unknown) => {
  const hex =
    typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)
      ? value.slice(1)
      : 'ff7a1a';
  return [0, 2, 4].map((offset) =>
    (parseInt(hex.slice(offset, offset + 2), 16) / 255).toFixed(6),
  );
};

export interface GeneratedShader {
  flame: string;
  webgl: string;
  xml: string;
  uniformValues: Record<string, number | boolean | number[]>;
}

export function generateShader(project: ProjectV1): GeneratedShader {
  const parameters = project.nodes.flatMap((projectNode) =>
    (NODE_BY_ID.get(projectNode.definitionId)?.parameters ?? []).map(
      (parameter) => ({ projectNode, parameter }),
    ),
  );
  const values: GeneratedShader['uniformValues'] = {};
  for (const { projectNode, parameter } of parameters) {
    const value =
      projectNode.parameters[parameter.id] ?? parameter.defaultValue;
    values[uniformName(projectNode, parameter)] =
      parameter.kind === 'color'
        ? hexToVec3(value).map(Number)
        : (value as number | boolean);
  }
  const common = buildFunctions(project);
  const flameParams =
    parameters
      .map(
        ({ projectNode, parameter }) =>
          `    ${parameter.kind === 'boolean' ? 'bool' : parameter.kind === 'color' ? 'vec3' : 'float'} ${uniformName(projectNode, parameter)};`,
      )
      .join('\n') || '    float dg_no_parameters;';
  const webParams = parameters
    .map(
      ({ projectNode, parameter }) =>
        `uniform ${parameter.kind === 'boolean' ? 'bool' : parameter.kind === 'color' ? 'vec3' : 'float'} ${uniformName(projectNode, parameter)};`,
    )
    .join('\n');
  const output = project.nodes.find((entry) => entry.definitionId === 'output');
  const outputSource = output
    ? sourceFor(project, output.id, 'image')
    : undefined;
  const outputCall = outputSource
    ? `${fn(outputSource)}(uv)`
    : 'vec4(0.0, 0.0, 0.0, 1.0)';

  const usedInputs = new Set(project.nodes.map((entry) => entry.definitionId));
  const flameSamplers = (
    [
      ['front', 3, 'frontTex'],
      ['back', 4, 'backTex'],
      ['matte-input', 5, 'matteTex'],
    ] as const
  )
    .filter(([id]) => usedInputs.has(id))
    .map(
      ([, binding, name]) =>
        `layout(binding = ${binding}) uniform sampler2D ${name};`,
    )
    .join('\n');
  const flame = `#version 430
layout(location = 0) out vec4 fragColor;
layout(binding = 1) uniform AdskUniformBlock { float adsk_result_w, adsk_result_h, adsk_time; };
layout(binding = 2) uniform UniformBlock {
${flameParams}
};
${flameSamplers}
#define u_time adsk_time
#define DG_SIZE max(vec2(adsk_result_w, adsk_result_h), vec2(1.0))
${common.helpers}
${common.prototypes}
${common.functions}
void main(void) {
    vec2 uv = gl_FragCoord.xy / max(vec2(adsk_result_w, adsk_result_h), vec2(1.0));
    fragColor = ${outputCall};
}`;

  const webgl = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_wipe;
uniform sampler2D frontTex;
uniform sampler2D backTex;
uniform sampler2D matteTex;
${webParams}
#define DG_SIZE max(u_resolution, vec2(1.0))
${common.helpers}
${common.prototypes}
${common.functions}
void main(void) {
    vec2 uv = gl_FragCoord.xy / max(u_resolution, vec2(1.0));
    vec4 processed = ${outputCall};
    vec4 original = texture(frontTex, clamp(uv, 0.0, 1.0));
    fragColor = uv.x < u_wipe ? original : processed;
}`;
  return { flame, webgl, xml: generateXml(project), uniformValues: values };
}

function buildFunctions(project: ProjectV1) {
  const prototypes = project.nodes
    .filter((entry) => entry.definitionId !== 'output')
    .map((entry) => `vec4 ${fn(entry.id)}(vec2 uv);`)
    .join('\n');
  const functions = project.nodes
    .filter((entry) => entry.definitionId !== 'output')
    .map((entry) => buildNodeFunction(project, entry))
    .join('\n\n');
  const helpers = `float dg_luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
float dg_hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
vec3 dg_hue(vec3 color, float angle) {
    float a = radians(angle); float s = sin(a); float c = cos(a);
    mat3 m = mat3(0.299+0.701*c+0.168*s,0.587-0.587*c+0.330*s,0.114-0.114*c-0.497*s,0.299-0.299*c-0.328*s,0.587+0.413*c+0.035*s,0.114-0.114*c+0.292*s,0.299-0.300*c+1.250*s,0.587-0.588*c-1.050*s,0.114+0.886*c-0.203*s);
    return m * color;
}`;
  return { helpers, prototypes, functions };
}

function buildNodeFunction(project: ProjectV1, entry: ProjectNode) {
  const name = fn(entry.id);
  const call = (handle = 'image') => {
    const source = sourceFor(project, entry.id, handle);
    return source ? `${fn(source)}(uv)` : 'vec4(0.0)';
  };
  const u = (id: string) => {
    const definition = NODE_BY_ID.get(entry.definitionId)?.parameters.find(
      (parameter) => parameter.id === id,
    );
    return definition ? uniformName(entry, definition) : '0.0';
  };
  switch (entry.definitionId) {
    case 'front':
      return `vec4 ${name}(vec2 uv) { return texture(frontTex, clamp(uv, 0.0, 1.0)); }`;
    case 'back':
      return `vec4 ${name}(vec2 uv) { return texture(backTex, clamp(uv, 0.0, 1.0)); }`;
    case 'matte-input':
      return `vec4 ${name}(vec2 uv) { float m = texture(matteTex, clamp(uv, 0.0, 1.0)).r; return vec4(vec3(m), m); }`;
    case 'time':
      return `vec4 ${name}(vec2 uv) { return vec4(u_time); }`;
    case 'exposure':
      return `vec4 ${name}(vec2 uv) { vec4 s=${call()}; return vec4(s.rgb * exp2(${u('stops')}), s.a); }`;
    case 'contrast':
      return `vec4 ${name}(vec2 uv) { vec4 s=${call()}; return vec4((s.rgb-vec3(${u('pivot')}))*${u('contrast')}+vec3(${u('pivot')}),s.a); }`;
    case 'saturation':
      return `vec4 ${name}(vec2 uv) { vec4 s=${call()}; float l=dg_luma(s.rgb); return vec4(mix(vec3(l),s.rgb,${u('amount')}),s.a); }`;
    case 'hue':
      return `vec4 ${name}(vec2 uv) { vec4 s=${call()}; return vec4(dg_hue(s.rgb,${u('degrees')}),s.a); }`;
    case 'lift-gamma-gain':
      return `vec4 ${name}(vec2 uv) { vec4 s=${call()}; vec3 c=max((s.rgb+vec3(${u('lift')}))*${u('gain')},vec3(0.0)); return vec4(pow(c,vec3(1.0/max(${u('gamma')},0.0001))),s.a); }`;
    case 'channel-mixer':
      return `vec4 ${name}(vec2 uv) { vec4 s=${call()}; return vec4(s.rgb*vec3(${u('red')},${u('green')},${u('blue')}),s.a); }`;
    case 'clamp':
      return `vec4 ${name}(vec2 uv) { vec4 s=${call()}; return vec4(clamp(s.rgb,vec3(${u('minimum')}),vec3(max(${u('maximum')},${u('minimum')}))),s.a); }`;
    case 'mix':
      return composite(project, entry, name, `mix(a,b,${u('mix')})`);
    case 'over':
      return composite(
        project,
        entry,
        name,
        'vec4(a.rgb + b.rgb*(1.0-a.a), a.a + b.a*(1.0-a.a))',
      );
    case 'add':
      return composite(project, entry, name, 'vec4(a.rgb+b.rgb,max(a.a,b.a))');
    case 'multiply':
      return composite(project, entry, name, 'vec4(a.rgb*b.rgb,a.a)');
    case 'screen':
      return composite(
        project,
        entry,
        name,
        'vec4(1.0-(1.0-a.rgb)*(1.0-b.rgb),max(a.a,b.a))',
      );
    case 'luma-key':
      return `vec4 ${name}(vec2 uv) { float m=smoothstep(${u('threshold')}-0.05,${u('threshold')}+0.05,dg_luma(${call()}.rgb)); return vec4(vec3(m),m); }`;
    case 'blur': {
      const source = sourceFor(project, entry.id, 'image');
      const sample = source ? fn(source) : '';
      return `vec4 ${name}(vec2 uv) { vec2 px=vec2(max(${u('radius')},0.0))/DG_SIZE; vec4 c=vec4(0.0); for(int y=-1;y<=1;y++){for(int x=-1;x<=1;x++){c+=${sample ? `${sample}(clamp(uv+vec2(x,y)*px,0.0,1.0))` : 'vec4(0.0)'};}} return c/9.0; }`;
    }
    case 'erode-dilate': {
      const source = sourceFor(project, entry.id, 'matte');
      const sample = source ? fn(source) : '';
      return `vec4 ${name}(vec2 uv) { vec2 px=vec2(abs(${u('amount')}))/DG_SIZE; float v=${u('amount')}>=0.0?0.0:1.0; for(int y=-1;y<=1;y++){for(int x=-1;x<=1;x++){float m=${sample ? `${sample}(clamp(uv+vec2(x,y)*px,0.0,1.0)).r` : '0.0'}; v=${u('amount')}>=0.0?max(v,m):min(v,m);}} return vec4(vec3(v),v); }`;
    }
    case 'premultiply':
      return `vec4 ${name}(vec2 uv) { vec4 s=${call()}; if(${u('unpremultiply')}) return vec4(s.rgb/max(s.a,0.000001),s.a); return vec4(s.rgb*s.a,s.a); }`;
    case 'transform-2d': {
      const source = sourceFor(project, entry.id, 'image');
      const sample = source ? fn(source) : '';
      return `vec4 ${name}(vec2 uv) { float a=radians(${u('rotation')}); mat2 r=mat2(cos(a),-sin(a),sin(a),cos(a)); vec2 p=r*((uv-0.5)/max(${u('scale')},0.0001))+0.5; return ${sample ? `${sample}(clamp(p,0.0,1.0))` : 'vec4(0.0)'}; }`;
    }
    case 'pixelate': {
      const source = sourceFor(project, entry.id, 'image');
      const sample = source ? fn(source) : '';
      return `vec4 ${name}(vec2 uv) { vec2 size=max(vec2(${u('size')}),vec2(1.0)); vec2 p=(floor(uv*DG_SIZE/size)+0.5)*size/DG_SIZE; return ${sample ? `${sample}(clamp(p,0.0,1.0))` : 'vec4(0.0)'}; }`;
    }
    case 'displace': {
      const image = sourceFor(project, entry.id, 'image');
      const matte = sourceFor(project, entry.id, 'matte');
      return `vec4 ${name}(vec2 uv) { float m=${matte ? `${fn(matte)}(uv).r` : '0.5'}-0.5; vec2 p=uv+vec2(m)*${u('amount')}/DG_SIZE; return ${image ? `${fn(image)}(clamp(p,0.0,1.0))` : 'vec4(0.0)'}; }`;
    }
    case 'solid':
      return `vec4 ${name}(vec2 uv) { return vec4(${u('color')},1.0); }`;
    case 'gradient':
      return `vec4 ${name}(vec2 uv) { float a=radians(${u('angle')}); float g=clamp(dot(uv-0.5,vec2(cos(a),sin(a)))+0.5,0.0,1.0); return vec4(vec3(g),1.0); }`;
    case 'noise':
      return `vec4 ${name}(vec2 uv) { float v=dg_hash(floor(uv*max(${u('scale')},0.1))+u_time); return vec4(vec3(v),1.0); }`;
    default:
      return `vec4 ${name}(vec2 uv) { return ${call()}; }`;
  }
}

function composite(
  project: ProjectV1,
  entry: ProjectNode,
  name: string,
  expression: string,
) {
  const a = sourceFor(project, entry.id, 'a');
  const b = sourceFor(project, entry.id, 'b');
  return `vec4 ${name}(vec2 uv) { vec4 a=${a ? `${fn(a)}(uv)` : 'vec4(0.0)'}; vec4 b=${b ? `${fn(b)}(uv)` : 'vec4(0.0)'}; return ${expression}; }`;
}

const fn = (id: string) => `dg_${safe(id)}`;
const sourceFor = (project: ProjectV1, target: string, handle: string) =>
  project.edges.find(
    (edge) => edge.target === target && edge.targetHandle === handle,
  )?.source;

export function generateXml(project: ProjectV1) {
  const title = escapeXml(project.title);
  const samplerSpecs = [
    ['front', 'frontTex', 'Front'],
    ['back', 'backTex', 'Back'],
    ['matte-input', 'matteTex', 'Matte'],
  ] as const;
  const samplers = samplerSpecs
    .filter(([nodeId]) =>
      project.nodes.some((entry) => entry.definitionId === nodeId),
    )
    .map(
      ([, name, display], index) =>
        `    <Uniform Index="${index}" NoInput="${index === 0 ? 'Error' : 'Black'}" Tooltip="" DisplayName="${display}" InputType="${display}" Mipmaps="False" GL_TEXTURE_WRAP_T="GL_CLAMP_TO_EDGE" GL_TEXTURE_WRAP_S="GL_CLAMP_TO_EDGE" GL_TEXTURE_MAG_FILTER="GL_LINEAR" GL_TEXTURE_MIN_FILTER="GL_LINEAR" Type="sampler2D" Name="${name}" />`,
    )
    .join('\n');
  const controls = project.exposedParameters
    .map((exposed) => {
      const entry = project.nodes.find((node) => node.id === exposed.nodeId);
      const parameter =
        entry &&
        NODE_BY_ID.get(entry.definitionId)?.parameters.find(
          (candidate) => candidate.id === exposed.parameterId,
        );
      if (!entry || !parameter) return '';
      const value = entry.parameters[parameter.id] ?? parameter.defaultValue;
      const name = uniformName(entry, parameter);
      const common = `Tooltip="${escapeXml(exposed.tooltip)}" DisplayName="${escapeXml(exposed.displayName)}" Row="${exposed.row}" Col="${exposed.column}" Page="${exposed.page}" Type="${parameter.kind === 'boolean' ? 'bool' : parameter.kind === 'color' ? 'vec3' : 'float'}" Name="${name}"`;
      if (parameter.kind === 'color')
        return `    <Uniform ${common} ValueType="Colour">${hexToVec3(value)
          .map((component) => `<SubUniform Default="${component}" />`)
          .join('')}</Uniform>`;
      return `    <Uniform ${common} Default="${parameter.kind === 'boolean' ? (value ? 'True' : 'False') : escapeXml(String(value))}"${exposed.min !== undefined ? ` Min="${exposed.min}"` : ''}${exposed.max !== undefined ? ` Max="${exposed.max}"` : ''}${exposed.step !== undefined ? ` Inc="${exposed.step}"` : ''} />`;
    })
    .filter(Boolean)
    .join('\n');
  const pages = Array.from(
    {
      length: Math.max(
        1,
        ...project.exposedParameters.map((entry) => entry.page + 1),
      ),
    },
    (_, page) =>
      `  <Page Name="${page === 0 ? 'Image' : `Page ${page + 1}`}" Page="${page}">${Array.from({ length: 6 }, (_, column) => `<Col Name="${column === 0 ? 'Controls' : `Controls ${column + 1}`}" Col="${column}" Page="${page}" />`).join('')}</Page>`,
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<ShaderNodePreset SupportsAdaptiveDegradation="False" SupportsAction="True" SupportsTransition="False" SupportsTimeline="True" TimelineUseBack="False" MatteProvider="False" ShaderType="Matchbox" SoftwareVersion="2025.2.7" LimitInputsToTexture="True" Version="1" Description="Created with DG Matchbox Builder" Name="${title}">
  <Shader OutputBitDepth="Output" Index="1">
${samplers}
${controls}
  </Shader>
${pages}
</ShaderNodePreset>`;
}

const escapeXml = (value: string) =>
  value.replace(
    /[<>&"']/g,
    (char) =>
      ({
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&apos;',
      })[char] ?? char,
  );
