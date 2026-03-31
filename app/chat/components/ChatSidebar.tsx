"use client";

interface ChatSummary {
  id: string;
  title: string;
  updatedAt: string;
}

interface ChatSidebarProps {
  chats: ChatSummary[];
  activeChatId: string | null;
  onSelect: (chatId: string) => void;
  onNew: () => void;
  onDelete: (chatId: string) => void;
}

export default function ChatSidebar({
  chats,
  activeChatId,
  onSelect,
  onNew,
  onDelete,
}: ChatSidebarProps) {
  return (
    <aside className="w-[280px] shrink-0 bg-surface border-r border-border sticky top-[57px] self-start h-[calc(100vh-57px)] flex flex-col">
      <div className="p-4">
        <button
          onClick={onNew}
          className="w-full px-4 py-2 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
        >
          + New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pb-4">
        {chats.length === 0 && (
          <p className="px-4 text-sm text-muted">No conversations yet</p>
        )}
        {chats.map((chat) => {
          const isActive = chat.id === activeChatId;
          return (
            <button
              key={chat.id}
              onClick={() => onSelect(chat.id)}
              className={`w-full text-left px-4 py-3 text-sm flex items-start gap-2 transition-colors group ${
                isActive
                  ? "bg-accent-light text-accent"
                  : "text-muted hover:text-foreground hover:bg-background"
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{chat.title}</div>
                <div className="text-[11px] text-muted mt-0.5">
                  {new Date(chat.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(chat.id);
                }}
                className="opacity-0 group-hover:opacity-100 shrink-0 text-muted hover:text-red-500 transition-all text-xs mt-0.5"
                title="Delete chat"
              >
                &times;
              </button>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
