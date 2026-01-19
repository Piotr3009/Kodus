'use client';

/**
 * ChatMessage - pojedyncza wiadomość w chacie
 * Obsługuje wiadomości od user, claude, gpt i gemini
 * Renderuje markdown i code blocks z syntax highlighting
 */

import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check, FileCode } from 'lucide-react';
import { useState } from 'react';
import { AI_PERSONALITIES, USER_COLOR, USER_BG_COLOR } from '@/lib/constants';
import type { ChatMessage as ChatMessageType, MessageSender, AISender } from '@/lib/types';
import { cn } from '@/lib/utils';

interface ChatMessageProps {
  message: ChatMessageType;
  onInsertCode?: (code: string, filename?: string) => void;
}

// Formatowanie timestamp
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

// Komponent dla code block
function CodeBlock({
  code,
  language,
  onInsert,
}: {
  code: string;
  language?: string;
  onInsert?: (code: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-3 rounded-lg overflow-hidden bg-zinc-900 border border-zinc-700">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-800 border-b border-zinc-700">
        <span className="text-xs text-zinc-400 font-mono">{language || 'code'}</span>
        <div className="flex gap-1">
          {onInsert && (
            <button
              onClick={() => onInsert(code)}
              className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
              title="Wstaw do edytora"
            >
              <FileCode size={14} />
            </button>
          )}
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
            title="Kopiuj kod"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
        </div>
      </div>
      {/* Code */}
      <pre className="p-4 overflow-x-auto text-sm">
        <code className={`language-${language || 'plaintext'}`}>{code}</code>
      </pre>
    </div>
  );
}

// Główny komponent wiadomości
function ChatMessageComponent({ message, onInsertCode }: ChatMessageProps) {
  const { sender, content, created_at } = message;

  // Pobierz styl dla nadawcy
  const senderInfo = useMemo(() => {
    if (sender === 'user') {
      return {
        displayName: 'Ty',
        color: USER_COLOR,
        bgColor: USER_BG_COLOR,
        avatar: '👤',
        role: 'Użytkownik',
      };
    }
    return AI_PERSONALITIES[sender as AISender];
  }, [sender]);

  const isUser = sender === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-lg transition-colors',
        isUser ? 'bg-zinc-800/50' : 'bg-zinc-900/50'
      )}
    >
      {/* Avatar */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg"
        style={{ backgroundColor: senderInfo.bgColor }}
      >
        {senderInfo.avatar}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium" style={{ color: senderInfo.color }}>
            {senderInfo.displayName}
          </span>
          {!isUser && (
            <span className="text-xs text-zinc-500">
              {senderInfo.role}
            </span>
          )}
          <span className="text-xs text-zinc-600 ml-auto">
            {formatTime(created_at)}
          </span>
        </div>

        {/* Message content with markdown */}
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Customowe renderowanie code blocks
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const isInline = !match;
                const code = String(children).replace(/\n$/, '');

                if (isInline) {
                  return (
                    <code
                      className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono text-sm"
                      {...props}
                    >
                      {children}
                    </code>
                  );
                }

                return (
                  <CodeBlock
                    code={code}
                    language={match?.[1]}
                    onInsert={onInsertCode}
                  />
                );
              },
              // Stylowanie paragrafów
              p({ children }) {
                return <p className="mb-2 last:mb-0 text-zinc-200">{children}</p>;
              },
              // Stylowanie list
              ul({ children }) {
                return <ul className="list-disc list-inside mb-2 text-zinc-200">{children}</ul>;
              },
              ol({ children }) {
                return <ol className="list-decimal list-inside mb-2 text-zinc-200">{children}</ol>;
              },
              // Stylowanie nagłówków
              h1({ children }) {
                return <h1 className="text-xl font-bold mb-2 text-white">{children}</h1>;
              },
              h2({ children }) {
                return <h2 className="text-lg font-bold mb-2 text-white">{children}</h2>;
              },
              h3({ children }) {
                return <h3 className="text-base font-bold mb-2 text-white">{children}</h3>;
              },
              // Stylowanie linków
              a({ href, children }) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 underline"
                  >
                    {children}
                  </a>
                );
              },
              // Stylowanie blockquote
              blockquote({ children }) {
                return (
                  <blockquote className="border-l-4 border-zinc-600 pl-4 italic text-zinc-400 my-2">
                    {children}
                  </blockquote>
                );
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

// Memo dla optymalizacji - wiadomości się nie zmieniają
export const ChatMessage = memo(ChatMessageComponent);
