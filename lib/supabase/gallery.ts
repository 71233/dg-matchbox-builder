/* oxlint-disable typescript/no-explicit-any */
import type { ProjectV1 } from '@/lib/matchbox/types';
import { getSupabase } from './client';

export interface GalleryProject {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  author: string;
  favoriteCount: number;
  passes: number;
  verifiedMac: boolean;
  verifiedLinux: boolean;
  thumbnailUrl?: string;
  document?: ProjectV1;
  publishedAt: string;
}

export async function listApprovedProjects(): Promise<GalleryProject[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('projects')
    .select(
      'id,slug,title,description,category,published_at,current_revision:project_revisions!current_revision_id(document,thumbnail_path,validation_report),profile:profiles!owner_id(display_name),favorites(count)',
    )
    .eq('status', 'approved')
    .order('published_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    author: row.profile?.display_name ?? 'Creator',
    favoriteCount: row.favorites?.[0]?.count ?? 0,
    passes:
      new Set(
        (row.current_revision?.document?.nodes ?? []).map(
          (node: any) => node.pass,
        ),
      ).size || 1,
    verifiedMac: row.current_revision?.validation_report?.flameMac === 'passed',
    verifiedLinux:
      row.current_revision?.validation_report?.flameLinux === 'passed',
    thumbnailUrl: row.current_revision?.thumbnail_path,
    document: row.current_revision?.document,
    publishedAt: row.published_at,
  }));
}

export async function submitProject(
  project: ProjectV1,
  thumbnailDataUrl?: string,
) {
  const supabase = getSupabase();
  if (!supabase)
    throw new Error(
      'Supabase is not configured. Add the public URL and publishable key first.',
    );
  const { data: session } = await supabase.auth.getSession();
  if (!session.session) throw new Error('Sign in before submitting a project.');
  const { data, error } = await supabase.functions.invoke('submit-project', {
    body: { project, thumbnailDataUrl },
  });
  if (error) throw error;
  return data as { id: string; status: 'submitted' };
}

export async function toggleFavorite(projectId: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Sign in to save favorites.');
  const key = { user_id: user.user.id, project_id: projectId };
  const { data: existing } = await supabase
    .from('favorites')
    .select('project_id')
    .match(key)
    .maybeSingle();
  if (existing) return supabase.from('favorites').delete().match(key);
  return supabase.from('favorites').insert(key);
}

export interface PendingProject {
  id: string;
  title: string;
  author: string;
  nodes: number;
  issues: number;
}

export async function listPendingProjects(): Promise<PendingProject[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('projects')
    .select(
      'id,title,profile:profiles!owner_id(display_name),current_revision:project_revisions!current_revision_id(document,validation_report)',
    )
    .eq('status', 'submitted')
    .order('updated_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    title: row.title,
    author: row.profile?.display_name ?? 'Creator',
    nodes: row.current_revision?.document?.nodes?.length ?? 0,
    issues: (row.current_revision?.validation_report?.issues ?? []).filter(
      (issue: any) => issue.severity !== 'info',
    ).length,
  }));
}

export async function reviewProject(
  projectId: string,
  decision: 'approved' | 'rejected',
  note = '',
) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.functions.invoke('review-project', {
    body: { projectId, decision, note },
  });
  if (error) throw error;
  return data as { id: string; status: typeof decision };
}

export async function reportProject(projectId: string, details: string) {
  const supabase = getSupabase();
  if (!supabase) throw new Error('Supabase is not configured.');
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Sign in before reporting a project.');
  const { error } = await supabase.from('reports').insert({
    project_id: projectId,
    reporter_id: user.user.id,
    reason: 'other',
    details: details.slice(0, 1000),
  });
  if (error) throw error;
}
