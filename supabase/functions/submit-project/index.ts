import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowed = new Set([
  'front',
  'back',
  'matte-input',
  'time',
  'output',
  'exposure',
  'contrast',
  'saturation',
  'hue',
  'lift-gamma-gain',
  'channel-mixer',
  'clamp',
  'mix',
  'over',
  'add',
  'multiply',
  'screen',
  'luma-key',
  'blur',
  'erode-dilate',
  'premultiply',
  'transform-2d',
  'pixelate',
  'displace',
  'solid',
  'gradient',
  'noise',
]);
const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
};
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS')
    return new Response('ok', { headers: cors });
  if (request.method !== 'POST')
    return new Response('Method not allowed', { status: 405 });
  const auth = request.headers.get('Authorization') ?? '';
  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: auth } } },
  );
  const { data: user } = await client.auth.getUser();
  if (!user.user) return json({ error: 'Unauthorized' }, 401);
  const body = await request.json();
  const project = body?.project;
  if (
    !project ||
    project.schemaVersion !== 1 ||
    project.generatorVersion !== '0.1.0'
  )
    return json({ error: 'Unsupported project format' }, 400);
  if (
    typeof project.title !== 'string' ||
    project.title.length < 1 ||
    project.title.length > 80 ||
    typeof project.description !== 'string' ||
    project.description.length > 2000 ||
    !['io', 'color', 'composite', 'matte', 'transform', 'generator'].includes(
      project.category,
    ) ||
    project.target !== 'flame-2025.1+'
  )
    return json({ error: 'Invalid project metadata' }, 400);
  if (
    !Array.isArray(project.nodes) ||
    project.nodes.length < 1 ||
    project.nodes.length > 50 ||
    !project.nodes.every(
      (node: any) =>
        allowed.has(node.definitionId) &&
        Number.isInteger(node.pass) &&
        node.pass >= 1 &&
        node.pass <= 4,
    )
  )
    return json({ error: 'Project contains invalid nodes' }, 400);
  const nodeIds = new Set(project.nodes.map((node: any) => node.id));
  if (
    nodeIds.size !== project.nodes.length ||
    project.nodes.filter((node: any) => node.definitionId === 'output')
      .length !== 1
  )
    return json({ error: 'Project requires unique nodes and one output' }, 400);
  if (
    !Array.isArray(project.edges) ||
    project.edges.length > 150 ||
    !project.edges.every(
      (edge: any) =>
        typeof edge.id === 'string' &&
        nodeIds.has(edge.source) &&
        nodeIds.has(edge.target) &&
        typeof edge.sourceHandle === 'string' &&
        typeof edge.targetHandle === 'string',
    )
  )
    return json({ error: 'Project contains invalid connections' }, 400);
  if (
    !Array.isArray(project.exposedParameters) ||
    project.exposedParameters.length > 105 ||
    !project.exposedParameters.every(
      (entry: any) =>
        nodeIds.has(entry.nodeId) &&
        typeof entry.parameterId === 'string' &&
        typeof entry.displayName === 'string' &&
        entry.displayName.length <= 80 &&
        Number.isInteger(entry.page) &&
        entry.page >= 0 &&
        entry.page <= 6 &&
        Number.isInteger(entry.column) &&
        entry.column >= 0 &&
        entry.column <= 5 &&
        Number.isInteger(entry.row) &&
        entry.row >= 0 &&
        entry.row <= 4,
    )
  )
    return json({ error: 'Project contains invalid UI controls' }, 400);
  if (
    body.thumbnailDataUrl &&
    (typeof body.thumbnailDataUrl !== 'string' ||
      body.thumbnailDataUrl.length > 2_000_000 ||
      !body.thumbnailDataUrl.startsWith('data:image/png;base64,'))
  )
    return json({ error: 'Invalid thumbnail' }, 400);
  if (JSON.stringify(project).length > 250000)
    return json({ error: 'Project is too large' }, 413);
  const slug = `${
    String(project.title)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'matchbox'
  }-${crypto.randomUUID().slice(0, 8)}`;
  const { data: created, error } = await client
    .from('projects')
    .insert({
      owner_id: user.user.id,
      slug,
      title: String(project.title).slice(0, 80),
      description: String(project.description ?? '').slice(0, 2000),
      category: project.category,
      status: 'draft',
    })
    .select('id')
    .single();
  if (error) return json({ error: error.message }, 400);
  const validation = {
    valid: true,
    issues: [
      {
        severity: 'info',
        code: 'SERVER_SCHEMA_OK',
        message: 'Allowed ProjectV1 structure.',
      },
    ],
    browserCompile: 'pending',
    flameMac: 'untested',
    flameLinux: 'untested',
  };
  const { data: revision, error: revisionError } = await client
    .from('project_revisions')
    .insert({
      project_id: created.id,
      revision: 1,
      document: project,
      validation_report: validation,
    })
    .select('id')
    .single();
  if (revisionError) return json({ error: revisionError.message }, 400);
  await client
    .from('projects')
    .update({ current_revision_id: revision.id, status: 'submitted' })
    .eq('id', created.id);
  return json({ id: created.id, status: 'submitted' }, 201);
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...cors,
    },
  });
