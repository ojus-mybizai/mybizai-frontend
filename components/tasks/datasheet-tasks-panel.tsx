'use client';

import { useCallback, useEffect, useState } from 'react';
import { X, Plus, CheckCircle2, Clock, User } from 'lucide-react';
import { listTasks, type Task } from '@/services/tasks';
import { formatDayMonth } from '@/lib/format-date';
import { TaskDrawer } from './task-drawer';
import { CreateTaskModal } from './create-task-modal';

const STATUS_PILL: Record<string, string> = {
  open: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  done: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export function DatasheetTasksPanel({
  datasheetId,
  onClose,
}: {
  datasheetId: number;
  onClose: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listTasks({ datasheet_id: datasheetId })
      .then(all => setTasks(all))
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [datasheetId]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-30" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-80 lg:w-96 bg-bg-primary border-l border-border-secondary shadow-2xl z-40 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-secondary">
          <h2 className="text-sm font-semibold text-text-primary">Tasks for this datasheet</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-secondary">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-border-secondary">
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" /> Create task for this sheet
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="text-center py-8 text-sm text-text-secondary">Loading tasks...</div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-sm text-text-secondary">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-2 opacity-20" />
              No tasks linked to this datasheet yet.
            </div>
          ) : (
            <div className="divide-y divide-border-secondary">
              {tasks.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTaskId(t.id)}
                  className="w-full text-left px-4 py-3 hover:bg-bg-secondary/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-text-primary truncate">{t.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_PILL[t.status]}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-text-secondary">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> {t.assignee_name || 'Unassigned'}
                    </span>
                    {t.due_at && (
                      <span className={`flex items-center gap-1 ${t.is_overdue ? 'text-red-600 dark:text-red-400' : ''}`}>
                        <Clock className="w-3 h-3" /> {formatDayMonth(t.due_at)}
                      </span>
                    )}
                    {t.record_id && (
                      <span className="text-emerald-600 dark:text-emerald-400">record #{t.record_id}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedTaskId && (
        <TaskDrawer
          taskId={selectedTaskId}
          onClose={() => setSelectedTaskId(null)}
          onTaskUpdated={load}
        />
      )}

      {showCreate && (
        <CreateTaskModal
          prefillDatasheetId={datasheetId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); load(); }}
        />
      )}
    </>
  );
}
