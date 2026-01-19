'use client';

/**
 * ConversationList - lista rozmów w sidebarze
 */

import { useState } from 'react';
import { MessageSquare, Plus, Search, Loader2 } from 'lucide-react';
import { CHAT_MODES } from '@/lib/constants';
import type { Conversation } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  isLoading?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

// Formatowanie daty
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Wczoraj';
  } else if (diffDays < 7) {
    return date.toLocaleDateString('pl-PL', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  }
}

export function ConversationList({
  conversations,
  selectedId,
  onSelect,
  onNew,
  isLoading,
  searchQuery = '',
  onSearchChange,
}: ConversationListProps) {
  // Filtrowanie po searchQuery
  const filteredConversations = conversations.filter((c) =>
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-zinc-900">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800">
        <button
          onClick={onNew}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
        >
          <Plus size={16} />
          Nowa rozmowa
        </button>
      </div>

      {/* Search */}
      {onSearchChange && (
        <div className="p-3 border-b border-zinc-800">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Szukaj..."
              className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
        </div>
      )}

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center p-4">
            <Loader2 size={20} className="animate-spin text-zinc-500" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <MessageSquare size={24} className="text-zinc-600 mb-2" />
            <p className="text-sm text-zinc-500">
              {searchQuery ? 'Brak wyników' : 'Brak rozmów'}
            </p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {filteredConversations.map((conversation) => {
              const isSelected = conversation.id === selectedId;
              const modeInfo = CHAT_MODES[conversation.mode];

              return (
                <button
                  key={conversation.id}
                  onClick={() => onSelect(conversation.id)}
                  className={cn(
                    'w-full flex items-start gap-3 p-3 rounded-lg text-left transition-colors',
                    isSelected
                      ? 'bg-zinc-800 text-white'
                      : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
                  )}
                >
                  {/* Mode indicator */}
                  <span className="flex-shrink-0 text-base mt-0.5" title={modeInfo.description}>
                    {modeInfo.icons}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">
                        {conversation.title}
                      </span>
                      <span className="flex-shrink-0 text-xs text-zinc-500">
                        {formatDate(conversation.updated_at)}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
