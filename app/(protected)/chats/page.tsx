'use client';

import { useEffect, useRef, useState, useCallback, FormEvent } from 'react';
import {
  listChats,
  createChat,
  getChat,
  deleteChat,
  sendMessage,
  deleteMessage,
  type TeamChat,
  type TeamChatDetail,
  type TeamChatMessage,
} from '@/services/chats';
import { useAuthStore } from '@/lib/auth-store';

// ─── Icons ────────────────────────────────────────────────────────────────────

function IconPlus() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}
function IconSend() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

// ─── New Chat Modal ───────────────────────────────────────────────────────────

function NewChatModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (chat: TeamChat) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Chat name is required'); return; }
    setLoading(true);
    setError('');
    try {
      const chat = await createChat({ name: name.trim(), description: description.trim() || undefined });
      onCreate(chat);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create chat');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-md rounded-xl border border-border-color bg-bg-primary p-6 shadow-xl">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">New Chat</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Chat Name *</label>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Sales Team, Support Squad"
              className="w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-secondary">Description (optional)</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What's this chat for?"
              className="w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder-text-secondary focus:border-accent focus:outline-none"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border-color px-4 py-2 text-sm text-text-secondary hover:bg-bg-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
            >
              {loading ? 'Creating…' : 'Create Chat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Chat List Sidebar ────────────────────────────────────────────────────────

function ChatListItem({
  chat,
  isActive,
  onClick,
}: {
  chat: TeamChat;
  isActive: boolean;
  onClick: () => void;
}) {
  const timeLabel = chat.last_message_at
    ? new Date(chat.last_message_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : new Date(chat.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-lg px-3 py-3 text-left transition-colors ${
        isActive
          ? 'bg-card-bg border border-border-color'
          : 'hover:bg-bg-secondary border border-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-xs font-bold uppercase">
            {chat.name.slice(0, 2)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">{chat.name}</p>
            {chat.last_message ? (
              <p className="truncate text-xs text-text-secondary">{chat.last_message}</p>
            ) : (
              <p className="text-xs text-text-secondary italic">No messages yet</p>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] text-text-secondary">{timeLabel}</p>
          {chat.message_count > 0 && (
            <span className="mt-0.5 inline-block rounded-full bg-accent/20 px-1.5 py-0.5 text-[9px] font-medium text-accent">
              {chat.message_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isMine,
  onDelete,
}: {
  msg: TeamChatMessage;
  isMine: boolean;
  onDelete?: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const time = new Date(msg.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const senderName = msg.sender?.name || `User ${msg.sender_id}`;

  return (
    <div
      className={`group flex items-end gap-2 ${isMine ? 'flex-row-reverse' : 'flex-row'}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      {!isMine && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bg-secondary border border-border-color text-[10px] font-bold text-text-secondary uppercase">
          {senderName.slice(0, 2)}
        </div>
      )}

      <div className={`flex flex-col max-w-[70%] ${isMine ? 'items-end' : 'items-start'}`}>
        {!isMine && (
          <span className="mb-0.5 px-1 text-[10px] font-medium text-text-secondary">{senderName}</span>
        )}
        <div
          className={`relative rounded-2xl px-3 py-2 text-sm leading-relaxed ${
            isMine
              ? 'rounded-br-sm bg-accent text-white'
              : 'rounded-bl-sm bg-card-bg border border-border-color text-text-primary'
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        </div>
        <div className="mt-0.5 flex items-center gap-2">
          <span className="text-[10px] text-text-secondary">{time}</span>
          {isMine && hovered && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="text-[10px] text-red-400 hover:text-red-300 transition-colors"
            >
              delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Chat View (right pane) ───────────────────────────────────────────────────

function ChatView({
  chatId,
  currentUserId,
  onChatDeleted,
}: {
  chatId: number;
  currentUserId: number;
  onChatDeleted: () => void;
}) {
  const [chat, setChat] = useState<TeamChatDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getChat(chatId, 200);
      setChat(data);
    } catch {
      setError('Failed to load chat');
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    load();
    // Poll every 5 seconds for new messages
    pollRef.current = setInterval(() => load(true), 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [load]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat?.messages?.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    try {
      const msg = await sendMessage(chatId, text);
      setChat(prev => prev ? { ...prev, messages: [...prev.messages, msg] } : prev);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch {
      setInput(text); // restore on failure
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleDeleteMsg = async (msgId: number) => {
    try {
      await deleteMessage(chatId, msgId);
      setChat(prev => prev ? { ...prev, messages: prev.messages.filter(m => m.id !== msgId) } : prev);
    } catch { /* ignore */ }
  };

  const handleDeleteChat = async () => {
    if (!confirm(`Delete "${chat?.name}"? This cannot be undone.`)) return;
    try {
      await deleteChat(chatId);
      onChatDeleted();
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center text-text-secondary">
        <div className="flex flex-col items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-xs">Loading chat…</span>
        </div>
      </div>
    );
  }

  if (!chat) {
    return <div className="flex flex-1 items-center justify-center text-text-secondary text-sm">Chat not found</div>;
  }

  const isCreator = chat.created_by_id === currentUserId;

  return (
    <div className="flex flex-1 flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-color px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">{chat.name}</h2>
          {chat.description && (
            <p className="text-xs text-text-secondary">{chat.description}</p>
          )}
        </div>
        {isCreator && (
          <button
            type="button"
            onClick={handleDeleteChat}
            className="flex items-center gap-1.5 rounded-lg border border-border-color px-3 py-1.5 text-xs text-red-400 hover:bg-red-900/20 transition-colors"
          >
            <IconTrash />
            Delete Chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {chat.messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 rounded-full bg-accent/10 p-4 text-accent">
              <IconChat />
            </div>
            <p className="text-sm font-medium text-text-primary">Start the conversation!</p>
            <p className="mt-1 text-xs text-text-secondary">Be the first to send a message.</p>
          </div>
        ) : (
          chat.messages.map(msg => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              isMine={msg.sender_id === currentUserId}
              onDelete={msg.sender_id === currentUserId ? () => handleDeleteMsg(msg.id) : undefined}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border-color px-4 py-3">
        <div className="flex items-end gap-2 rounded-xl border border-border-color bg-bg-secondary px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder-text-secondary focus:outline-none"
            style={{ maxHeight: '120px', overflowY: 'auto' }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <IconSend />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-text-secondary">Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ChatsPage() {
  const user = useAuthStore(s => s.user as any);
  const currentUserId: number = user?.id ?? 0;

  const [chats, setChats] = useState<TeamChat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const loadChats = useCallback(async () => {
    try {
      const res = await listChats({ search: search || undefined, per_page: 50 });
      setChats(res.chats);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    setLoading(true);
    const t = setTimeout(() => loadChats(), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [loadChats, search]);

  const handleChatCreated = (chat: TeamChat) => {
    setChats(prev => [chat, ...prev]);
    setSelectedId(chat.id);
  };

  const handleChatDeleted = () => {
    setSelectedId(null);
    loadChats();
  };

  return (
    <div className="flex h-full min-h-0 overflow-hidden rounded-xl border border-border-color bg-bg-primary">
      {/* ── Left Sidebar: Chat List ── */}
      <aside className="flex w-64 shrink-0 flex-col border-r border-border-color lg:w-72">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-color px-4 py-3">
          <h1 className="text-sm font-semibold text-text-primary">Team Chats</h1>
          <button
            type="button"
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1.5 text-xs font-medium text-white hover:opacity-90 transition-opacity"
          >
            <IconPlus />
            New Chat
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-border-color px-3 py-2">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search chats…"
            className="w-full rounded-lg border border-border-color bg-bg-secondary px-3 py-1.5 text-xs text-text-primary placeholder-text-secondary focus:border-accent focus:outline-none"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-text-secondary">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : chats.length === 0 ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                <IconChat />
              </div>
              <p className="text-xs text-text-secondary">
                {search ? 'No chats found' : 'No chats yet'}
              </p>
              {!search && (
                <button
                  type="button"
                  onClick={() => setShowNewModal(true)}
                  className="mt-2 text-xs text-accent hover:underline"
                >
                  Create your first chat
                </button>
              )}
            </div>
          ) : (
            chats.map(chat => (
              <ChatListItem
                key={chat.id}
                chat={chat}
                isActive={chat.id === selectedId}
                onClick={() => setSelectedId(chat.id)}
              />
            ))
          )}
        </div>
      </aside>

      {/* ── Right Pane: Chat View ── */}
      <div className="flex flex-1 flex-col min-h-0 min-w-0">
        {selectedId ? (
          <ChatView
            key={selectedId}
            chatId={selectedId}
            currentUserId={currentUserId}
            onChatDeleted={handleChatDeleted}
          />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center px-6">
            <div className="rounded-full bg-accent/10 p-6 text-accent">
              <IconChat />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Team Chats</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Select a chat to start messaging, or create a new one.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              <IconPlus />
              New Chat
            </button>
          </div>
        )}
      </div>

      {/* ── New Chat Modal ── */}
      {showNewModal && (
        <NewChatModal
          onClose={() => setShowNewModal(false)}
          onCreate={handleChatCreated}
        />
      )}
    </div>
  );
}
