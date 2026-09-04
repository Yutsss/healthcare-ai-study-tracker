'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  createDemoState,
  demoReducer,
  loadDemoState,
  resetDemoState,
  saveDemoState,
  type DemoExerciseReport,
  type DemoLog,
  type DemoProject,
  type DemoSettings,
  type DemoStarterProject,
  type DemoStateV2,
  type ModuleStatus,
  type NewDemoExerciseReport,
  type ProjectStatus,
} from '@/lib/demo/state';

export type DemoContextValue = {
  state: DemoStateV2;
  hydrated: boolean;
  storageWarning: string | null;
  setModuleStatus: (moduleId: string, status: ModuleStatus, now?: Date) => void;
  addReport: (input: NewDemoExerciseReport, now?: Date) => void;
  addLog: (log: DemoLog) => void;
  deleteLog: (id: string) => void;
  saveProject: (project: DemoProject, now?: Date) => void;
  setProjectStatus: (id: string, status: ProjectStatus, now?: Date) => void;
  deleteProject: (id: string) => void;
  updateSettings: (settings: DemoSettings) => void;
  reset: () => void;
};

type DemoProviderProps = {
  moduleIds: readonly string[];
  starterProjects: readonly DemoStarterProject[];
  children: React.ReactNode;
};

const STORAGE_WARNING = 'Demo changes could not be saved in this browser.';
const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ moduleIds, starterProjects, children }: DemoProviderProps) {
  const initialStateRef = useRef<DemoStateV2 | null>(null);
  const allowedModuleIdsRef = useRef<Set<string> | null>(null);
  const starterProjectsRef = useRef(starterProjects);
  const skipNextSaveRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [persistenceEnabled, setPersistenceEnabled] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  if (!initialStateRef.current) initialStateRef.current = createDemoState(starterProjects);
  if (!allowedModuleIdsRef.current) allowedModuleIdsRef.current = new Set(moduleIds);

  const [state, dispatch] = useReducer(demoReducer, initialStateRef.current!);

  useEffect(() => {
    try {
      dispatch({
        type: 'reset',
        initial: loadDemoState(window.localStorage, allowedModuleIdsRef.current!, starterProjectsRef.current),
      });
      setPersistenceEnabled(true);
    } catch {
      setStorageWarning(STORAGE_WARNING);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated || !persistenceEnabled) return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    try {
      saveDemoState(window.localStorage, state);
    } catch {
      setStorageWarning(STORAGE_WARNING);
      setPersistenceEnabled(false);
    }
  }, [hydrated, persistenceEnabled, state]);

  const setModuleStatus = useCallback((moduleId: string, status: ModuleStatus, now?: Date) => {
    if (allowedModuleIdsRef.current?.has(moduleId)) dispatch({ type: 'module/status', moduleId, status, now: now?.toISOString() });
  }, []);
  const addReport = useCallback((input: NewDemoExerciseReport, now: Date = new Date()) => {
    if (!allowedModuleIdsRef.current?.has(input.moduleId)) return;
    const report: DemoExerciseReport = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now.toISOString(),
    };
    dispatch({ type: 'report/add', report });
  }, []);
  const addLog = useCallback((log: DemoLog) => {
    const safeLog = log.moduleId && !allowedModuleIdsRef.current?.has(log.moduleId) ? { ...log, moduleId: null } : log;
    dispatch({ type: 'log/add', log: safeLog });
  }, []);
  const deleteLog = useCallback((id: string) => dispatch({ type: 'log/delete', id }), []);
  const saveProject = useCallback((project: DemoProject, now?: Date) => dispatch({ type: 'project/save', project, now: now?.toISOString() }), []);
  const setProjectStatus = useCallback((id: string, status: ProjectStatus, now?: Date) => dispatch({ type: 'project/status', id, status, now: now?.toISOString() }), []);
  const deleteProject = useCallback((id: string) => dispatch({ type: 'project/delete', id }), []);
  const updateSettings = useCallback((settings: DemoSettings) => dispatch({ type: 'settings/update', settings }), []);
  const reset = useCallback(() => {
    skipNextSaveRef.current = true;
    try {
      resetDemoState(window.localStorage);
    } catch {
      setStorageWarning(STORAGE_WARNING);
    }
    dispatch({ type: 'reset', initial: initialStateRef.current! });
  }, []);

  const value = useMemo<DemoContextValue>(() => ({
    state,
    hydrated,
    storageWarning,
    setModuleStatus,
    addReport,
    addLog,
    deleteLog,
    saveProject,
    setProjectStatus,
    deleteProject,
    updateSettings,
    reset,
  }), [state, hydrated, storageWarning, setModuleStatus, addReport, addLog, deleteLog, saveProject, setProjectStatus, deleteProject, updateSettings, reset]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('useDemo must be used within DemoProvider');
  return context;
}
