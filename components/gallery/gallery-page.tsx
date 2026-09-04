'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Heart,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TEMPLATES } from '@/lib/matchbox/templates';
import { instantiateProject } from '@/lib/matchbox/project';
import type { ProjectV1 } from '@/lib/matchbox/types';
import {
  listApprovedProjects,
  type GalleryProject,
} from '@/lib/supabase/gallery';

const DEMO: GalleryProject[] = TEMPLATES.map((template, index) => ({
  id: `demo-${template.id}`,
  slug: template.id,
  title: template.project.title,
  description: template.description.en,
  category: template.category,
  author: ['DG Studio', 'Mika VFX', 'North Grade'][index % 3],
  favoriteCount: [128, 86, 54, 73, 42, 91][index],
  passes: index === 2 || index === 4 ? 2 : 1,
  verifiedMac: true,
  verifiedLinux: index !== 4,
  document: instantiateProject(template.project, 'en'),
  publishedAt: new Date(Date.now() - index * 86400000 * 4).toISOString(),
}));

export function GalleryPage({
  onRemix,
  onOpen,
}: {
  onRemix: (project: ProjectV1) => void;
  onOpen: (project: GalleryProject) => void;
}) {
  const [remote, setRemote] = useState<GalleryProject[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [passes, setPasses] = useState('all');
  const [sort, setSort] = useState<'newest' | 'popular'>('newest');
  useEffect(() => {
    void listApprovedProjects()
      .then(setRemote)
      .catch(() => setRemote([]));
  }, []);
  const projects = remote.length ? remote : DEMO;
  const visible = useMemo(
    () =>
      projects
        .filter(
          (project) =>
            (category === 'all' || project.category === category) &&
            (passes === 'all' || project.passes === Number(passes)) &&
            `${project.title} ${project.description} ${project.author}`
              .toLowerCase()
              .includes(search.toLowerCase()),
        )
        .sort((a, b) =>
          sort === 'popular'
            ? b.favoriteCount - a.favoriteCount
            : Date.parse(b.publishedAt) - Date.parse(a.publishedAt),
        ),
    [projects, search, category, passes, sort],
  );
  return (
    <section className="min-h-[calc(100vh-56px)] bg-[#111316] p-5 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ff8b3d]">
              Community library
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Build, learn and remix
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[#8e939d]">
              Open Matchboxes built from verified nodes, learn their structure
              and make them your own.
            </p>
          </div>
          <Badge
            variant="outline"
            className="border-[#31513d] bg-[#15251b] text-[#85d7a5]"
          >
            <ShieldCheck /> {visible.length} reviewed projects
          </Badge>
        </div>
        <div className="mt-7 flex flex-col gap-3 rounded-xl border border-[#2d3037] bg-[#17191d] p-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#707681]" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-10 border-[#343840] bg-[#101215] pl-9"
              placeholder="Search projects, purpose or author"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            <SlidersHorizontal className="size-4 shrink-0 text-[#737984]" />
            {[
              'all',
              'color',
              'matte',
              'composite',
              'transform',
              'generator',
            ].map((value) => (
              <button
                key={value}
                onClick={() => setCategory(value)}
                className={`rounded-md px-3 py-2 text-xs capitalize ${category === value ? 'bg-[#ff7a1a] font-semibold text-black' : 'bg-[#23262c] text-[#a8acb4] hover:bg-[#2d3037]'}`}
              >
                {value}
              </button>
            ))}
            <select
              value={passes}
              onChange={(event) => setPasses(event.target.value)}
              aria-label="Pass count"
              className="h-9 rounded-md border border-[#343840] bg-[#101215] px-2 text-xs"
            >
              <option value="all">All passes</option>
              {[1, 2, 3, 4].map((value) => (
                <option key={value} value={value}>
                  {value} pass
                </option>
              ))}
            </select>
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as 'newest' | 'popular')
              }
              aria-label="Sort order"
              className="h-9 rounded-md border border-[#343840] bg-[#101215] px-2 text-xs"
            >
              <option value="newest">Newest</option>
              <option value="popular">Popular</option>
            </select>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((project, index) => (
            <article
              key={project.id}
              className="group overflow-hidden rounded-xl border border-[#2d3037] bg-[#17191d] transition hover:-translate-y-0.5 hover:border-[#4a3a2f] hover:shadow-[0_18px_50px_rgb(0_0_0/28%)]"
            >
              <button
                aria-label={`${project.title} details`}
                className="block w-full text-left"
                onClick={() => onOpen(project)}
              >
                <div className="relative aspect-[16/9] overflow-hidden bg-[#0d0f12]">
                  <div
                    className="absolute inset-0 transition duration-500 group-hover:scale-105"
                    style={{
                      background: `radial-gradient(circle at ${30 + index * 8}% ${35 + index * 5}%, ${['#ff9c59', '#d7b7ff', '#73d7ff', '#8cf3ae', '#ff9fad', '#ffe08b'][index % 6]} 0%, transparent 17%), linear-gradient(${125 + index * 18}deg,#182638,#6c3f29 55%,#12131a)`,
                    }}
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(transparent_95%,rgb(255_255_255/8%)_95%),linear-gradient(90deg,transparent_95%,rgb(255_255_255/6%)_95%)] bg-[length:24px_24px]" />
                  <Badge className="absolute left-3 top-3 bg-black/65 text-white">
                    {project.passes} pass
                  </Badge>
                  <div className="absolute bottom-3 right-3 flex gap-1">
                    {project.verifiedMac && (
                      <Badge className="bg-[#173322]/90 text-[#8ce8ae]">
                        <CheckCircle2 /> macOS
                      </Badge>
                    )}
                    {project.verifiedLinux && (
                      <Badge className="bg-[#173322]/90 text-[#8ce8ae]">
                        <CheckCircle2 /> Linux
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold">{project.title}</h2>
                      <p className="mt-1 text-xs text-[#777d87]">
                        by {project.author}
                      </p>
                    </div>
                    <span className="flex items-center gap-1 text-xs text-[#9ca1aa]">
                      <Heart className="size-3.5" />
                      {project.favoriteCount}
                    </span>
                  </div>
                  <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-[#9ca1aa]">
                    {project.description}
                  </p>
                </div>
              </button>
              <div className="flex gap-2 border-t border-[#2b2e34] p-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 border-[#383c44] bg-[#1d2025]"
                  onClick={() => project.document && onRemix(project.document)}
                >
                  <Copy /> Remix
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Favorite"
                  onClick={() => onOpen(project)}
                >
                  <Heart />
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
