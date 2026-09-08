// components/QoderChat.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export default function QoderChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // First-login / Session greeting logic
    useEffect(() => {
        const hasGreeted = sessionStorage.getItem('qoder_chat_greeted');
        if (!hasGreeted) {
            const welcomeMsg: Message = {
                role: 'assistant',
                content: "👋 Welcome to Qoder! I'm your AI Code Tutor & Architecture Advisor. Stuck on a bug or want advice on your C# or Java class structures? Ask away!"
            };
            setMessages([welcomeMsg]);
            sessionStorage.setItem('qoder_chat_greeted', 'true');
        }
    }, []);

    // Auto-scroll to bottom of chat
    useEffect(() => {
        if (isOpen) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, isOpen]);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMsg: Message = { role: 'user', content: input };
        const updatedMessages = [...messages, userMsg];
        
        setMessages(updatedMessages);
        setInput('');
        setLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: updatedMessages }),
            });

            const data = await res.json();
            if (res.ok) {
                setMessages([...updatedMessages, { role: 'assistant', content: data.content }]);
            } else {
                setMessages([...updatedMessages, { role: 'assistant', content: "⚠️ Error: Could not reach Qoder AI right now." }]);
            }
        } catch (err) {
            setMessages([...updatedMessages, { role: 'assistant', content: "⚠️ Network error occurred." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Expanded Chat Window */}
            {isOpen && (
                <div className="mb-3 flex flex-col h-[480px] w-80 sm:w-96 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
                    {/* Header */}
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between">
                        <div>
                            <h2 className="font-bold text-sm tracking-wide text-indigo-600 dark:text-indigo-400">QODER AI TUTOR</h2>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Your coding & architecture guide</p>
                        </div>
                        <button 
                            onClick={() => setIsOpen(false)}
                            className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-lg font-semibold px-2 py-1 rounded transition"
                        >
                            &times;
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((m, index) => (
                            <div 
                                key={index} 
                                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
                            >
                                <div className={`max-w-[85%] rounded-xl p-3 text-sm leading-relaxed ${
                                    m.role === 'user' 
                                        ? 'bg-indigo-600 text-white' 
                                        : 'bg-zinc-800 text-zinc-200 border border-zinc-700'
                                }`}>
                                    {m.content}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="text-xs text-zinc-500 animate-pulse">Qoder AI is analyzing code...</div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Form */}
                    <form onSubmit={sendMessage} className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 flex gap-2">
                        <input 
                            type="text" 
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about code, bugs, or architecture..."
                            className="flex-1 bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-500"
                        />
                        <button 
                            type="submit" 
                            disabled={loading}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                        >
                            Send
                        </button>
                    </form>
                </div>
            )}

            {/* Floating Toggle Bubble Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="h-14 w-14 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xl flex items-center justify-center transition transform hover:scale-105 active:scale-95 focus:outline-none"
                aria-label="Toggle Qoder AI Tutor"
            >
                {isOpen ? (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                ) : (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                )}
            </button>
        </div>
    );
}