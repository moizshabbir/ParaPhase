import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Copy, Check, Clock, Trash2, X, Sparkles, Globe, Settings, Cpu, ChevronDown, CreditCard, Info, Layers } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Worker from "./worker?worker";

interface HistoryItem {
  id: string;
  originalText: string;
  tone: string;
  language: string;
  variations: string[];
  timestamp: number;
}

interface AppSettings {
  provider: 'default' | 'custom' | 'local';
  customProviderId: string;
  customApiUrl: string;
  customApiKey: string;
  customModel: string;
}

const CUSTOM_PROVIDERS: Record<string, any> = {
  openai: {
    name: 'OpenAI',
    url: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4o-mini',
    keyUrl: 'https://platform.openai.com/api-keys',
    modelsUrl: 'https://platform.openai.com/docs/models',
    helpModel: 'e.g. gpt-4o, gpt-4o-mini'
  },
  openrouter: {
    name: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'anthropic/claude-3-haiku',
    keyUrl: 'https://openrouter.ai/keys',
    modelsUrl: 'https://openrouter.ai/docs/models',
    helpModel: 'e.g. anthropic/claude-3-opus, google/gemini-pro'
  },
  groq: {
    name: 'Groq',
    url: 'https://api.groq.com/openai/v1/chat/completions',
    model: 'llama3-8b-8192',
    keyUrl: 'https://console.groq.com/keys',
    modelsUrl: 'https://console.groq.com/docs/models',
    helpModel: 'e.g. llama3-70b-8192, mixtral-8x7b-32768'
  },
  gemini: {
    name: 'Google Gemini',
    url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    model: 'gemini-2.5-flash',
    keyUrl: 'https://aistudio.google.com/app/apikey',
    modelsUrl: 'https://ai.google.dev/models/gemini',
    helpModel: 'e.g. gemini-2.5-pro, gemini-2.5-flash'
  },
  ollama: {
    name: 'Ollama (Local)',
    url: 'http://localhost:11434/v1/chat/completions',
    model: 'llama3',
    keyUrl: 'https://github.com/ollama/ollama',
    modelsUrl: 'https://ollama.com/library',
    helpModel: 'Run `ollama list` in terminal'
  }
};

const DEFAULT_SETTINGS: AppSettings = {
  provider: 'default',
  customProviderId: 'openai',
  customApiUrl: CUSTOM_PROVIDERS['openai'].url,
  customApiKey: '',
  customModel: CUSTOM_PROVIDERS['openai'].model,
};

const TONES = ["Professional", "Casual", "Academic"];
const LANGUAGES = ["Auto", "English", "Spanish", "French", "German", "Chinese", "Japanese"];

export default function App() {
  const [text, setText] = useState("");
  const [tone, setTone] = useState("Professional");
  const [language, setLanguage] = useState("Auto");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [variations, setVariations] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [creditsLeft, setCreditsLeft] = useState(2);
  const [creditsUsedToday, setCreditsUsedToday] = useState(0);
  
  // Speech recognition
  const recognitionRef = useRef<any>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Load history
    const saved = localStorage.getItem("rephraser-history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse history");
      }
    }

    // Load settings
    const savedSettings = localStorage.getItem("rephraser-settings");
    if (savedSettings) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
      } catch (e) {
        console.error("Failed to parse settings");
      }
    }

    // Load credits
    const today = new Date().toISOString().split('T')[0];
    const savedCredits = localStorage.getItem("rephraser-credits");
    if (savedCredits) {
      try {
        const parsed = JSON.parse(savedCredits);
        if (parsed.date === today) {
          setCreditsUsedToday(parsed.creditsUsed);
          setCreditsLeft(Math.max(0, 2 - parsed.creditsUsed));
        } else {
          localStorage.setItem("rephraser-credits", JSON.stringify({ date: today, creditsUsed: 0 }));
        }
      } catch (e) {
        console.error("Failed to parse credits");
      }
    } else {
      localStorage.setItem("rephraser-credits", JSON.stringify({ date: today, creditsUsed: 0 }));
    }

    // Worker setup
    workerRef.current = new Worker();
    workerRef.current.onmessage = (e) => {
      const data = e.data;
      if (data.status === 'progress') {
        setLoadingMsg(data.message || 'Loading model...');
      } else if (data.status === 'complete') {
        setLoading(false);
        handleResult(data.variations);
      } else if (data.status === 'error') {
        setLoading(false);
        alert('Local model error: ' + data.error);
      }
    };

    // Setup speech recognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event: any) => {
        let currentTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setText((prev) => prev + transcript + " ");
          } else {
            currentTranscript += transcript;
          }
        }
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const saveHistory = (newHistory: HistoryItem[]) => {
    setHistory(newHistory);
    localStorage.setItem("rephraser-history", JSON.stringify(newHistory));
  };

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem("rephraser-settings", JSON.stringify(newSettings));
    setShowSettings(false);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }
    
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      setText("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleResult = (newVariations: string[]) => {
    setVariations(newVariations);
    const newItem: HistoryItem = {
      id: Date.now().toString(),
      originalText: text.trim(),
      tone,
      language,
      variations: newVariations,
      timestamp: Date.now(),
    };
    saveHistory([newItem, ...history].slice(0, 50));
  };

  const handleRephrase = async () => {
    if (!text.trim()) return;

    const cost = text.length > 500 ? 2 : 1;
    if (settings.provider === 'default') {
      if (creditsUsedToday + cost > 2) {
        alert(`Daily limit reached for default model.\nYou need ${cost} credit(s) but have ${creditsLeft} left.\nTry shorter text (costs 1 credit), or switch to Custom/Local models in Settings.`);
        return;
      }
    }
    
    setLoading(true);
    setLoadingMsg("Processing...");
    setVariations([]);
    
    try {
      if (settings.provider === 'local') {
        // Send to worker
        workerRef.current?.postMessage({
          text: text.trim(),
          tone,
          language
        });
        return; // Will be handled in onmessage
      }
      
      if (settings.provider === 'custom') {
        const response = await fetch(settings.customApiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(settings.customApiKey ? { 'Authorization': `Bearer ${settings.customApiKey}` } : {})
          },
          body: JSON.stringify({
            model: settings.customModel,
            messages: [
              {
                role: 'system',
                content: `You are a helpful writing assistant. Rephrase the user's text to have a ${tone} tone${language !== 'Auto' ? ` in ${language}` : ''}. Output ONLY a JSON object containing a "variations" array with exactly 3 different string variations.`
              },
              { role: 'user', content: text.trim() }
            ],
            response_format: { type: "json_object" }
          })
        });

        if (!response.ok) throw new Error("Custom API request failed");
        
        const data = await response.json();
        let parsed = data.choices[0].message.content;
        
        // Clean up markdown code blocks if the model wrapped the JSON
        parsed = parsed.replace(/```json/gi, '').replace(/```/g, '').trim();
        
        try {
          const jsonResult = JSON.parse(parsed);
          handleResult(jsonResult.variations || [parsed]);
        } catch {
          handleResult([parsed]);
        }
        setLoading(false);
        return;
      }

      // Default Provider
      const response = await fetch("/api/rephrase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: text.trim(),
          tone,
          language: language === "Auto" ? undefined : language,
        }),
      });
      
      if (!response.ok) throw new Error("Failed to rephrase");
      const data = await response.json();
      
      if (data.variations && Array.isArray(data.variations)) {
        handleResult(data.variations);
        const today = new Date().toISOString().split('T')[0];
        const newUsed = creditsUsedToday + cost;
        setCreditsUsedToday(newUsed);
        setCreditsLeft(Math.max(0, 2 - newUsed));
        localStorage.setItem("rephraser-credits", JSON.stringify({ date: today, creditsUsed: newUsed }));
      }
    } catch (error) {
      console.error(error);
      alert("Failed to generate variations. Please try again.");
    } finally {
      if (settings.provider !== 'local') {
        setLoading(false);
      }
    }
  };

  const handleCopy = (textToCopy: string, index: number) => {
    navigator.clipboard.writeText(textToCopy);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const loadFromHistory = (item: HistoryItem) => {
    setText(item.originalText);
    setTone(item.tone);
    setLanguage(item.language);
    setVariations(item.variations);
    if (window.innerWidth < 1024) {
      setShowHistory(false);
    }
  };

  const clearHistory = () => {
    if (confirm("Are you sure you want to clear your history?")) {
      saveHistory([]);
    }
  };

  return (
    <div className="flex h-screen flex-col bg-parabase-light dark:bg-parabase text-paratext-light dark:text-paratext font-sans overflow-hidden">
      {/* Header */}
      <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/5 bg-parabase-light dark:bg-parabase z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-paraprimary-light dark:bg-paraprimary rounded-lg flex items-center justify-center">
            <Layers className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">ParaPhase</h1>
        </div>
        
        <div className="flex items-center gap-3">
          {settings.provider === 'default' && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-paraprimary-light/10 dark:bg-paraprimary/10 rounded-md text-xs border border-paraprimary-light/20 dark:border-paraprimary/20 text-paraprimary-light dark:text-paraprimary">
              <CreditCard className="w-3.5 h-3.5" />
              <span className="font-medium">{creditsLeft} Credits</span>
            </div>
          )}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-black/5 dark:bg-white/5 rounded-md text-xs border border-slate-300 dark:border-white/10 text-paramuted">
            <span className={`w-2 h-2 rounded-full ${settings.provider === 'local' ? 'bg-amber-500' : settings.provider === 'custom' ? 'bg-emerald-500' : 'bg-paraprimary-light dark:bg-paraprimary'}`}></span>
            <span className="capitalize">{settings.provider} Model</span>
          </div>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-black/10 dark:bg-white/10 rounded-lg transition-colors text-paramuted hover:text-paratext-light dark:text-paratext"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className="p-2 hover:bg-black/10 dark:bg-white/10 rounded-lg transition-colors text-paramuted hover:text-paratext-light dark:text-paratext lg:hidden"
            title="History"
          >
            <Clock className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Sidebar History */}
        <div className={`fixed inset-y-0 left-0 transform ${showHistory ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:block w-72 bg-parasurface-light dark:bg-parasurface border-r border-slate-200 dark:border-white/5 shadow-2xl z-40 transition-transform duration-300 flex flex-col`}>
          <div className="p-5 flex items-center justify-between lg:justify-start">
            <h2 className="text-xs font-bold text-paramuted uppercase tracking-widest">Recent History</h2>
            <button onClick={() => setShowHistory(false)} className="p-1 text-paramuted hover:text-paratext-light dark:text-paratext lg:hidden">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-3">
            <div className="space-y-2 pb-4">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-paramuted gap-3">
                  <Clock className="w-6 h-6 opacity-30" />
                  <p className="text-xs">No history yet</p>
                </div>
              ) : (
                history.map((item, index) => {
                  const isFirst = index === 0;
                  return (
                    <div
                      key={item.id}
                      onClick={() => loadFromHistory(item)}
                      className={`p-3 rounded-lg cursor-pointer ${
                        isFirst 
                        ? "bg-paraprimary-light/10 dark:bg-paraprimary/10 border border-paraprimary-light/20 dark:border-paraprimary/20" 
                        : "bg-black/5 dark:bg-white/5 border border-transparent hover:border-slate-300 dark:border-white/10"
                      }`}
                    >
                      <p className={`text-xs line-clamp-1 ${isFirst ? "text-paraprimary-light dark:text-paraprimary" : "text-paratext-light dark:text-paratext"}`}>
                        {item.originalText}
                      </p>
                      <span className="text-[10px] text-paramuted mt-1.5 block">
                        {item.tone} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {history.length > 0 && (
            <div className="p-3 border-t border-slate-200 dark:border-white/5 bg-parasurface-light dark:bg-parasurface">
              <button onClick={clearHistory} className="w-full py-2 flex items-center justify-center gap-2 text-xs text-paramuted hover:text-paratext-light dark:text-paratext bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:bg-white/10 rounded-lg transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
                Clear History
              </button>
            </div>
          )}
        </div>

        {/* Main Interface Content */}
        <div className="flex-1 flex flex-col min-w-0 bg-parabase-light dark:bg-parabase relative">
          
          {/* Results Area */}
          <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center">
            <div className="w-full max-w-3xl flex-1 flex flex-col justify-end pb-4">
              <AnimatePresence mode="popLayout">
                {variations.length > 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="space-y-4 w-full"
                  >
                    <div className="flex gap-4 items-center mb-4">
                      <h3 className="text-xs font-semibold text-paramuted uppercase tracking-widest">Generated Suggestions</h3>
                      <div className="h-[1px] flex-1 bg-black/5 dark:bg-white/5"></div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4 w-full">
                      {variations.map((v, i) => {
                        const borderColors = ["border-paraprimary-light dark:border-paraprimary", "border-amber-500", "border-emerald-500"];
                        const textColors = ["text-paraprimary-light dark:text-paraprimary", "text-amber-400", "text-emerald-400"];
                        const hoverBgColors = ["hover:bg-paraprimary-light dark:bg-paraprimary", "hover:bg-amber-500", "hover:bg-emerald-500"];
                        const currentBorder = borderColors[i % borderColors.length];
                        const currentText = textColors[i % textColors.length];
                        const currentHoverBg = hoverBgColors[i % hoverBgColors.length];

                        return (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.1 }}
                            key={i} 
                            className={`p-5 bg-parasurface-light dark:bg-parasurface border-l-[3px] ${currentBorder} rounded-r-xl rounded-l-md relative group`}
                          >
                            <div className="flex justify-between items-start mb-2">
                              <span className={`text-[10px] uppercase tracking-widest font-bold ${currentText}`}>
                                Variation {i + 1}
                              </span>
                              <button
                                onClick={() => handleCopy(v, i)}
                                className={`opacity-0 group-hover:opacity-100 p-1.5 bg-black/5 dark:bg-white/5 rounded-md ${currentHoverBg} transition-all text-paratext-light dark:text-paratext`}
                                title="Copy to clipboard"
                              >
                                {copiedIndex === i ? (
                                  <Check className="w-3.5 h-3.5" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                            <p className="font-mono text-paratext-light dark:text-paratext text-sm leading-relaxed whitespace-pre-wrap">{v}</p>
                          </motion.div>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center opacity-40 py-20">
                    <Sparkles className="w-12 h-12 mb-4" />
                    <h3 className="text-lg font-medium text-paratext-light dark:text-paratext mb-2">Ready to rephrase</h3>
                    <p className="text-sm">Type your message below and choose a tone.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Input Area Fixed Bottom */}
          <div className="flex-none p-4 md:p-6 border-t border-slate-200 dark:border-white/5 bg-parasurface-light dark:bg-parasurface flex justify-center">
            <div className="w-full max-w-3xl flex flex-col gap-4">
              
              {/* Controls */}
              <div className="flex flex-wrap gap-3 items-center">
                <div className="flex gap-1.5 bg-black/5 dark:bg-white/5 p-1 rounded-xl border border-slate-300 dark:border-white/10 overflow-x-auto scrollbar-hide">
                  {TONES.map(t => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                        tone === t 
                        ? "bg-paraprimary-light dark:bg-paraprimary text-white" 
                        : "text-paramuted hover:text-paratext-light dark:text-paratext hover:bg-black/5 dark:bg-white/5"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                
                <div className="h-6 w-px bg-black/10 dark:bg-white/10 hidden sm:block"></div>
                
                <div className="flex items-center gap-2 bg-black/5 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl px-3 py-1.5">
                  <Globe className="w-3.5 h-3.5 text-paramuted" />
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="bg-transparent text-xs font-medium focus:outline-none cursor-pointer appearance-none text-paratext-light dark:text-paratext"
                  >
                    {LANGUAGES.map(l => (
                      <option key={l} value={l} className="bg-parasurface-light dark:bg-parasurface text-paratext-light dark:text-paratext">{l}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Textarea */}
              <div className="relative group">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      handleRephrase();
                    }
                  }}
                  placeholder="Type or paste your message here... (Ctrl+Enter to Refine)"
                  className="font-mono w-full h-28 bg-parasurface-light dark:bg-parasurface border border-slate-300 dark:border-white/10 rounded-xl p-4 pr-14 text-sm text-paratext-light dark:text-paratext placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-paraprimary-light/40 dark:focus:ring-paraprimary/40 transition-all resize-none shadow-inner"
                />
                
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  <button
                    onClick={toggleListening}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-95 ${
                      isListening 
                      ? "bg-red-500 text-paratext-light dark:text-paratext animate-pulse shadow-lg shadow-red-500/20" 
                      : "bg-black/10 dark:bg-white/10 hover:bg-white/20 text-paratext-light dark:text-paratext"
                    }`}
                    title={isListening ? "Stop listening" : "Start listening"}
                  >
                    {isListening ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </button>
                  
                  <button
                    onClick={handleRephrase}
                    disabled={!text.trim() || loading}
                    className="px-5 py-2 bg-paraprimary-light dark:bg-paraprimary text-white text-sm font-semibold rounded-full hover:opacity-90 transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 active:scale-95"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    <span>Refine</span>
                  </button>
                </div>

                {loading && loadingMsg && (
                  <div className="absolute -top-7 right-0 text-[10px] text-paramuted bg-parasurface-light dark:bg-parasurface px-2 py-1 rounded border border-slate-300 dark:border-white/10 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-paraprimary-light dark:bg-paraprimary animate-pulse"></div>
                    {loadingMsg}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-parasurface-light dark:bg-parasurface border border-slate-300 dark:border-white/10 rounded-2xl w-full max-w-md m-4 relative z-10 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-5 border-b border-slate-200 dark:border-white/5 flex items-center justify-between bg-parasurface-light dark:bg-parasurface">
                <h2 className="font-semibold text-lg flex items-center gap-2">
                  <Settings className="w-5 h-5 text-paraprimary-light dark:text-paraprimary" />
                  Model Settings
                </h2>
                <button onClick={() => setShowSettings(false)} className="text-paramuted hover:text-paratext-light dark:text-paratext">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-5 space-y-6 overflow-y-auto">
                <div className="space-y-3">
                  <label className="text-sm font-medium text-paratext-light dark:text-paratext block">AI Provider</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button 
                      onClick={() => setSettings({...settings, provider: 'default'})}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${settings.provider === 'default' ? 'border-paraprimary-light dark:border-paraprimary bg-paraprimary-light/10 dark:bg-paraprimary/10 text-paratext-light dark:text-paratext' : 'border-slate-200 dark:border-white/5 bg-black/5 dark:bg-white/5 text-paramuted hover:bg-black/10 dark:bg-white/10'}`}
                    >
                      <Sparkles className="w-5 h-5" />
                      <span className="text-xs font-semibold">Default</span>
                    </button>
                    <button 
                      onClick={() => setSettings({...settings, provider: 'custom'})}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${settings.provider === 'custom' ? 'border-paraprimary-light dark:border-paraprimary bg-paraprimary-light/10 dark:bg-paraprimary/10 text-paratext-light dark:text-paratext' : 'border-slate-200 dark:border-white/5 bg-black/5 dark:bg-white/5 text-paramuted hover:bg-black/10 dark:bg-white/10'}`}
                    >
                      <Globe className="w-5 h-5" />
                      <span className="text-xs font-semibold">Custom API</span>
                    </button>
                    <button 
                      onClick={() => setSettings({...settings, provider: 'local'})}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${settings.provider === 'local' ? 'border-paraprimary-light dark:border-paraprimary bg-paraprimary-light/10 dark:bg-paraprimary/10 text-paratext-light dark:text-paratext' : 'border-slate-200 dark:border-white/5 bg-black/5 dark:bg-white/5 text-paramuted hover:bg-black/10 dark:bg-white/10'}`}
                    >
                      <Cpu className="w-5 h-5" />
                      <span className="text-xs font-semibold">Local CPU</span>
                    </button>
                  </div>
                </div>

                {settings.provider === 'local' && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm text-amber-200">
                    <p className="font-semibold mb-1">Local CPU Model Selected</p>
                    <p className="text-amber-200/80 text-xs">A ~300MB model will be downloaded to your browser cache on first run. Everything runs locally.</p>
                  </div>
                )}

                {settings.provider === 'custom' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-4">
                    <div>
                      <label className="text-xs font-medium text-paramuted block mb-1">Provider</label>
                      <div className="relative">
                        <select 
                          value={settings.customProviderId}
                          onChange={e => {
                            const newId = e.target.value;
                            const prov = CUSTOM_PROVIDERS[newId];
                            setSettings({
                              ...settings, 
                              customProviderId: newId,
                              customApiUrl: prov.url,
                              customModel: prov.model
                            });
                          }}
                          className="w-full bg-slate-100 dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-paratext-light dark:text-paratext focus:border-paraprimary-light dark:focus:border-paraprimary focus:outline-none appearance-none cursor-pointer"
                        >
                          {Object.keys(CUSTOM_PROVIDERS).map(k => (
                            <option key={k} value={k} className="bg-parasurface-light dark:bg-parasurface">{CUSTOM_PROVIDERS[k].name}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-paramuted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-paramuted block mb-1 flex items-center justify-between">
                        <span>API Base URL</span>
                      </label>
                      <input 
                        type="text"
                        value={settings.customApiUrl}
                        onChange={e => setSettings({...settings, customApiUrl: e.target.value})}
                        className="w-full bg-slate-100 dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-paratext-light dark:text-paratext focus:border-paraprimary-light dark:focus:border-paraprimary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-paramuted block mb-1">API Key (Stored locally)</label>
                      <input 
                        type="password"
                        value={settings.customApiKey}
                        onChange={e => setSettings({...settings, customApiKey: e.target.value})}
                        className="w-full bg-slate-100 dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-paratext-light dark:text-paratext focus:border-paraprimary-light dark:focus:border-paraprimary focus:outline-none"
                        placeholder="sk-..."
                      />
                      <p className="text-[10px] text-paramuted mt-1 flex items-center gap-1">
                        <Info className="w-3 h-3" /> 
                        {CUSTOM_PROVIDERS[settings.customProviderId].name === 'Ollama (Local)' ? (
                          'No API key needed for local Ollama'
                        ) : (
                          <>Get API key at <a href={CUSTOM_PROVIDERS[settings.customProviderId].keyUrl} target="_blank" rel="noopener noreferrer" className="text-paraprimary-light dark:text-paraprimary hover:underline">{CUSTOM_PROVIDERS[settings.customProviderId].keyUrl.replace('https://', '')}</a></>
                        )}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-paramuted block mb-1">Model Name</label>
                      <input 
                        type="text"
                        value={settings.customModel}
                        onChange={e => setSettings({...settings, customModel: e.target.value})}
                        className="w-full bg-slate-100 dark:bg-black/50 border border-slate-300 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-paratext-light dark:text-paratext focus:border-paraprimary-light dark:focus:border-paraprimary focus:outline-none"
                      />
                      <p className="text-[10px] text-paramuted mt-1 flex items-center gap-1 flex-wrap">
                        <Info className="w-3 h-3 flex-shrink-0" /> 
                        <span>{CUSTOM_PROVIDERS[settings.customProviderId].helpModel}</span>
                        <span className="opacity-30 mx-1">|</span>
                        <a href={CUSTOM_PROVIDERS[settings.customProviderId].modelsUrl} target="_blank" rel="noopener noreferrer" className="text-paraprimary-light dark:text-paraprimary hover:underline">View models</a>
                      </p>
                    </div>
                  </motion.div>
                )}
              </div>
              
              <div className="p-5 border-t border-slate-200 dark:border-white/5 bg-parasurface-light dark:bg-parasurface flex justify-end gap-3">
                <button 
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-paratext-light dark:text-paratext hover:text-paratext-light dark:text-paratext hover:bg-black/5 dark:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => saveSettings(settings)}
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-paraprimary-light dark:bg-paraprimary text-white hover:opacity-90 transition-all"
                >
                  Save Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
