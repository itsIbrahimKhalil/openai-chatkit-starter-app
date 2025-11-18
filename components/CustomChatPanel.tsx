/**
 * Example: Custom Chat Component with Session Tracking
 * 
 * This file demonstrates how to build a custom chat interface that uses
 * the /api/chat endpoint with persistent memory via Vercel KV.
 * 
 * To use this component instead of ChatKit:
 * 1. Replace ChatKitPanel import in App.tsx with this component
 * 2. Make sure KV environment variables are set
 * 3. Test with messages that reference previous context
 */

"use client";

import { useState, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function CustomChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize session ID and load messages on mount
  useEffect(() => {
    let id = localStorage.getItem("chat_session_id");
    if (!id) {
      id = uuidv4();
      localStorage.setItem("chat_session_id", id);
    }
    setSessionId(id);

    // Load saved messages from localStorage
    const savedMessages = localStorage.getItem("chat_messages");
    if (savedMessages) {
      try {
        setMessages(JSON.parse(savedMessages));
      } catch (error) {
        console.error("Failed to load messages:", error);
      }
    }
  }, []);

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("chat_messages", JSON.stringify(messages));
    }
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || !sessionId || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    
    // Add user message to UI
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input_as_text: userMessage,
          session_id: sessionId,
          history: messages // Send full conversation history
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Handle SSE streaming
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error("No response body");
      }

      // Add an empty assistant message that we'll update as chunks arrive
      const assistantMessageIndex = messages.length + 1; // +1 because we already added user message
      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

      let fullText = "";
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6); // Remove 'data: ' prefix
            
            if (data === '[DONE]') {
              break;
            }
            
            try {
              const event = JSON.parse(data);
              
              // Handle different event types
              if (event.type === 'text_chunk') {
                // Stream text chunks character by character
                fullText += event.text;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[assistantMessageIndex] = {
                    role: "assistant",
                    content: fullText
                  };
                  return newMessages;
                });
              } else if (event.type === 'final') {
                // Final output
                fullText = event.output_text || fullText;
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[assistantMessageIndex] = {
                    role: "assistant",
                    content: fullText
                  };
                  return newMessages;
                });
              } else if (event.type === 'error') {
                throw new Error(event.error);
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e, data);
            }
          }
        }
      }
      
      // If no content was streamed, show a default message
      if (!fullText) {
        setMessages(prev => {
          const newMessages = [...prev];
          newMessages[assistantMessageIndex] = {
            role: "assistant",
            content: "No response from agent."
          };
          return newMessages;
        });
      }
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error. Please try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const clearChat = () => {
    // Generate new session ID to start fresh
    const newId = uuidv4();
    localStorage.setItem("chat_session_id", newId);
    localStorage.removeItem("chat_messages");
    setSessionId(newId);
    setMessages([]);
  };

  return (
    <div className={`fixed ${isMinimized ? 'bottom-4 right-4' : 'bottom-0 right-0 m-4'} ${isMinimized ? 'w-auto' : 'w-full max-w-2xl'} transition-all duration-300 z-50`}>
      {isMinimized ? (
        // Minimized chat button
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 rounded-full bg-blue-600 px-6 py-3 text-white shadow-lg hover:bg-blue-700 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className="font-semibold">Chat with us</span>
          {messages.length > 0 && (
            <span className="bg-white text-blue-600 rounded-full px-2 py-0.5 text-xs font-bold">
              {messages.length}
            </span>
          )}
        </button>
      ) : (
        // Full chat panel
        <div className="flex h-[600px] flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-900">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Chat Assistant
            </h2>
            <div className="flex gap-2">
              <button
                onClick={clearChat}
                className="rounded-lg bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                New Chat
              </button>
              <button
                onClick={() => setIsMinimized(true)}
                className="rounded-lg bg-slate-100 px-3 py-1 text-sm text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                title="Minimize chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 dark:text-slate-400 mt-8">
            <p className="text-xl font-semibold mb-2">How can I help you today?</p>
            <p className="text-sm">Start a conversation - it will be saved automatically.</p>
          </div>
        )}
        
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="rounded-lg bg-slate-100 px-4 py-2 dark:bg-slate-800">
              <div className="flex space-x-2">
                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400"></div>
                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0.1s" }}></div>
                <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0.2s" }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-slate-200 p-4 dark:border-slate-700">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Type your message..."
            disabled={isLoading || !sessionId}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-blue-400 dark:focus:ring-blue-400"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={isLoading || !input.trim() || !sessionId}
            className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed dark:disabled:bg-slate-700"
          >
            Send
          </button>
        </div>
        {sessionId && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Session: {sessionId.slice(0, 8)}...
          </p>
        )}
      </div>
        </div>
      )}
    </div>
  );
}
