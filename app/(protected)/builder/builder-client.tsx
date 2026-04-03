'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  sendBuilderMessage,
  getBuilderState,
  resetBuilder,
  type BuilderTurnResponse,
} from '@/services/builder';
import PhaseProgress from './components/phase-progress';
import BuilderChat from './components/builder-chat';
import BlueprintPreview from './components/blueprint-preview';
import { RotateCcw } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function BuilderClient() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [phase, setPhase] = useState<string>('greeting');
  const [phaseProgress, setPhaseProgress] = useState<Record<string, string>>({});
  const [collected, setCollected] = useState<Record<string, unknown>>({});
  const [blueprintPreview, setBlueprintPreview] = useState<Record<string, unknown> | null>(null);
  const [applyResult, setApplyResult] = useState<BuilderTurnResponse['apply_result']>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Check for existing session on mount
  useEffect(() => {
    (async () => {
      try {
        const state = await getBuilderState();
        if (state.active && state.phase) {
          setPhase(state.phase);
          setPhaseProgress(state.phase_progress || {});
          setCollected((state.collected as Record<string, unknown>) || {});
          if (state.blueprint_preview) {
            setBlueprintPreview(state.blueprint_preview as Record<string, unknown>);
          }
        }
      } catch {
        // No session, start fresh
      }
      setIsInitialized(true);
    })();
  }, []);

  // Auto-start conversation if no session exists
  useEffect(() => {
    if (isInitialized && messages.length === 0 && phase === 'greeting') {
      handleSend('hi');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInitialized]);

  // Show preview panel when blueprint is available
  useEffect(() => {
    if (blueprintPreview) setShowPreview(true);
  }, [blueprintPreview]);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      const res = await sendBuilderMessage(text);
      setPhase(res.phase);
      setPhaseProgress(res.phase_progress);
      setCollected(res.collected);
      if (res.blueprint_preview) setBlueprintPreview(res.blueprint_preview);
      if (res.apply_result) setApplyResult(res.apply_result);

      const assistantMsg: Message = { role: 'assistant', content: res.reply };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: Message = {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.',
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const handleReset = useCallback(async () => {
    await resetBuilder();
    setMessages([]);
    setPhase('greeting');
    setPhaseProgress({});
    setCollected({});
    setBlueprintPreview(null);
    setApplyResult(null);
    setShowPreview(false);
    // Re-trigger greeting
    setTimeout(() => handleSend('hi'), 100);
  }, [handleSend]);

  if (!isInitialized) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-xs text-text-secondary">Loading builder...</div>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Phase Progress */}
      <div className="w-56 shrink-0 border-r border-border-color bg-bg-secondary p-4 overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
            Setup Progress
          </h3>
          <button
            onClick={handleReset}
            className="rounded p-1 text-text-secondary hover:bg-white/10 hover:text-text-primary transition-colors"
            title="Start over"
          >
            <RotateCcw size={14} />
          </button>
        </div>
        <PhaseProgress progress={phaseProgress} currentPhase={phase} />
      </div>

      {/* Center: Chat */}
      <div className="flex flex-1 flex-col min-w-0">
        <div className="border-b border-border-color px-4 py-3">
          <h2 className="text-sm font-semibold text-text-primary">Business Builder</h2>
          <p className="text-xs text-text-secondary">
            Tell me about your business and I'll set up your entire system.
          </p>
        </div>
        <BuilderChat
          messages={messages}
          isLoading={isLoading}
          onSend={handleSend}
          phase={phase}
        />
      </div>

      {/* Right: Blueprint Preview (shown when available) */}
      {showPreview && (
        <div className="w-80 shrink-0 border-l border-border-color bg-bg-secondary overflow-y-auto">
          <BlueprintPreview
            blueprint={blueprintPreview}
            applyResult={applyResult}
            phase={phase}
            onClose={() => setShowPreview(false)}
          />
        </div>
      )}
    </div>
  );
}
