import { useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const LAST_PROJECT_KEY = 'novel-weaver-last-project';

export function useProjectContext() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  const getLastProjectId = useCallback(() => {
    try {
      return localStorage.getItem(LAST_PROJECT_KEY);
    } catch {
      return null;
    }
  }, []);

  const setLastProjectId = useCallback((projectId: string) => {
    try {
      localStorage.setItem(LAST_PROJECT_KEY, projectId);
    } catch (error) {
      console.error('Failed to save last project:', error);
    }
  }, []);

  const projectId = searchParams.get('projectId') || searchParams.get('project');

  const setProjectId = useCallback(
    (id: string) => {
      const next = new URLSearchParams(searchParams);
      next.set('projectId', id);
      setSearchParams(next);
      setLastProjectId(id);
    },
    [searchParams, setSearchParams, setLastProjectId]
  );

  useEffect(() => {
    if (projectId) {
      setLastProjectId(projectId);
    }
  }, [projectId, setLastProjectId]);

  return {
    projectId,
    setProjectId,
    getLastProjectId,
  };
}
