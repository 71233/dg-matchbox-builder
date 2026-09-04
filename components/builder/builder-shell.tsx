'use client';

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  CircleHelp,
  Code2,
  Download,
  GalleryVerticalEnd,
  Flag,
  Heart,
  LogIn,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Upload,
  Workflow,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { PreviewCanvas, type PreviewCanvasHandle } from './preview-canvas';
import { NODE_BY_ID } from '@/lib/matchbox/catalog';
import { TEMPLATES } from '@/lib/matchbox/templates';
import { generateShader } from '@/lib/matchbox/generator';
import { instantiateProject } from '@/lib/matchbox/project';
import { parseProject, validateProject } from '@/lib/matchbox/validation';
import {
  loadLocalProject,
  saveLocalProject,
} from '@/lib/storage/local-project';
import type { GalleryProject } from '@/lib/supabase/gallery';
import { useProjectStore } from '@/lib/store/project-store';
import type {
  ExposedParameter,
  Locale,
  ParameterDefinition,
  ProjectNode,
  ProjectV1,
} from '@/lib/matchbox/types';

type Route = 'builder' | 'gallery' | 'learn' | 'account' | 'admin';

const GraphEditor = lazy(() =>
  import('./graph-editor').then((module) => ({ default: module.GraphEditor })),
);
const GalleryPage = lazy(() =>
  import('@/components/gallery/gallery-page').then((module) => ({
    default: module.GalleryPage,
  })),
);
const AccountPage = lazy(() =>
  import('@/components/community/account-page').then((module) => ({
    default: module.AccountPage,
  })),
);
const AdminPage = lazy(() =>
  import('@/components/community/admin-page').then((module) => ({
    default: module.AdminPage,
  })),
);

const COPY = {
  builder: 'Builder',
  gallery: 'Gallery',
  learn: 'Learn',
  account: 'Account',
  export: 'Export',
  publish: 'Submit',
  recipe: 'What will you build?',
  quick: 'Shape the look',
  graph: 'Open graph',
  saved: 'Autosaved on this device',
  private: 'Your media stays on this device until you explicitly publish.',
};

const DISPLAY_LOCALE: Locale = 'en';

export function BuilderShell() {
  const [route, setRoute] = useState<Route>('builder');
  const [galleryProject, setGalleryProject] = useState<GalleryProject>();
  const { setProject } = useProjectStore();
  const t = COPY;
  useEffect(() => {
    const sync = () =>
      setRoute(
        (window.location.hash.replace('#/', '') || 'builder').split(
          '/',
        )[0] as Route,
      );
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  const navigate = (next: Route) => {
    window.location.hash = `/${next}`;
    setRoute(next);
    setGalleryProject(undefined);
  };
  const remix = (project: ProjectV1) => {
    setProject({
      ...instantiateProject(project, DISPLAY_LOCALE),
      parentProjectId: project.id,
      title: `${project.title} Remix`,
    });
    navigate('builder');
  };

  useWebMcp(setProject, navigate);
  return (
    <main className="min-h-screen bg-[#101113] pb-14 text-[#f4f2ed] md:pb-0">
      <Header route={route} t={t} navigate={navigate} />
      <Suspense
        fallback={
          <div className="grid min-h-[calc(100vh-56px)] place-items-center text-sm text-[#8e939d]">
            Loading workspace…
          </div>
        }
      >
        {route === 'builder' && (
          <BuilderWorkspace t={t} onAccount={() => navigate('account')} />
        )}
        {route === 'gallery' && (
          <GalleryPage onRemix={remix} onOpen={setGalleryProject} />
        )}
        {route === 'learn' && <LearnPage />}
        {route === 'account' && <AccountPage />}
        {route === 'admin' && <AdminPage />}
      </Suspense>
      {galleryProject && (
        <GalleryDetail
          project={galleryProject}
          onClose={() => setGalleryProject(undefined)}
          onRemix={() =>
            galleryProject.document && remix(galleryProject.document)
          }
        />
      )}
      <nav
        className="fixed inset-x-0 bottom-0 z-50 grid h-14 grid-cols-3 border-t border-[#2b2e34] bg-[#14161a]/98 md:hidden"
        aria-label="Mobile navigation"
      >
        <button
          className={route === 'builder' ? 'text-[#ff9b59]' : 'text-[#8f949d]'}
          onClick={() => navigate('builder')}
        >
          <Boxes className="mx-auto size-4" />
          <span className="mt-1 block text-[10px]">{t.builder}</span>
        </button>
        <button
          className={route === 'gallery' ? 'text-[#ff9b59]' : 'text-[#8f949d]'}
          onClick={() => navigate('gallery')}
        >
          <GalleryVerticalEnd className="mx-auto size-4" />
          <span className="mt-1 block text-[10px]">{t.gallery}</span>
        </button>
        <button
          className={route === 'learn' ? 'text-[#ff9b59]' : 'text-[#8f949d]'}
          onClick={() => navigate('learn')}
        >
          <CircleHelp className="mx-auto size-4" />
          <span className="mt-1 block text-[10px]">{t.learn}</span>
        </button>
      </nav>
    </main>
  );
}

function Header({
  route,
  t,
  navigate,
}: {
  route: Route;
  t: typeof COPY;
  navigate: (route: Route) => void;
}) {
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-[#2b2e34] bg-[#14161a]/95 px-4 backdrop-blur">
      <button
        className="flex items-center gap-3 text-left"
        onClick={() => navigate('builder')}
      >
        <span className="grid size-8 place-items-center rounded-md bg-[#ff7a1a] text-sm font-black text-[#160b03]">
          DG
        </span>
        <span>
          <span className="block text-sm font-semibold leading-none">
            Matchbox Builder
          </span>
          <span className="mt-1 block text-[10px] uppercase tracking-[0.16em] text-[#7f848e]">
            Public beta workspace
          </span>
        </span>
        <Badge
          variant="outline"
          className="ml-2 hidden border-[#4a3627] bg-[#241b15] text-[#ffad72] sm:flex"
        >
          Flame 2025.1+
        </Badge>
      </button>
      <nav
        className="hidden items-center gap-1 md:flex"
        aria-label="Main navigation"
      >
        <NavButton
          active={route === 'builder'}
          onClick={() => navigate('builder')}
          icon={<Boxes />}
        >
          {t.builder}
        </NavButton>
        <NavButton
          active={route === 'gallery'}
          onClick={() => navigate('gallery')}
          icon={<GalleryVerticalEnd />}
        >
          {t.gallery}
        </NavButton>
        <NavButton
          active={route === 'learn'}
          onClick={() => navigate('learn')}
          icon={<CircleHelp />}
        >
          {t.learn}
        </NavButton>
      </nav>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => navigate('account')}
          aria-label={t.account}
        >
          <LogIn />
        </Button>
      </div>
    </header>
  );
}

function NavButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={active ? 'bg-[#25201c] text-[#ffad72]' : 'text-[#9da1aa]'}
    >
      {icon}
      {children}
    </Button>
  );
}

function BuilderWorkspace({
  t,
  onAccount,
}: {
  t: typeof COPY;
  onAccount: () => void;
}) {
  const store = useProjectStore();
  const {
    project,
    selectedNodeId,
    graphOpen,
    chooseTemplate,
    setGraphOpen,
    updateParameter,
    setNodePass,
    updateMetadata,
    toggleExposed,
    updateExposedParameter,
    setProject,
  } = store;
  const previewRef = useRef<PreviewCanvasHandle>(null);
  const [templateId, setTemplateId] = useState('color');
  const [compileState, setCompileState] = useState<
    'passed' | 'failed' | 'unavailable'
  >('passed');
  const [codeOpen, setCodeOpen] = useState(false);
  const [codeTab, setCodeTab] = useState<'glsl' | 'xml'>('glsl');
  const [status, setStatus] = useState('');
  const report = useMemo(
    () => ({ ...validateProject(project), browserCompile: compileState }),
    [project, compileState],
  );
  const generated = useMemo(() => generateShader(project), [project]);
  const selectedNode =
    project.nodes.find((entry) => entry.id === selectedNodeId) ??
    project.nodes.find(
      (entry) =>
        (NODE_BY_ID.get(entry.definitionId)?.parameters.length ?? 0) > 0,
    );
  const selectedDefinition =
    selectedNode && NODE_BY_ID.get(selectedNode.definitionId);

  useEffect(() => {
    void loadLocalProject()
      .then((saved) => {
        if (saved) {
          try {
            setProject(parseProject(saved));
          } catch {
            /* ignore incompatible local data */
          }
        }
      })
      .catch(() => undefined);
  }, [setProject]);
  useEffect(() => {
    const timer = setTimeout(
      () => saveLocalProject(project).catch(() => undefined),
      350,
    );
    return () => clearTimeout(timer);
  }, [project]);

  const exportProject = async () => {
    setStatus('Building ZIP…');
    try {
      const { buildExport, downloadBlob } =
        await import('@/lib/matchbox/export');
      const result = await buildExport(
        project,
        await previewRef.current?.thumbnail(),
      );
      downloadBlob(result.blob, `${result.basename}.zip`);
      setStatus(
        `${result.files.length} files · SHA-256 ${result.sha256.slice(0, 10)}…`,
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };
  const importProject = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = parseProject(JSON.parse(await file.text()));
      setProject(parsed);
      setStatus('Project imported.');
    } catch {
      setStatus('This is not a valid .dgmb.json file.');
    }
  };
  const submit = async () => {
    if (!report.valid)
      return setStatus('Fix validation errors before submitting.');
    try {
      setStatus('Submitting…');
      const { submitProject } = await import('@/lib/supabase/gallery');
      const result = await submitProject(
        project,
        document.querySelector('canvas')?.toDataURL('image/png'),
      );
      setStatus(`Submitted for review · ${result.id.slice(0, 8)}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
      onAccount();
    }
  };

  return (
    <section className="grid min-h-[calc(100vh-56px)] grid-cols-1 xl:grid-cols-[270px_minmax(560px,1fr)_310px]">
      <aside className="border-r border-[#2b2e34] bg-[#15171b] p-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8e939d]">
              Start from a recipe
            </p>
            <h1 className="mt-1 text-lg font-semibold">{t.recipe}</h1>
          </div>
          <Sparkles className="size-5 text-[#ff8b3d]" />
        </div>
        <div className="space-y-2">
          {TEMPLATES.map((template) => {
            const selected = template.id === templateId;
            return (
              <button
                key={template.id}
                onClick={() => {
                  setTemplateId(template.id);
                  chooseTemplate(template.id);
                }}
                className={`w-full rounded-lg border p-3 text-left transition ${selected ? 'border-[#ff7a1a] bg-[#2b211a]' : 'border-[#2f3238] bg-[#1a1c21] hover:border-[#4a4e57]'}`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full"
                    style={{ background: template.accent }}
                  />
                  <span className="text-sm font-semibold">
                    {template.title.en}
                  </span>
                  {selected && (
                    <CheckCircle2 className="ml-auto size-4 text-[#ff8b3d]" />
                  )}
                </div>
                <p className="mt-1 pl-4 text-xs leading-relaxed text-[#8e939d]">
                  {template.description.en}
                </p>
              </button>
            );
          })}
        </div>
        <div className="mt-5 rounded-lg border border-[#2e3239] bg-[#111317] p-3">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Save className="size-4 text-[#8e939d]" /> {t.saved}
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[#707681]">
            {t.private}
          </p>
        </div>
        <label className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-[#343840] bg-[#1b1d22] px-3 py-2 text-xs hover:bg-[#23262c]">
          <Upload className="size-3.5" /> .dgmb.json
          <input
            type="file"
            accept=".json,.dgmb.json"
            className="sr-only"
            onChange={(event) => importProject(event.target.files?.[0])}
          />
        </label>
      </aside>

      <section className="relative flex min-h-[720px] flex-col bg-[#0e0f11]">
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-[#292c32] px-4 py-2">
          <div>
            <Input
              value={project.title}
              onChange={(event) =>
                updateMetadata({ title: event.target.value })
              }
              className="h-6 border-0 bg-transparent px-0 text-sm font-semibold focus-visible:ring-0"
            />
            <p className="text-[10px] text-[#7f848e]">
              {project.nodes.length} nodes ·{' '}
              {new Set(project.nodes.map((entry) => entry.pass)).size} pass ·
              WebGL 2 proxy
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                report.valid
                  ? 'border-[#244934] bg-[#13261c] text-[#78d59e]'
                  : 'border-[#6b352d] bg-[#2b1715] text-[#ff8175]'
              }
            >
              <CheckCircle2 />{' '}
              {report.valid
                ? 'Structure passed'
                : `${report.issues.filter((entry) => entry.severity === 'error').length} errors`}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCodeOpen(true)}
              className="border-[#343840] bg-[#1a1c21]"
            >
              <Code2 /> Code
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGraphOpen(true)}
              className="border-[#343840] bg-[#1a1c21]"
            >
              <Workflow /> {t.graph}
            </Button>
          </div>
        </div>
        <div className="m-4 flex-1">
          <PreviewCanvas
            ref={previewRef}
            project={project}
            onCompileState={setCompileState}
          />
        </div>
        <div className="mx-4 mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[#2d3037] bg-[#15171b] p-3">
          <Button onClick={exportProject}>
            <Download /> {t.export} ZIP
          </Button>
          <Button
            variant="outline"
            onClick={submit}
            className="border-[#4b3728] bg-[#271d16] text-[#ffab70]"
          >
            <Send /> {t.publish}
          </Button>
          <span className="ml-auto max-w-md truncate text-[10px] text-[#818791]">
            {status || 'Generates GLSL, XML, thumbnail and validation helpers.'}
          </span>
        </div>
        {graphOpen && <GraphEditor />}
        {codeOpen && (
          <CodePanel
            tab={codeTab}
            setTab={setCodeTab}
            code={codeTab === 'glsl' ? generated.flame : generated.xml}
            onClose={() => setCodeOpen(false)}
          />
        )}
      </section>

      <aside className="border-l border-[#2b2e34] bg-[#15171b]">
        <div className="border-b border-[#2b2e34] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8e939d]">
              Quick controls
            </p>
            <Code2 className="size-4 text-[#666c76]" />
          </div>
          <h2 className="mt-1 text-base font-semibold">{t.quick}</h2>
        </div>
        <div className="max-h-[48vh] space-y-5 overflow-y-auto p-4">
          {selectedNode && (
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#747a84]">
                Render pass
              </p>
              <div className="grid grid-cols-4 gap-1">
                {[1, 2, 3, 4].map((pass) => (
                  <button
                    key={pass}
                    onClick={() => setNodePass(selectedNode.id, pass)}
                    className={`rounded border px-2 py-1 text-[10px] ${selectedNode.pass === pass ? 'border-[#ff7a1a] bg-[#2b211a] text-[#ffad72]' : 'border-[#343840] bg-[#1b1d22] text-[#8d929c]'}`}
                  >
                    P{pass}
                  </button>
                ))}
              </div>
            </div>
          )}
          {selectedNode &&
            selectedDefinition?.parameters.map((parameter) => {
              const exposed = project.exposedParameters.find(
                (entry) =>
                  entry.nodeId === selectedNode.id &&
                  entry.parameterId === parameter.id,
              );
              return (
                <div key={parameter.id} className="space-y-3">
                  <ParameterControl
                    parameter={parameter}
                    projectNode={selectedNode}
                    exposed={Boolean(exposed)}
                    onValue={(value) =>
                      updateParameter(selectedNode.id, parameter.id, value)
                    }
                    onExpose={() =>
                      toggleExposed(selectedNode.id, parameter.id)
                    }
                  />
                  {exposed && (
                    <FlameControlEditor
                      value={exposed}
                      onChange={(patch) =>
                        updateExposedParameter(exposed.id, patch)
                      }
                    />
                  )}
                </div>
              );
            })}
          {!selectedDefinition?.parameters.length && (
            <p className="text-xs leading-relaxed text-[#7d838d]">
              Select an adjustable node in the graph to show its controls here.
            </p>
          )}
        </div>
        <div className="mx-4 border-t border-[#2c3036] py-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold text-[#b8bbc2]">
              Flame UI preview
            </p>
            <Badge variant="outline">
              {project.exposedParameters.length} controls
            </Badge>
          </div>
          <div className="rounded-lg border border-[#363a42] bg-[#1b1e23] p-3">
            <div className="mb-3 flex items-center justify-between border-b border-[#343840] pb-2">
              <span className="text-xs font-semibold text-[#ff9a58]">
                Image
              </span>
              <span className="text-[10px] text-[#727883]">
                Page 1 / Column 1
              </span>
            </div>
            {project.exposedParameters.slice(0, 5).map((entry) => (
              <div
                key={entry.id}
                className="mb-2 grid grid-cols-[80px_1fr] items-center gap-2 text-[10px]"
              >
                <span className="truncate text-[#a7abb4]">
                  {entry.displayName}
                </span>
                <div className="h-1 rounded bg-[#3b3f47]">
                  <div className="h-full w-1/2 rounded bg-[#df7a38]" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mx-4 mt-4 rounded-lg border border-[#2e3239] bg-[#111317] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#797f89]">
            Validation
          </p>
          {report.issues.slice(0, 3).map((issue) => (
            <p
              key={`${issue.code}-${issue.nodeId}`}
              className={`mt-2 text-[10px] ${issue.severity === 'error' ? 'text-[#ff8175]' : 'text-[#8dd9aa]'}`}
            >
              • {issue.message}
            </p>
          ))}
        </div>
      </aside>
    </section>
  );
}

function ParameterControl({
  parameter,
  projectNode,
  exposed,
  onValue,
  onExpose,
}: {
  parameter: ParameterDefinition;
  projectNode: ProjectNode;
  exposed: boolean;
  onValue: (value: number | boolean | string) => void;
  onExpose: () => void;
}) {
  const value = projectNode.parameters[parameter.id] ?? parameter.defaultValue;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label
          className="text-xs font-medium text-[#c7cad0]"
          title={parameter.tooltip.en}
        >
          {parameter.label.en}
        </label>
        <span className="flex items-center gap-2 text-[9px] text-[#747a84]">
          Flame UI{' '}
          <Switch size="sm" checked={exposed} onCheckedChange={onExpose} />
        </span>
      </div>
      {parameter.kind === 'float' ? (
        <div className="flex items-center gap-3">
          <Slider
            className="flex-1"
            value={[Number(value)]}
            min={parameter.min}
            max={parameter.max}
            step={parameter.step}
            onValueChange={(values) =>
              onValue(Array.isArray(values) ? values[0] : values)
            }
          />
          <span className="w-14 rounded border border-[#343840] bg-[#101215] px-1.5 py-1 text-right font-mono text-[10px]">
            {Number(value).toFixed(2)}
          </span>
        </div>
      ) : parameter.kind === 'boolean' ? (
        <Switch
          checked={Boolean(value)}
          onCheckedChange={(checked) => onValue(checked)}
        />
      ) : (
        <Input
          type="color"
          value={String(value)}
          onChange={(event) => onValue(event.target.value)}
          className="h-8"
        />
      )}
    </div>
  );
}

function FlameControlEditor({
  value,
  onChange,
}: {
  value: ExposedParameter;
  onChange: (
    patch: Partial<Omit<ExposedParameter, 'id' | 'nodeId' | 'parameterId'>>,
  ) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-[#343840] bg-[#101215] p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[#ff9b59]">
        Flame UI settings
      </p>
      <Input
        value={value.displayName}
        onChange={(event) => onChange({ displayName: event.target.value })}
        aria-label="Display name"
        placeholder="Display name"
        className="h-8 text-xs"
      />
      <Input
        value={value.tooltip}
        onChange={(event) => onChange({ tooltip: event.target.value })}
        aria-label="Tooltip"
        placeholder="Tooltip"
        className="h-8 text-xs"
      />
      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ['page', value.page, 0, 6],
            ['column', value.column, 0, 5],
            ['row', value.row, 0, 4],
          ] as const
        ).map(([field, current, min, max]) => (
          <label key={field} className="text-[9px] uppercase text-[#727883]">
            {field}
            <Input
              type="number"
              min={min}
              max={max}
              value={current}
              onChange={(event) =>
                onChange({
                  [field]: Math.max(
                    min,
                    Math.min(max, Number(event.target.value)),
                  ),
                })
              }
              className="mt-1 h-7 px-2 text-[10px]"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

function CodePanel({
  tab,
  setTab,
  code,
  onClose,
}: {
  tab: 'glsl' | 'xml';
  setTab: (tab: 'glsl' | 'xml') => void;
  code: string;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-[#101215]/98 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-[#ff8b3d]">
            Read-only generated source
          </p>
          <h2 className="text-lg font-semibold">Generated code</h2>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={onClose}>
          <X />
        </Button>
      </div>
      <div className="mb-3 flex gap-2">
        <Button
          size="sm"
          variant={tab === 'glsl' ? 'default' : 'outline'}
          onClick={() => setTab('glsl')}
        >
          GLSL 430
        </Button>
        <Button
          size="sm"
          variant={tab === 'xml' ? 'default' : 'outline'}
          onClick={() => setTab('xml')}
        >
          Matchbox XML
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => navigator.clipboard.writeText(code)}
        >
          Copy
        </Button>
      </div>
      <pre className="flex-1 overflow-auto rounded-xl border border-[#30343b] bg-[#090a0c] p-4 font-mono text-[11px] leading-relaxed text-[#c9d1d9]">
        {code}
      </pre>
    </div>
  );
}

function GalleryDetail({
  project,
  onClose,
  onRemix,
}: {
  project: GalleryProject;
  onClose: () => void;
  onRemix: () => void;
}) {
  const [favorites, setFavorites] = useState(project.favoriteCount);
  const [status, setStatus] = useState('');
  const download = async () => {
    if (!project.document) {
      setStatus('No public bundle is available.');
      return;
    }
    const { buildExport, downloadBlob } = await import('@/lib/matchbox/export');
    const result = await buildExport(project.document);
    downloadBlob(result.blob, `${result.basename}.zip`);
    setStatus(`SHA-256 ${result.sha256.slice(0, 12)}…`);
  };
  const favorite = async () => {
    if (project.id.startsWith('demo-')) {
      setFavorites((value) => value + 1);
      return;
    }
    try {
      const { toggleFavorite } = await import('@/lib/supabase/gallery');
      await toggleFavorite(project.id);
      setFavorites((value) => value + 1);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };
  const report = async () => {
    if (project.id.startsWith('demo-')) {
      setStatus('This is a demo project.');
      return;
    }
    const details = window.prompt('Describe the issue');
    if (!details) return;
    try {
      const { reportProject } = await import('@/lib/supabase/gallery');
      await reportProject(project.id, details);
      setStatus('Report submitted.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    }
  };
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#0d0f11]/96 p-5 backdrop-blur">
      <div className="mx-auto max-w-5xl">
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            aria-label="Close project details"
          >
            <X />
          </Button>
        </div>
        <div className="grid gap-6 md:grid-cols-[1.35fr_1fr]">
          <div
            className="aspect-video rounded-2xl border border-[#343840]"
            style={{
              background:
                'radial-gradient(circle at 35% 40%,#ff9c59,transparent 18%),linear-gradient(130deg,#182638,#6c3f29 55%,#12131a)',
            }}
          />
          <div>
            <div className="flex gap-2">
              <Badge>{project.category}</Badge>
              {project.verifiedMac && (
                <Badge variant="outline">
                  <ShieldCheck /> macOS
                </Badge>
              )}
              {project.verifiedLinux && (
                <Badge variant="outline">
                  <ShieldCheck /> Linux
                </Badge>
              )}
            </div>
            <h1 className="mt-4 text-3xl font-semibold">{project.title}</h1>
            <p className="mt-2 text-sm text-[#8c929c]">by {project.author}</p>
            <p className="mt-5 text-sm leading-relaxed text-[#b0b4bc]">
              {project.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button onClick={onRemix}>
                <Workflow /> Remix this project
              </Button>
              <Button variant="outline" onClick={() => void favorite()}>
                <Heart /> {favorites}
              </Button>
              <Button
                variant="outline"
                onClick={() => void download()}
                disabled={!project.document}
              >
                <Download /> Download ZIP
              </Button>
              <Button variant="ghost" onClick={() => void report()}>
                <Flag /> Report
              </Button>
            </div>
            {status && <p className="mt-3 text-xs text-[#9ea3ac]">{status}</p>}
            <div className="mt-8 rounded-xl border border-[#30333a] bg-[#17191d] p-4">
              <p className="text-xs font-semibold">Project facts</p>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-xs text-[#8e939d]">
                <div>
                  <dt>Passes</dt>
                  <dd className="text-white">{project.passes}</dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd className="text-white">Flame 2025.1+</dd>
                </div>
                <div>
                  <dt>Code</dt>
                  <dd className="text-white">MIT</dd>
                </div>
                <div>
                  <dt>Media</dt>
                  <dd className="text-white">CC BY 4.0</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LearnPage() {
  const cards = [
    [
      '1. Start from a recipe',
      'Choose a working example and shape a few meaningful controls while watching the result.',
    ],
    [
      '2. Go deeper in the graph',
      'Inspect the image flow and add verified processing nodes.',
    ],
    [
      '3. Confirm in Flame',
      'Use the included helper to run shader_builder, then verify the final render in Flame.',
    ],
  ];
  return (
    <section className="min-h-[calc(100vh-56px)] bg-[#111316] p-8">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs uppercase tracking-[0.16em] text-[#ff8b3d]">
          Learn Matchbox by making
        </p>
        <h1 className="mt-2 text-4xl font-semibold">
          Start with the image, not the code.
        </h1>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {cards.map(([title, body]) => (
            <article
              key={title}
              className="rounded-xl border border-[#30333a] bg-[#181a1f] p-5"
            >
              <h2 className="font-semibold text-[#ff9c5d]">{title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-[#9399a3]">
                {body}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-8 rounded-xl border border-[#30333a] bg-[#181a1f] p-6">
          <h2 className="font-semibold">
            Browser preview ≠ final Flame render
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[#9399a3]">
            The browser uses GLSL ES 3.00 while Flame uses GLSL 430. Both are
            generated from the same graph, and the tool calls out operations
            that may differ.
          </p>
        </div>
      </div>
    </section>
  );
}

function useWebMcp(
  setProject: (project: ProjectV1) => void,
  navigate: (route: Route) => void,
) {
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options?: { signal?: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'start_matchbox_project',
            title: 'Start Matchbox project',
            description:
              'Start a visible DG Matchbox Builder project from one of the verified templates.',
            inputSchema: {
              type: 'object',
              properties: {
                templateId: {
                  type: 'string',
                  enum: TEMPLATES.map((entry) => entry.id),
                },
              },
              required: ['templateId'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: false, untrustedContentHint: false },
            execute(input: unknown) {
              const id = (input as { templateId?: string }).templateId;
              const template = TEMPLATES.find((entry) => entry.id === id);
              if (!template) throw new Error('Unknown templateId');
              const project = instantiateProject(
                template.project,
                DISPLAY_LOCALE,
              );
              setProject(project);
              navigate('builder');
              return { projectId: project.id, templateId: id, status: 'ready' };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => undefined);
    } catch {
      /* unsupported preview implementation */
    }
    return () => lifecycle.abort();
  }, [navigate, setProject]);
}
