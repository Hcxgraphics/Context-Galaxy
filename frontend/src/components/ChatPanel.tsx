"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  Send,
  User,
  Bot,
  Loader2,
  Sparkles,
  Copy,
  Check,
  RefreshCw,
  Square,
  Edit3
} from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}

interface ChatPanelProps {
  chatId: string;
  onGalaxyUpdate: () => void;
  onSetActiveRetrievals: (nodeIds: string[]) => void;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
}

// CodeBlock: Custom component rendering copy triggers
const CodeBlock = ({ language, code, isStreaming }: { language: string; code: string; isStreaming?: boolean }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code block:", err);
    }
  };

  return (
    <pre className="my-2.5 p-3.5 bg-slate-950 border border-slate-900 rounded-xl text-xs font-mono text-cyan-300 overflow-x-auto select-text shadow-inner relative group/code">
      <div className="text-[8px] uppercase font-bold tracking-widest text-slate-500 mb-1 border-b border-slate-900/60 pb-1 flex justify-between items-center select-none">
        <span>{language || "code"}</span>
        <button
          onClick={handleCopy}
          className="opacity-0 group-hover/code:opacity-100 transition-all text-slate-500 hover:text-cyan-400 p-0.5"
          title="Copy to clipboard"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </div>
      <code>
        {code}
        {isStreaming && (
          <span className="inline-block animate-pulse text-cyan-400 font-mono ml-0.5 select-none">▌</span>
        )}
      </code>
    </pre>
  );
};

const MessageCopyButton = ({ content }: { content: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy message:", err);
    }
  };

  if (!content) return null;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="absolute top-2 right-2 opacity-0 group-hover/bubble:opacity-100 transition-all text-slate-500 hover:text-cyan-400 bg-slate-950/80 hover:bg-slate-900 p-1.5 rounded-md border border-slate-800/80 backdrop-blur-sm z-20 cursor-pointer shadow-md"
      title="Copy message"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};

export default function ChatPanel({
  chatId,
  onGalaxyUpdate,
  onSetActiveRetrievals,
  messages,
  setMessages
}: ChatPanelProps) {
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [lastUserMessage, setLastUserMessage] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState<string>("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoTriggeredMessagesRef = useRef<Set<string>>(new Set());
  const pendingLocalUserIdsRef = useRef<Set<string>>(new Set());

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  // Auto-resize textarea as content changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputText]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom <= 100;
  };

  // Auto-scroll to new tokens only when the user is already near the bottom.
  useEffect(() => {
    if (shouldAutoScrollRef.current) {
      scrollToBottom("smooth");
    }
  }, [messages]);

  // Force a bottom position only on initial chat load.
  useEffect(() => {
    shouldAutoScrollRef.current = true;
    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [chatId]);

  // Clean up ongoing streams on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // Format Message content parser
  const formatMessageContent = (text: string, isStreaming?: boolean) => {
    if (!text) return null;

    const blocks = text.split("```");
    const totalBlocks = blocks.length;
    return blocks.map((block, i) => {
      if (i % 2 === 1) {
        const lines = block.split("\n");
        const language = lines[0].trim();
        const code = lines.slice(1).join("\n").trim();
        const isLastBlock = i === totalBlocks - 1;
        return <CodeBlock key={i} language={language} code={code} isStreaming={isStreaming && isLastBlock} />;
      }

      const paragraphs = block.split("\n");
      const totalParas = paragraphs.length;
      return paragraphs.map((para, j) => {
        if (!para.trim()) {
          const isLastBlock = i === totalBlocks - 1;
          const isLastPara = j === totalParas - 1;
          if (isStreaming && isLastBlock && isLastPara) {
            return (
              <div key={`${i}-${j}`} className="h-2 flex items-center">
                <span className="inline-block animate-pulse text-cyan-400 font-mono select-none">▌</span>
              </div>
            );
          }
          return <div key={`${i}-${j}`} className="h-2" />;
        }

        const isBullet = para.trim().startsWith("- ") || para.trim().startsWith("* ");
        const cleanPara = isBullet ? para.trim().substring(2) : para;

        let renderedContent: React.ReactNode[] = [];
        const parts = cleanPara.split(/(\*\*.*?\*\*|`.*?`)/g);
        
        parts.forEach((part, k) => {
          if (part.startsWith("**") && part.endsWith("**")) {
            renderedContent.push(
              <strong key={k} className="text-white font-bold filter drop-shadow-[0_0_2px_rgba(255,255,255,0.15)]">
                {part.slice(2, -2)}
              </strong>
            );
          } else if (part.startsWith("`") && part.endsWith("`")) {
            renderedContent.push(
              <code key={k} className="px-1.5 py-0.5 bg-slate-950 text-cyan-400 font-mono text-[10px] rounded border border-slate-900">
                {part.slice(1, -1)}
              </code>
            );
          } else {
            renderedContent.push(part);
          }
        });

        const isLastBlock = i === totalBlocks - 1;
        const isLastPara = j === totalParas - 1;
        if (isStreaming && isLastBlock && isLastPara) {
          renderedContent.push(
            <span key="cursor" className="inline-block animate-pulse text-cyan-400 font-mono ml-0.5 select-none">
              ▌
            </span>
          );
        }

        if (isBullet) {
          return (
            <li key={`${i}-${j}`} className="list-disc ml-5 text-[15px] text-slate-100 leading-relaxed my-0.5 select-text">
              {renderedContent}
            </li>
          );
        }

        return (
          <p key={`${i}-${j}`} className="text-[15px] text-slate-100 leading-relaxed my-1 select-text">
            {renderedContent}
          </p>
        );
      });
    });
  };

  // SSE post streaming handler
  const executeMessageStream = async (queryText: string) => {
    setIsSending(true);
    setLastUserMessage(queryText);

    // Initialize AbortController for cancel signals
    abortControllerRef.current = new AbortController();

    const assistantMessageId = Math.random().toString();
    const newAssistantMessage: Message = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      isStreaming: true
    };

    setMessages((prev) => [...prev, newAssistantMessage]);

    try {
      let response = await fetch(`${apiBase}/chat/${chatId}/stream`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "X-Accel-Buffering": "no"
        },
        body: JSON.stringify({ message: queryText }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        console.warn("Stream response failed. Falling back to non-streaming message endpoint.");
        response = await fetch(`${apiBase}/chat/${chatId}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: queryText }),
          signal: abortControllerRef.current.signal
        });

        if (!response.ok) {
          throw new Error(`Fallback endpoint failed with status ${response.status}`);
        }

        const result = await response.json();
        const content = result.content || result.message || "";
        
        if (result.retrieved_data) {
          const retrievedIds = result.retrieved_data.map((node: any) => node.id);
          onSetActiveRetrievals(retrievedIds);
        }
        onGalaxyUpdate();

        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: content }
              : msg
          )
        );
        return;
      }

      if (!response.body) {
        throw new Error("No response body available for streaming");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const blocks = buffer.split("\n\n");
        buffer = blocks.pop() || "";

        for (const block of blocks) {
          if (!block.trim()) continue;

          const eventMatch = block.match(/^event:\s*(.+)$/m);
          const dataMatch = block.match(/^data:\s*(.+)$/m);

          if (dataMatch) {
            const rawData = dataMatch[1].trim();
            const eventName = eventMatch ? eventMatch[1].trim() : "chunk";

            if (eventName === "galaxy_state") {
              try {
                const state = JSON.parse(rawData);
                if (state.retrieved_data) {
                  const retrievedIds = state.retrieved_data.map((node: any) => node.id);
                  onSetActiveRetrievals(retrievedIds);
                }
                onGalaxyUpdate();
              } catch (e) {
                console.error("Error parsing galaxy state:", e);
              }
            } else {
              try {
                const payload = JSON.parse(rawData);
                const textChunk = typeof payload === "object" && payload !== null && payload.content !== undefined
                  ? payload.content
                  : rawData;

                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: msg.content + textChunk }
                      : msg
                  )
                );
              } catch (err) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: msg.content + rawData }
                      : msg
                  )
                );
              }
            }
          } else {
            const lines = block.split("\n");
            for (const line of lines) {
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;

              if (trimmedLine.startsWith("data:")) {
                const rawData = trimmedLine.substring(5).trim();
                try {
                  const payload = JSON.parse(rawData);
                  const textChunk = typeof payload === "object" && payload !== null && payload.content !== undefined
                    ? payload.content
                    : rawData;
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: msg.content + textChunk }
                        : msg
                    )
                  );
                } catch (e) {
                  setMessages((prev) =>
                    prev.map((msg) =>
                      msg.id === assistantMessageId
                        ? { ...msg, content: msg.content + rawData }
                        : msg
                    )
                  );
                }
              } else if (!trimmedLine.startsWith("event:")) {
                setMessages((prev) =>
                  prev.map((msg) =>
                    msg.id === assistantMessageId
                      ? { ...msg, content: msg.content + trimmedLine + "\n" }
                      : msg
                  )
                );
              }
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: msg.content + "\n\n*Stream generation aborted by pilot.*" }
              : msg
          )
        );
      } else {
        console.error("Streaming error:", error);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, content: "Error connecting to Context Galaxy core. Please verify your backend server." }
              : msg
          )
        );
      }
    } finally {
      setIsSending(false);
      abortControllerRef.current = null;
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId ? { ...msg, isStreaming: false } : msg
        )
      );
      setTimeout(() => {
        onSetActiveRetrievals([]);
      }, 4000);
    }
  };

  // Resume a newly created chat whose first user message was saved before a reply existed.
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== "user" || isSending) return;
    if (pendingLocalUserIdsRef.current.has(lastMessage.id)) return;

    const triggerKey = `${chatId}:${lastMessage.id}`;
    if (autoTriggeredMessagesRef.current.has(triggerKey)) return;

    autoTriggeredMessagesRef.current.add(triggerKey);
    shouldAutoScrollRef.current = true;
    scrollToBottom("auto");
    void executeMessageStream(lastMessage.content);
  }, [chatId, messages, isSending]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const userMsg = inputText.trim();
    setInputText("");

    const newUserMessage: Message = {
      id: Math.random().toString(),
      role: "user",
      content: userMsg
    };

    pendingLocalUserIdsRef.current.add(newUserMessage.id);
    shouldAutoScrollRef.current = true;
    setMessages((prev) => [...prev, newUserMessage]);
    requestAnimationFrame(() => scrollToBottom("auto"));
    await executeMessageStream(userMsg);
  };

  const handleSaveAndResend = async (msgId: string) => {
    if (!editingContent.trim() || isSending) return;
    
    const index = messages.findIndex((m) => m.id === msgId);
    if (index === -1) return;
    
    handleStopGeneration();
    
    const updatedContent = editingContent.trim();
    setEditingMessageId(null);
    
    const trimmedMessages = messages.slice(0, index);
    const updatedUserMsg: Message = {
      id: msgId,
      role: "user",
      content: updatedContent
    };
    
    pendingLocalUserIdsRef.current.add(msgId);
    shouldAutoScrollRef.current = true;
    setMessages([...trimmedMessages, updatedUserMsg]);
    requestAnimationFrame(() => scrollToBottom("auto"));
    await executeMessageStream(updatedContent);
  };

  // Abort ongoing stream manually
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  // Regenerate last conversational prompt
  const handleRegenerateResponse = async () => {
    if (!lastUserMessage || isSending) return;
    await executeMessageStream(lastUserMessage);
  };

  return (
    <div className="w-full h-full flex flex-col z-10 text-slate-300">
      {/* Scrollable Conversation bubbles area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto pr-2 space-y-4 max-h-[calc(100vh-140px)]"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
            <Bot className="w-8 h-8 mb-2 text-primary/40 animate-pulse" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Galaxy Orbit Established
            </p>
            <p className="text-[9px] text-slate-500 max-w-[200px] leading-relaxed">
              Stellar memory paths are synchronized. Send a prompt below to see your galaxy evolve!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => {
              const isAi = msg.role === "assistant";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3 max-w-[90%] select-none group relative ${
                    isAi ? "mr-auto" : "ml-auto flex-row-reverse"
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border shadow ${
                      isAi
                        ? "bg-rose-950/40 border-rose-500/30 text-rose-400"
                        : "bg-primary/10 border-primary/20 text-primary"
                    }`}
                  >
                    {isAi ? <Bot className="w-4.5 h-4.5" /> : <User className="w-4.5 h-4.5" />}
                  </div>

                  {/* Glassmorphic bubble card or editable textarea */}
                  {editingMessageId === msg.id ? (
                    <div className="flex flex-col gap-2 w-full max-w-[320px] sm:max-w-[450px]">
                      <textarea
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSaveAndResend(msg.id);
                          } else if (e.key === "Escape") {
                            setEditingMessageId(null);
                          }
                        }}
                        className="w-full bg-[#060e25] border border-blue-900/40 text-xs text-white rounded-xl p-2.5 outline-none focus:ring-1 focus:ring-blue-700/20 resize-y min-h-[60px]"
                        autoFocus
                      />
                      <div className="flex justify-end gap-2 text-[9px] font-bold uppercase">
                        <button
                          type="button"
                          onClick={() => setEditingMessageId(null)}
                          className="px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-white rounded-lg transition-all"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveAndResend(msg.id)}
                          className="px-2.5 py-1 bg-gradient-to-r from-violet-700 to-blue-700 hover:brightness-110 text-white rounded-lg transition-all shadow"
                        >
                          Save & resend
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`p-3.5 rounded-2xl border text-[15px] shadow-[0_4px_16px_rgba(0,0,0,0.2)] select-text leading-relaxed relative group/bubble ${
                        isAi
                          ? "bg-slate-950/40 border-slate-900 rounded-tl-none text-slate-100"
                          : "bg-primary/5 border-primary/15 rounded-tr-none text-slate-100 shadow-[0_0_8px_rgba(109,93,254,0.03)]"
                      }`}
                    >
                      <MessageCopyButton content={msg.content} />
                      {msg.content === "" ? (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-bold uppercase select-none">
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Mapping memories...
                        </div>
                      ) : (
                        formatMessageContent(msg.content, msg.isStreaming)
                      )}
                    </div>
                  )}

                  {/* Edit Pencil Icon for user messages */}
                  {!isAi && editingMessageId !== msg.id && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMessageId(msg.id);
                        setEditingContent(msg.content);
                      }}
                      className="opacity-0 group-hover:opacity-100 transition-opacity self-center text-slate-500 hover:text-cyan-400 p-1 mr-1 shrink-0 cursor-pointer animate-fade-in"
                      title="Edit message"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Floating control dock for Stop/Regenerate */}
      {(messages.length > 0 || isSending) && (
        <div className="flex justify-center gap-3 my-1.5 select-none text-[9px] font-bold uppercase">
          {isSending ? (
            <button
              onClick={handleStopGeneration}
              className="px-3 py-1 bg-slate-900 border border-slate-800 hover:border-rose-500/40 hover:bg-slate-950 text-slate-400 hover:text-rose-400 transition-all rounded-lg flex items-center gap-1.5 shadow"
            >
              <Square className="w-3 h-3 fill-rose-500/10" /> Stop Generation
            </button>
          ) : (
            lastUserMessage && (
              <button
                onClick={handleRegenerateResponse}
                className="px-3 py-1 bg-slate-900 border border-slate-800 hover:border-primary/40 hover:bg-slate-950 text-slate-400 hover:text-white transition-all rounded-lg flex items-center gap-1.5 shadow"
              >
                <RefreshCw className="w-3 h-3 text-primary" /> Regenerate Response
              </button>
            )
          )}
        </div>
      )}

      {/* Input Deck */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 border border-slate-850 bg-slate-950/30 rounded-xl flex items-end gap-2.5 shadow-lg select-none mb-2"
      >
        <textarea
          ref={textareaRef}
          rows={1}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage(e);
            }
          }}
          placeholder={isSending ? "Core is projecting response..." : "Type your learning goal..."}
          className="flex-1 bg-[#060e25] border border-blue-900/40 focus:ring-1 focus:ring-blue-700/20 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-650 outline-none resize-none font-medium min-h-[38px] max-h-[200px] overflow-y-auto"
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="w-8 h-8 shrink-0 rounded-lg bg-gradient-to-r from-violet-700 to-blue-700 hover:brightness-110 active:brightness-95 text-white flex items-center justify-center transition-all disabled:from-slate-900 disabled:to-slate-900 disabled:text-slate-600 disabled:border disabled:border-slate-850 shadow-md cursor-pointer mb-0.5"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
