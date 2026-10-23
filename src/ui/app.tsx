import React, { useEffect, useRef, useState } from 'react';
import { useApp } from 'ink';
import { createAgent, DEFAULT_CONFIG_DIR, type CreatedAgent } from './agent-factory';
import { WorkspaceSession } from './session';
import { useAgentStore } from './stores/agent-store';
import { useThemeStore } from './stores/theme-store';
import { useWorkspaceStore } from './stores/workspace-store';
import { MainLayout } from './components/MainLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { confirmTool } from './tool-confirmation';

export function App({ bootstrap = () => createAgent({ confirmTool }) }: { bootstrap?: () => Promise<CreatedAgent> }) {
  const { exit } = useApp();
  const [session, setSession] = useState<WorkspaceSession | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lifecycle = useRef<{ created: CreatedAgent; session: WorkspaceSession } | null>(null);
  const boot = useRef(bootstrap);
  const quitting = useRef(false);
  useEffect(() => {
    let disposed = false;
    useThemeStore.getState().init(DEFAULT_CONFIG_DIR);
    setBootError(null);
    void boot.current().then(async created => {
      const next = new WorkspaceSession(created.agent);
      if (disposed) { created.loop.stop(); await next.close(); return; }
      lifecycle.current = { created, session: next };
      setSession(next); useAgentStore.getState().setAgent(created.agent);
    }).catch(error => { if (!disposed) setBootError(error.message); });
    return () => {
      disposed = true;
      const active = lifecycle.current; lifecycle.current = null;
      active?.created.loop.stop();
      void active?.session.close().catch(() => {});
      useAgentStore.getState().stopPolling();
    };
  }, [attempt]);
  const quit = async () => {
    if (quitting.current) return;
    quitting.current = true; useWorkspaceStore.setState({ notice: '正在结束请求并保存记忆…' });
    try {
      lifecycle.current?.created.loop.stop();
      await lifecycle.current?.session.close(); exit();
    } catch (error) {
      quitting.current = false; setBootError(`保存失败：${(error as Error).message}。Ctrl+C 重试退出。`);
    }
  };
  return <ErrorBoundary area="心智工作台"><MainLayout session={session} bootError={bootError} onQuit={() => void quit()} onRetry={() => setAttempt(n => n + 1)} /></ErrorBoundary>;
}
