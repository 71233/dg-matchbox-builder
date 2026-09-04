import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
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
    return new Response('Method not allowed', { status: 405, headers: cors });
  const auth = request.headers.get('Authorization') ?? '';
  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const token = auth.replace('Bearer ', '');
  const { data: user } = await client.auth.getUser(token);
  if (!user.user) return json({ error: 'Unauthorized' }, 401);
  const { data: role } = await client
    .from('app_roles')
    .select('role')
    .eq('user_id', user.user.id)
    .maybeSingle();
  if (!role) return json({ error: 'Forbidden' }, 403);
  const { projectId, decision, note = '' } = await request.json();
  if (!['approved', 'rejected'].includes(decision))
    return json({ error: 'Invalid decision' }, 400);
  const { error } = await client
    .from('projects')
    .update({
      status: decision,
      published_at: decision === 'approved' ? new Date().toISOString() : null,
    })
    .eq('id', projectId)
    .eq('status', 'submitted');
  if (error) return json({ error: error.message }, 400);
  await client.from('moderation_reviews').insert({
    project_id: projectId,
    reviewer_id: user.user.id,
    decision,
    note: String(note).slice(0, 1000),
  });
  return json({ id: projectId, status: decision });
});
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...cors },
  });
