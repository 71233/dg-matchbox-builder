import { get, set } from 'idb-keyval';
import type { ProjectV1 } from '@/lib/matchbox/types';

const KEY = 'dg-matchbox-builder:current-project:v1';
export const saveLocalProject = (project: ProjectV1) => set(KEY, project);
export const loadLocalProject = () => get<ProjectV1>(KEY);
