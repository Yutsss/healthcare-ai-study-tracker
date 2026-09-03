'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  DEMO_STORAGE_KEY,
  createDemoState,
  demoReducer,
  parseDemoState,
  resetDemoState,
  saveDemoState,
  type DemoLog,
  type DemoProject,
  type DemoStarterProject,
  type DemoState,
  type ModuleStatus,
  type ProjectStatus,
} from '@/lib/demo/state';

type DemoContextValue = {
  state: DemoState;
  storageWarning: string | null;
  setModuleStatus: (moduleId: string, status: ModuleStatus) => void;
  addLog: (log: DemoLog) => void;
  deleteLog: (id: string) => void;
  saveProject: (project: DemoProject) => void;
  setProjectStatus: (id: string, status: ProjectStatus) => void;
  deleteProject: (id: string) => void;
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
  const initialStateRef = useRef<DemoState | null>(null);
  const allowedModuleIdsRef = useRef<Set<string> | null>(null);
  const skipNextSaveRef = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  const [persistenceEnabled, setPersistenceEnabled] = useState(false);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  if (!initialStateRef.current) initialStateRef.current = createDemoState(starterProjects);
  if (!allowedModuleIdsRef.current) allowedModuleIdsRef.current = new Set(moduleIds);

  const [state, dispatch] = useReducer(demoReducer, initialStateRef.current!);

  useEffect(() => {
    try {
      const serialized = window.localStorage.getItem(DEMO_STORAGE_KEY);
      dispatch({
        type: 'reset',
        initial: serialized === null ? initialStateRef.current! : parseDemoState(serialized, allowedModuleIdsRef.current!),
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

  const setModuleStatus = useCallback((moduleId: string, status: ModuleStatus) => {
    if (allowedModuleIdsRef.current?.has(moduleId)) dispatch({ type: 'module/status', moduleId, status });
  }, []);
  const addLog = useCallback((log: DemoLog) => dispatch({ type: 'log/add', log }), []);
  const deleteLog = useCallback((id: string) => dispatch({ type: 'log/delete', id }), []);
  const saveProject = useCallback((project: DemoProject) => dispatch({ type: 'project/save', project }), []);
  const setProjectStatus = useCallback((id: string, status: ProjectStatus) => dispatch({ type: 'project/status', id, status }), []);
  const deleteProject = useCallback((id: string) => dispatch({ type: 'project/delete', id }), []);
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
    storageWarning,
    setModuleStatus,
    addLog,
    deleteLog,
    saveProject,
    setProjectStatus,
    deleteProject,
    reset,
  }), [state, storageWarning, setModuleStatus, addLog, deleteLog, saveProject, setProjectStatus, deleteProject, reset]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('useDemo must be used within DemoProvider');
  return context;
}
