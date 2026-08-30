import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';
import { Bot, Send, X, Sparkles, RefreshCw, User, ShieldCheck } from 'lucide-react';

interface AiConsultantModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialContextData?: any;
}

export const AiConsultantModal: React.FC<AiConsultantModalProps> = ({
  isOpen,
  onClose,
  initialContextData,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      content: '您好！我是山东新硕捷电子科技有限公司的 AI 电源选型与代理比价助手。我可以为您提供山特、硕天、华为、维谛、科士达等多品牌 UPS 的型号对比、蓄电池容量测算及工频/高频施工建议。请问有什么可以协助您？',
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const [inputPrompt, setInputPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // If passed initial context data, trigger query
  useEffect(() => {
    if (initialContextData && isOpen) {
      let prompt = '';
      if (initialContextData.prompt) {
        prompt = initialContextData.prompt;
      } else if (initialContextData.powerKw) {
        prompt = `我的项目设备功率为 ${initialContextData.powerKw} kW，期望续航 ${initialContextData.backupTime}，计算出的匹配型号是 ${initialContextData.recommendedModel}。请帮我评估一下此方案并给出专业建议。`;
      }
      if (prompt) {
        handleSendMessage(prompt);
      }
    }
  }, [initialContextData, isOpen]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  if (!isOpen) return null;

  const sampleQuestions = [
    '100kW机房配电池需后备2小时，选型与电池参数怎么定？',
    '高频在线式UPS与工频隔离UPS怎么选择？',
    '数据中心模块化UPS N+1 和 2N 架构有什么区别？',
  ];

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = textToSend || inputPrompt;
    if (!prompt.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: prompt,
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInputPrompt('');
    setLoading(true);

    try {
      const response = await fetch('/api/consult', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: userMsg.content,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
          loadInfo: initialContextData && initialContextData.powerKw ? initialContextData : undefined,
        }),
      });

      const data = await response.json();

      if (data.error) {
        const errorMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: `⚠️ 系统提示: ${data.error}`,
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, errorMsg]);
      } else {
        const modelMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          content: data.text || '暂无回复',
          timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages((prev) => [...prev, modelMsg]);
      }
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        content: '⚠️ 通信失败，请检查网络或稍后再试。',
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-none max-w-2xl w-full h-[600px] flex flex-col shadow-2xl overflow-hidden relative">
        
        {/* Header */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-none bg-amber-500/10 text-amber-700 border border-amber-500/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900 font-display">新硕捷 AI 电源比价与选型助手</h3>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-none font-mono border border-emerald-300">
                  ONLINE
                </span>
              </div>
              <p className="text-[11px] text-slate-500">智能为您解答 UPS 不间断电源选型与电力架构</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-none text-slate-400 hover:text-slate-700 hover:bg-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message Log */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs font-sans bg-slate-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'model' && (
                <div className="w-7 h-7 rounded-none bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-[80%] rounded-none p-3.5 space-y-1 ${
                  msg.role === 'user'
                    ? 'bg-amber-500 text-slate-950 font-medium'
                    : 'bg-white border border-slate-200 text-slate-800 shadow-sm'
                }`}
              >
                <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                <span className={`block text-[10px] text-right ${msg.role === 'user' ? 'text-slate-800' : 'text-slate-400'}`}>
                  {msg.timestamp}
                </span>
              </div>

              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-none bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-center text-slate-500 text-xs italic">
              <Bot className="w-4 h-4 text-amber-600 animate-spin" />
              <span>AI 正在为您计算并生成技术建议...</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Quick Sample Questions */}
        <div className="px-4 py-2 bg-slate-100 border-t border-slate-200 flex flex-wrap gap-1.5">
          {sampleQuestions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(q)}
              className="text-[11px] bg-white hover:bg-slate-200 text-amber-800 px-2.5 py-1 rounded-none border border-slate-200 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
          <input
            type="text"
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="输入您的项目负载、后备要求或技术选型问题..."
            className="flex-1 bg-slate-50 text-slate-900 border border-slate-300 rounded-none px-3.5 py-2.5 text-xs focus:border-amber-500 outline-none"
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={loading || !inputPrompt.trim()}
            className="px-4 py-2.5 rounded-none bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs disabled:opacity-50 flex items-center gap-1 shadow-sm"
          >
            <span>发送</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
};
