// Φ_total(chat:mistral) — полноценный чат с Mistral AI
// Интеграция Φ_total анализа для эволюционирующей сессии

import React, { useState, useRef, useCallback } from 'react';
import { applyPhiTotal, type MistralMessage } from '@/services/MistralService';
import { sessionManager, type ProducerSession } from '@/services/SessionStateManager';

interface MistralChatProps {
  session: ProducerSession | null;
  context?: string;
}

interface ChatEntry {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  tokens?: { prompt: number; completion: number; total: number };
  analysis?: {
    type: 'phi_total' | 'suggestion' | 'insight';
    confidence: number;
    relatedMessages?: number[];
  };
}

export const MistralChat: React.FC<MistralChatProps> = ({ session, context }) => {
  const [messages, setMessages] = useState<ChatEntry[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'chat' | 'phi_analysis' | 'suggest'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatEntry = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Формируем контекст для Mistral
      const sessionContext = session 
        ? sessionManager.getSessionContext(session.id)
        : null;

      const messagesForApi: MistralMessage[] = [
        {
          role: 'system',
          content: `You are Φ_total Analysis Engine. ${mode === 'phi_analysis' 
            ? 'Apply recursive self-analysis to the session. Identify patterns, meta-insights, and evolution opportunities.' 
            : 'Analyze the producer session and provide intelligent suggestions.'}
            
${sessionContext ? `Session Context:
- Account: ${sessionContext.accountName} (${sessionContext.accountId})
- Session: ${sessionContext.sessionName}
- Messages: ${sessionContext.totalMessages}
- Summary: ${sessionContext.sessionSummary || 'N/A'}

Recent Context:
${sessionContext.recentContext}` : 'No active session context.'}

${context ? `Additional Context: ${context}` : ''}`,
        },
        ...messages.map(m => ({
          role: m.role === 'system' ? 'assistant' : m.role,
          content: m.content,
        })),
        { role: 'user', content: input },
      ];

      const response = await applyPhiTotal('mistral-chat', JSON.stringify(messagesForApi));

      if (response.ok && response.data) {
        const assistantMsg: ChatEntry = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.data.choices[0]?.message?.content || 'No response',
          timestamp: Date.now(),
          tokens: response.data.usage ? {
            prompt: response.data.usage.prompt_tokens,
            completion: response.data.usage.completion_tokens,
            total: response.data.usage.total_tokens,
          } : undefined,
          analysis: mode === 'phi_analysis' ? {
            type: 'phi_total',
            confidence: 0.95,
          } : undefined,
        };

        setMessages(prev => [...prev, assistantMsg]);

        // Если это анализ сессии - обновляем сессию
        if (mode === 'phi_analysis' && session) {
          const suggestions = extractSuggestions(response.data.choices[0]?.message?.content || '');
          sessionManager.updateSessionAnalysis(
            session.id,
            (response.data.choices[0]?.message?.content || '').slice(0, 500),
            suggestions
          );
        }
      } else {
        const errorMsg: ChatEntry = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `❌ Error: ${response.error || 'Failed to get response from Mistral'}`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errorMsg]);
      }
    } catch (error) {
      const errorMsg: ChatEntry = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ Exception: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(scrollToBottom, 100);
    }
  }, [input, messages, session, context, mode, isLoading]);

  const extractSuggestions = (content: string): string[] => {
    // Извлекаем предложения из ответа Mistral
    const suggestions: string[] = [];
    const lines = content.split('\n');
    let inSuggestions = false;
    
    for (const line of lines) {
      if (line.toLowerCase().includes('suggestion') || line.toLowerCase().includes('recommendation')) {
        inSuggestions = true;
      }
      if (inSuggestions && (line.startsWith('-') || line.startsWith('•') || /^\d+\./.test(line))) {
        suggestions.push(line.replace(/^[-•\d.\s]+/, '').trim());
      }
    }
    
    return suggestions.length > 0 ? suggestions : [content.slice(0, 200)];
  };

  const runPhiTotalAnalysis = useCallback(async () => {
    if (!session) return;
    
    setMode('phi_analysis');
    setInput(`Apply Φ_total analysis to session "${session.name}" with ${session.messages.length} messages. Identify patterns, meta-insights, and evolution paths.`);
    
    // Автоматически отправляем
    setTimeout(() => {
      sendMessage();
    }, 100);
  }, [session, sendMessage]);

  const clearChat = () => {
    setMessages([]);
  };

  if (!session) {
    return (
      <div style={styles.empty}>
        <div style={styles.emptyIcon}>🧠</div>
        <div>Select a session to start Φ_total chat with Mistral AI</div>
        <div style={styles.emptyHint}>
          The AI will analyze your Producer AI session and provide intelligent suggestions
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={styles.phiIcon}>Φ</span>
          <div>
            <div style={styles.title}>Φ_total Chat</div>
            <div style={styles.subtitle}>{session.name}</div>
          </div>
        </div>
        
        <div style={styles.headerActions}>
          <select 
            style={styles.modeSelect}
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
          >
            <option value="chat">💬 Chat</option>
            <option value="phi_analysis">🔬 Φ_total Analysis</option>
            <option value="suggest">💡 Suggest Next</option>
          </select>
          
          <button 
            style={styles.phiButton}
            onClick={runPhiTotalAnalysis}
            disabled={isLoading}
          >
            {isLoading ? '⏳' : '🔬'} Φ_total
          </button>
          
          <button style={styles.clearButton} onClick={clearChat}>
            🗑️
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messagesContainer}>
        {messages.length === 0 ? (
          <div style={styles.welcome}>
            <div style={styles.welcomeIcon}>🧠</div>
            <h4>Φ_total Analysis Engine Ready</h4>
            <p style={styles.welcomeText}>
              Start a conversation about your Producer AI session, or run 
              <strong>Φ_total Analysis</strong> for recursive self-analysis.
            </p>
            <div style={styles.quickActions}>
              <button 
                style={styles.quickBtn}
                onClick={() => { setInput('Analyze session patterns and suggest optimizations'); setMode('phi_analysis'); }}
              >
                📊 Analyze Patterns
              </button>
              <button 
                style={styles.quickBtn}
                onClick={() => { setInput('What are the key insights from this session?'); setMode('chat'); }}
              >
                🔍 Key Insights
              </button>
              <button 
                style={styles.quickBtn}
                onClick={() => { setInput('Suggest next message based on context'); setMode('suggest'); }}
              >
                💡 Suggest Next
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div 
              key={msg.id} 
              style={{
                ...styles.message,
                ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage),
                ...(msg.analysis?.type === 'phi_total' ? styles.phiMessage : {}),
              }}
            >
              <div style={styles.messageHeader}>
                <span style={styles.messageRole}>
                  {msg.role === 'user' ? '👤 You' : msg.analysis?.type === 'phi_total' ? '🔬 Φ_total' : '🧠 Mistral'}
                </span>
                <span style={styles.messageTime}>
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </span>
              </div>
              
              <div style={styles.messageContent}>{msg.content}</div>
              
              {msg.tokens && (
                <div style={styles.tokens}>
                  Tokens: {msg.tokens.total} (P: {msg.tokens.prompt}, C: {msg.tokens.completion})
                </div>
              )}
              
              {msg.analysis && (
                <div style={styles.analysisBadge}>
                  {msg.analysis.type === 'phi_total' ? '🔬 Φ_total Recursive Analysis' : '💡 AI Insight'}
                </div>
              )}
            </div>
          ))
        )}
        
        {isLoading && (
          <div style={styles.loading}>
            <div style={styles.loadingDot} />
            <div style={styles.loadingDot} />
            <div style={styles.loadingDot} />
            <span style={styles.loadingText}>Φ_total processing...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={styles.inputContainer}>
        <textarea
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder={mode === 'phi_analysis' 
            ? "Ask Φ_total to analyze session evolution..." 
            : "Type your message to Mistral AI..."}
          disabled={isLoading}
          rows={2}
        />
        <button 
          style={styles.sendButton}
          onClick={sendMessage}
          disabled={!input.trim() || isLoading}
        >
          {isLoading ? '⏳' : '➤'}
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '500px',
    background: '#1a1a2e',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#2a2a4e',
    borderBottom: '1px solid #3a3a6e',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  phiIcon: {
    fontSize: '1.5em',
    color: '#00d4aa',
    fontWeight: 'bold',
  },
  title: {
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: '0.85em',
    color: '#888',
  },
  headerActions: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  modeSelect: {
    padding: '6px 10px',
    background: '#1a1a2e',
    color: '#eee',
    border: '1px solid #3a3a6e',
    borderRadius: '4px',
    fontSize: '0.9em',
  },
  phiButton: {
    padding: '6px 12px',
    background: 'linear-gradient(135deg, #00d4aa, #00a884)',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.9em',
  },
  clearButton: {
    padding: '6px 10px',
    background: '#3a3a6e',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#888',
    textAlign: 'center',
  },
  emptyIcon: {
    fontSize: '3em',
    marginBottom: '16px',
    opacity: 0.5,
  },
  emptyHint: {
    fontSize: '0.9em',
    color: '#666',
    marginTop: '8px',
    maxWidth: '300px',
  },
  welcome: {
    textAlign: 'center',
    padding: '40px 20px',
    color: '#888',
  },
  welcomeIcon: {
    fontSize: '3em',
    marginBottom: '16px',
  },
  welcomeText: {
    margin: '16px 0',
    lineHeight: '1.6',
  },
  quickActions: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: '20px',
  },
  quickBtn: {
    padding: '8px 16px',
    background: '#2a2a4e',
    color: '#00d4aa',
    border: '1px solid #00d4aa',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.85em',
  },
  message: {
    padding: '12px 16px',
    borderRadius: '8px',
    maxWidth: '85%',
  },
  userMessage: {
    background: '#2a2a4e',
    alignSelf: 'flex-end',
    borderBottomRightRadius: '2px',
  },
  assistantMessage: {
    background: '#3a3a6e',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: '2px',
  },
  phiMessage: {
    background: 'linear-gradient(135deg, #2a2a4e, #1a3a3e)',
    border: '1px solid #00d4aa',
  },
  messageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px',
    fontSize: '0.85em',
  },
  messageRole: {
    fontWeight: 'bold',
    color: '#00d4aa',
  },
  messageTime: {
    color: '#666',
    fontSize: '0.8em',
  },
  messageContent: {
    color: '#eee',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
  },
  tokens: {
    marginTop: '8px',
    fontSize: '0.75em',
    color: '#666',
    textAlign: 'right',
  },
  analysisBadge: {
    marginTop: '8px',
    padding: '4px 8px',
    background: 'rgba(0, 212, 170, 0.2)',
    color: '#00d4aa',
    borderRadius: '4px',
    fontSize: '0.75em',
    display: 'inline-block',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '20px',
  },
  loadingDot: {
    width: '8px',
    height: '8px',
    background: '#00d4aa',
    borderRadius: '50%',
    animation: 'bounce 1.4s infinite ease-in-out both',
  },
  loadingText: {
    color: '#888',
    fontSize: '0.9em',
    marginLeft: '8px',
  },
  inputContainer: {
    display: 'flex',
    padding: '12px 16px',
    background: '#2a2a4e',
    borderTop: '1px solid #3a3a6e',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '10px 14px',
    background: '#1a1a2e',
    color: '#eee',
    border: '1px solid #3a3a6e',
    borderRadius: '6px',
    resize: 'none',
    fontFamily: 'inherit',
    fontSize: '0.95em',
    outline: 'none',
  },
  sendButton: {
    padding: '10px 16px',
    background: '#00d4aa',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1.2em',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

export default MistralChat;
