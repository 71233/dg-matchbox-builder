'use client';

import { useEffect, useState } from 'react';
import { Check, Clock3, ShieldCheck, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  listPendingProjects,
  reviewProject,
  type PendingProject,
} from '@/lib/supabase/gallery';

const DEMO: PendingProject[] = [
  {
    id: 'demo-1',
    title: 'Soft Highlight Bloom',
    author: 'mika.vfx',
    nodes: 8,
    issues: 0,
  },
  {
    id: 'demo-2',
    title: 'Analog Signal Fold',
    author: 'northgrade',
    nodes: 14,
    issues: 1,
  },
];

export function AdminPage() {
  const [submissions, setSubmissions] = useState<PendingProject[]>(DEMO);
  const [message, setMessage] = useState('');
  useEffect(() => {
    void listPendingProjects()
      .then((projects) => projects.length && setSubmissions(projects))
      .catch(() => undefined);
  }, []);
  const decide = async (
    project: PendingProject,
    decision: 'approved' | 'rejected',
  ) => {
    try {
      if (!project.id.startsWith('demo-'))
        await reviewProject(project.id, decision);
      setSubmissions((items) => items.filter((item) => item.id !== project.id));
      setMessage(`${project.title} was ${decision}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <section className="min-h-[calc(100vh-56px)] bg-[#111316] p-5 md:p-8">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-[#ff8b3d]">
              Moderation
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Submission review</h1>
          </div>
          <Badge
            variant="outline"
            className="border-[#4c3c2c] bg-[#261d16] text-[#f7a86f]"
          >
            <Clock3 /> {submissions.length} pending
          </Badge>
        </div>
        <div className="mt-8 overflow-hidden rounded-xl border border-[#30333a] bg-[#181a1f]">
          <div className="grid grid-cols-[1fr_140px_100px_170px] border-b border-[#30333a] px-4 py-3 text-[10px] uppercase tracking-wider text-[#737984]">
            <span>Project</span>
            <span>Author</span>
            <span>Check</span>
            <span>Decision</span>
          </div>
          {submissions.map((item) => (
            <div
              key={item.title}
              className="grid grid-cols-[1fr_140px_100px_170px] items-center border-b border-[#292c32] px-4 py-4 last:border-0"
            >
              <div>
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="mt-1 text-[10px] text-[#727883]">
                  {item.nodes} verified nodes · ProjectV1
                </p>
              </div>
              <span className="text-xs text-[#a1a5ad]">{item.author}</span>
              <Badge
                variant="outline"
                className={
                  item.issues
                    ? 'border-[#60412a] text-[#f4a66f]'
                    : 'border-[#2e503b] text-[#7ed69f]'
                }
              >
                <ShieldCheck />
                {item.issues ? `${item.issues} warn` : 'passed'}
              </Badge>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void decide(item, 'approved')}>
                  <Check /> Approve
                </Button>
                <Button
                  size="icon-sm"
                  variant="destructive"
                  aria-label="Reject"
                  onClick={() => void decide(item, 'rejected')}
                >
                  <X />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-4 text-xs text-[#747a84]">
          Live decisions are enforced through protected app_roles and an Edge
          Function.
        </p>
        {message && <p className="mt-3 text-xs text-[#aeb2ba]">{message}</p>}
      </div>
    </section>
  );
}
