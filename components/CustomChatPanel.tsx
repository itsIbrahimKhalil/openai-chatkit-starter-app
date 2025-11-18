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

  const suggestedPrompts = [
    "What luxury beds do you have?",
    "Show me divan storage beds",
    "What's your return policy?",
    "Tell me about the Dorian bed",
    "Show me beds under £1000"
  ];

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

  const toggleMinimize = () => {
    const newMinimizedState = !isMinimized;
    setIsMinimized(newMinimizedState);
    
    // Communicate with parent window to resize iframe
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        type: 'chatbot-resize',
        minimized: newMinimizedState
      }, '*');
    }
  };

  return (
    <div className={`w-full h-full flex ${isMinimized ? 'items-end justify-end p-6' : 'items-stretch'}`}>
      {isMinimized ? (
        // Minimized chat button - Modern floating design
        <button
          onClick={toggleMinimize}
          className="group flex items-center gap-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 pl-4 pr-5 py-4 text-white hover:scale-105 transition-all duration-200"
        >
          <div className="relative">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {messages.length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold animate-pulse">
                {messages.length}
              </span>
            )}
          </div>
          <span className="font-semibold text-lg">Chat</span>
        </button>
      ) : (
        // Full chat panel - Takes full iframe size
        <div className="flex h-full w-full flex-col bg-white dark:bg-slate-900">
          {/* Header - Gradient design */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-white">
                  Top Notch Assistant
                </h2>
                <p className="text-xs text-blue-100">Online • Ready to help</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={clearChat}
                className="rounded-lg bg-white/20 hover:bg-white/30 px-3 py-2 text-sm text-white backdrop-blur-sm transition-all"
                title="New Chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={toggleMinimize}
                className="rounded-lg bg-white/20 hover:bg-white/30 px-3 py-2 text-sm text-white backdrop-blur-sm transition-all"
                title="Minimize chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-slate-500 dark:text-slate-400 mt-8">
            <p className="text-xl font-semibold mb-2">How can I help you today?</p>
            <p className="text-sm mb-4">Start a conversation - it will be saved automatically.</p>
            
            <div className="mt-6 space-y-2 max-w-md mx-auto">
              <p className="text-xs text-slate-400 mb-3">Try asking:</p>
              {suggestedPrompts.map((prompt, index) => (
                <button
                  key={index}
                  onClick={async () => {
                    if (!sessionId || isLoading) return;
                    
                    // Add user message directly
                    setMessages(prev => [...prev, { role: "user", content: prompt }]);
                    setIsLoading(true);

                    try {
                      const response = await fetch("/api/chat", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          input_as_text: prompt,
                          session_id: sessionId,
                          history: messages
                        }),
                      });

                      if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                      }

                      const reader = response.body?.getReader();
                      const decoder = new TextDecoder();
                      
                      if (!reader) {
                        throw new Error("No response body");
                      }

                      const assistantMessageIndex = messages.length + 1;
                      setMessages(prev => [...prev, { role: "assistant", content: "" }]);

                      let fullText = "";
                      
                      while (true) {
                        const { done, value } = await reader.read();
                        
                        if (done) break;
                        
                        const chunk = decoder.decode(value, { stream: true });
                        const lines = chunk.split('\n');
                        
                        for (const line of lines) {
                          if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            
                            if (data === '[DONE]') {
                              break;
                            }
                            
                            try {
                              const event = JSON.parse(data);
                              
                              if (event.type === 'text_chunk') {
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
                  }}
                  disabled={isLoading || !sessionId}
                  className="w-full px-4 py-3 text-sm bg-white dark:bg-slate-800 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 dark:hover:from-blue-900/20 dark:hover:to-indigo-900/20 text-slate-700 dark:text-slate-300 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200 text-left shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {prompt}
                </button>
              ))}
            </div>
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

      {/* Input - Modern elevated design */}
      <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 flex-shrink-0">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isLoading || !sessionId}
            className="flex-1 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:cursor-not-allowed transition-all"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim() || !sessionId}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 font-semibold text-white hover:from-blue-700 hover:to-indigo-700 disabled:from-slate-300 disabled:to-slate-300 dark:disabled:from-slate-700 dark:disabled:to-slate-700 disabled:cursor-not-allowed transition-all duration-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </button>
        </form>
      </div>
        </div>
      )}
    </div>
  );
}
