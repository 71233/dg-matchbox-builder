import { FloatingPreview } from './floating-preview';

import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Boxes,
  CheckCircle2,
  CircleHelp,
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
    chooseTemplate,
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
  const [view, setView] = useState<'preview' | 'graph' | 'code'>('preview');
  const [recipesOpen, setRecipesOpen] = useState(true);
  const [controlSearch, setControlSearch] = useState('');
  const [ready, setReady] = useState(false);
  const [saveState, setSaveState] = useState('Loading local project…');
  const [saveRetry, setSaveRetry] = useState(0);
  const saveSequence = useRef(0);
  const [openNodes, setOpenNodes] = useState<Record<string, boolean>>({});
  useEffect(() => {
    if (!selectedNodeId) return;
    // Selection originates in the graph and synchronizes the separate inspector.
    // oxlint-disable-next-line react/react-compiler
    setOpenNodes((old) => ({ ...old, [selectedNodeId]: true }));
    requestAnimationFrame(() =>
      document
        .getElementById('controls-' + selectedNodeId)
        ?.scrollIntoView({ block: 'nearest' }),
    );
  }, [selectedNodeId]);
  useEffect(() => {
    const handle = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest('input, textarea, select, [contenteditable=true]'))
        return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) useProjectStore.getState().redo();
        else useProjectStore.getState().undo();
      } else if (event.ctrlKey && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        useProjectStore.getState().redo();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);
  const backup = async () => {
    const { downloadBlob } = await import('@/lib/matchbox/export');
    downloadBlob(
      new Blob([JSON.stringify(project, null, 2)], {
        type: 'application/json',
      }),
      'project.dgmb.json',
    );
  };
  const [codeTab, setCodeTab] = useState<'glsl' | 'xml'>('glsl');
  const [status, setStatus] = useState('');
  const report = useMemo(
    () => ({ ...validateProject(project), browserCompile: compileState }),
    [project, compileState],
  );
  const generated = useMemo(() => generateShader(project), [project]);

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
      .catch(() => setStatus('Could not restore the local project.'))
      .finally(() => setReady(true));
  }, [setProject]);
  useEffect(() => {
    if (!ready) return;
    const sequence = ++saveSequence.current;
    // Reflect the start of this asynchronous persistence operation.
    // oxlint-disable-next-line react/react-compiler
    setSaveState('Saving…');
    const timer = setTimeout(() => {
      void saveLocalProject(project)
        .then(() => {
          if (sequence === saveSequence.current) setSaveState('Saved locally');
        })
        .catch(() => {
          if (sequence === saveSequence.current) setSaveState('Save failed');
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [project, ready, saveRetry]);

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
    <section
      inert={!ready}
      className={`grid min-h-[calc(100vh-56px)] grid-cols-1 ${recipesOpen ? 'lg:grid-cols-[230px_minmax(0,1fr)_310px]' : 'lg:grid-cols-[minmax(0,1fr)_310px]'}`}
    >
      {recipesOpen && (
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
              <Save className="size-4 text-[#8e939d]" /> {saveState}
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
      )}

      <section className="relative flex h-[calc(100vh-56px)] min-h-[600px] min-w-0 flex-col bg-[#0e0f11]">
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b border-[#292c32] px-4 py-2">
          <div>
            <Input
              value={project.title}
              aria-label="Project title"
              onFocus={store.beginEdit}
              onBlur={store.endEdit}
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
              size="sm"
              variant="ghost"
              onClick={() => setRecipesOpen((v) => !v)}
            >
              Recipes
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!store.past.length}
              onClick={store.undo}
            >
              Undo
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!store.future.length}
              onClick={store.redo}
            >
              Redo
            </Button>
            <div
              role="tablist"
              tabIndex={-1}
              aria-label="Workspace view"
              className="flex gap-1"
              onKeyDown={(event) => {
                const tabs = ['preview', 'graph', 'code'] as const;
                const index = tabs.indexOf(view);
                const next =
                  event.key === 'ArrowRight'
                    ? (index + 1) % 3
                    : event.key === 'ArrowLeft'
                      ? (index + 2) % 3
                      : event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? 2
                          : -1;
                if (next < 0) return;
                event.preventDefault();
                setView(tabs[next]);
                if (tabs[next] !== 'preview') setRecipesOpen(false);
                (
                  event.currentTarget.querySelectorAll('[role=tab]')[
                    next
                  ] as HTMLElement
                ).focus();
              }}
            >
              {(['preview', 'graph', 'code'] as const).map((tab) => (
                <Button
                  key={tab}
                  role="tab"
                  tabIndex={view === tab ? 0 : -1}
                  aria-selected={view === tab}
                  variant={view === tab ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    setView(tab);
                    if (tab !== 'preview') setRecipesOpen(false);
                  }}
                >
                  {tab[0].toUpperCase() + tab.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <div
          className="relative m-3 min-h-0 flex-1"
          data-testid="editing-surface"
        >
          <div
            className="absolute inset-0"
            style={{
              visibility: view === 'graph' ? 'visible' : 'hidden',
              pointerEvents: view === 'graph' ? 'auto' : 'none',
            }}
          >
            <GraphEditor active={view === 'graph'} />
          </div>
          {view === 'code' && (
            <CodePanel
              tab={codeTab}
              setTab={setCodeTab}
              code={codeTab === 'glsl' ? generated.flame : generated.xml}
            />
          )}
          <FloatingPreview floating={view !== 'preview'}>
            <PreviewCanvas
              ref={previewRef}
              project={project}
              onCompileState={setCompileState}
            />
          </FloatingPreview>
        </div>
        <output className="flex flex-wrap items-center gap-2 px-4 pb-2 text-xs">
          {saveState}
          {saveState === 'Save failed' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSaveRetry((n) => n + 1)}
            >
              Retry save
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={backup}>
            Backup project
          </Button>
        </output>
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
      </section>

      <aside className="border-l border-[#2b2e34] bg-[#15171b]">
        <div className="border-b border-[#2b2e34] p-4">
          <h2 className="mb-3 text-sm font-semibold">Node controls</h2>
          <Input
            aria-label="Search node controls"
            placeholder="Search nodes or parameters"
            value={controlSearch}
            onChange={(e) => setControlSearch(e.target.value)}
          />
        </div>
        <div
          className="max-h-[65vh] overflow-y-auto p-3"
          data-testid="node-controls"
        >
          {[...project.nodes]
            .sort((a, b) => a.pass - b.pass)
            .map((node) => {
              const definition = NODE_BY_ID.get(node.definitionId)!;
              const siblings = project.nodes.filter(
                (n) => n.definitionId === node.definitionId,
              );
              const name =
                definition.label.en +
                (siblings.length > 1
                  ? ' ' + (siblings.findIndex((n) => n.id === node.id) + 1)
                  : '');
              const query = controlSearch.toLowerCase();
              if (
                query &&
                !name.toLowerCase().includes(query) &&
                !definition.parameters.some((p) =>
                  p.label.en.toLowerCase().includes(query),
                )
              )
                return null;
              return (
                <details
                  key={node.id}
                  id={'controls-' + node.id}
                  open={Boolean(openNodes[node.id]) || Boolean(query)}
                  className={
                    'mb-2 rounded border bg-[#191c21] ' +
                    (selectedNodeId === node.id
                      ? 'border-[#ff8b3d]'
                      : 'border-[#343840]')
                  }
                >
                  <summary
                    className="cursor-pointer p-3 text-sm"
                    onClick={(event) => {
                      event.preventDefault();
                      setOpenNodes((old) => ({
                        ...old,
                        [node.id]: !old[node.id],
                      }));
                      store.selectNode(node.id);
                    }}
                  >
                    {name}{' '}
                    <span className="text-xs text-[#999]">· P{node.pass}</span>
                  </summary>
                  <div
                    className="space-y-4 border-t border-[#343840] p-3"
                    onBlurCapture={store.endEdit}
                  >
                    <label className="flex items-center justify-between text-xs">
                      Render pass
                      <select
                        aria-label={name + ' render pass'}
                        value={node.pass}
                        onChange={(e) =>
                          setNodePass(node.id, Number(e.target.value))
                        }
                      >
                        {[1, 2, 3, 4].map((pass) => (
                          <option key={pass} value={pass}>
                            P{pass}
                          </option>
                        ))}
                      </select>
                    </label>
                    {!definition.parameters.length && (
                      <p className="text-xs text-[#999]">
                        No adjustable parameters.
                      </p>
                    )}
                    {definition.parameters.map((parameter) => {
                      const exposed = project.exposedParameters.find(
                        (e) =>
                          e.nodeId === node.id &&
                          e.parameterId === parameter.id,
                      );
                      return (
                        <div key={parameter.id} className="space-y-2">
                          <ParameterControl
                            parameter={parameter}
                            projectNode={node}
                            exposed={Boolean(exposed)}
                            onValue={(value) =>
                              updateParameter(node.id, parameter.id, value)
                            }
                            onExpose={() =>
                              toggleExposed(node.id, parameter.id)
                            }
                          />
                          {exposed && (
                            <details>
                              <summary className="cursor-pointer text-xs text-[#aaa]">
                                Flame UI settings
                              </summary>
                              <FlameControlEditor
                                value={exposed}
                                onChange={(patch) =>
                                  updateExposedParameter(exposed.id, patch)
                                }
                              />
                            </details>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </details>
              );
            })}
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
          <button
            type="button"
            className="text-xs hover:text-white"
            onClick={() => onValue(parameter.defaultValue)}
          >
            Reset
          </button>
          Flame UI{' '}
          <Switch size="sm" checked={exposed} onCheckedChange={onExpose} />
        </span>
      </div>
      {parameter.kind === 'float' ? (
        <div className="flex items-center gap-3">
          <Slider
            className="flex-1 [&_[data-slot=slider-track]]:h-1 [&_[data-slot=slider-track]]:bg-[#41454c] [&_[data-slot=slider-range]]:h-full [&_[data-slot=slider-range]]:bg-[#df7a38]"
            value={[Number(value)]}
            min={parameter.min}
            max={parameter.max}
            step={parameter.step}
            onValueChange={(values) => {
              useProjectStore.getState().beginEdit();
              onValue(Array.isArray(values) ? values[0] : values);
            }}
            onValueCommitted={() => useProjectStore.getState().endEdit()}
          />
          <NumericParameterInput
            parameter={parameter}
            value={Number(value)}
            onValue={onValue}
          />
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

function NumericParameterInput({
  parameter,
  value,
  onValue,
}: {
  parameter: ParameterDefinition;
  value: number;
  onValue: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      type="number"
      aria-label={parameter.label.en + ' value'}
      className="h-8 w-20 text-xs"
      value={draft ?? value}
      min={parameter.min}
      max={parameter.max}
      step={parameter.step}
      onFocus={() => setDraft(String(value))}
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        setDraft(event.target.value);
        const n = event.target.valueAsNumber;
        if (Number.isFinite(n)) {
          useProjectStore.getState().beginEdit();
          onValue(
            Math.max(
              parameter.min ?? -Infinity,
              Math.min(parameter.max ?? Infinity, n),
            ),
          );
        }
      }}
    />
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
}: {
  tab: 'glsl' | 'xml';
  setTab: (tab: 'glsl' | 'xml') => void;
  code: string;
}) {
  return (
    <div className="absolute inset-0 flex flex-col bg-[#101215]/98 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-[#ff8b3d]">
            Read-only generated source
          </p>
          <h2 className="text-lg font-semibold">Generated code</h2>
        </div>
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
