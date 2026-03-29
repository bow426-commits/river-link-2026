"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { 
  ImageIcon, Link as LinkIcon, ChevronLeft, Save, RefreshCw, 
  Smartphone, Type, FileText, Info, Eye, X, MessageCircle,
  Sparkles, Layers, ArrowRightLeft, Send, RotateCcw,
  Palette, Crosshair, Rocket, Zap, Sliders, Check, Monitor, Layout
} from "lucide-react";
import Link from "next/link";

// ==========================================
// 💡 預設主題庫
// ==========================================
const THEME_PRESETS = {
  "SaaS Pro": { primary: "#3b82f6", bgMain: "#050505", bgHeader: "#0a0a0a", bgPanel: "#0a0a0a", bgInput: "#151515", borderColor: "#ffffff", borderOpacity: 0.1, radius: 12, fontSize: 12, textMain: "#ffffff", textDim: "#9ca3af" },
  "Cyberpunk": { primary: "#f43f5e", bgMain: "#0f0f13", bgHeader: "#1a1a24", bgPanel: "#1a1a24", bgInput: "#2a2a35", borderColor: "#f43f5e", borderOpacity: 0.2, radius: 6, fontSize: 12, textMain: "#ffffff", textDim: "#fda4af" },
  "Midnight": { primary: "#38bdf8", bgMain: "#020617", bgHeader: "#0f172a", bgPanel: "#0f172a", bgInput: "#1e293b", borderColor: "#38bdf8", borderOpacity: 0.15, radius: 16, fontSize: 12, textMain: "#f8fafc", textDim: "#94a3b8" },
  "Minimalist": { primary: "#000000", bgMain: "#ffffff", bgHeader: "#f8fafc", bgPanel: "#ffffff", bgInput: "#f1f5f9", borderColor: "#000000", borderOpacity: 0.1, radius: 24, fontSize: 13, textMain: "#0f172a", textDim: "#64748b" }
};

interface MenuPage {
  id: string;
  name: string;
  imageUrl: string | null;
  areas: any[];
  chatBarText: string;
}

export default function RiverMegaEditorV16() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  
  // 核心狀態
  const [pages, setPages] = useState<MenuPage[]>([{ id: 'p1', name: '主選單', imageUrl: null, areas: [], chatBarText: '✨ 點擊展開 ✨' }]);
  const [activePageIndex, setActivePageIndex] = useState(0); 
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [history, setHistory] = useState<MenuPage[][]>([]); 
  
  // UI 狀態
  const [theme, setTheme] = useState(THEME_PRESETS["SaaS Pro"]);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'action' | 'layout'>('action');

  // 畫布操作狀態
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<'idle' | 'drawing' | 'dragging' | 'resizing'>('idle');
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [interactionStart, setInteractionStart] = useState<any>(null);

  // 系統狀態
  const [saving, setSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [previewHistory, setPreviewHistory] = useState<number[]>([]);
  const [imageSizeInfo, setImageSizeInfo] = useState({ w: 0, h: 0, mb: "0.00" });

  // AI 狀態
  const [showAI, setShowAI] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<{role: string, text: string}[]>([
    { role: 'ai', text: '艦長！V16 終極佈局版已載入。\n\n懸浮視窗已鎖定完美比例，確保全功能無損呈現。' }
  ]);

  const containerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const activePage = pages[activePageIndex];

  // 初始化與資料載入
  useEffect(() => {
    const init = async () => {
      if (!uid) return;
      try {
        const userSnap = await getDocs(collection(db, "users"));
        setAllUsers(userSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        const docSnap = await getDoc(doc(db, "users", uid));
        if (docSnap.exists() && docSnap.data().megaMenuConfig) {
          const config = docSnap.data().megaMenuConfig;
          if (config.pages) setPages(config.pages);
          if (config.theme) setTheme({ ...THEME_PRESETS["SaaS Pro"], ...config.theme });
          if (config.pages?.[0]?.imageUrl) {
            const img = new Image();
            img.onload = () => setImageSizeInfo({ w: img.width, h: img.height, mb: "已儲存" });
            img.src = config.pages[0].imageUrl;
          }
        }
      } catch (e) { console.error(e); }
    };
    init();
  }, [uid]);

  // 全局鍵盤與滑鼠監聽
  useEffect(() => { if (showAI) chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [aiMessages, showAI, isAiLoading]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      if (e.key === 'Escape') {
        setShowThemeModal(false);
        setShowPreview(false);
      }
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedId && !showThemeModal && !showPreview) deleteArea(selectedId);
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !showThemeModal && !showPreview) { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, showThemeModal, showPreview, history, pages]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (mode !== 'idle') { setMode('idle'); setActiveHandle(null); setInteractionStart(null); }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [mode]);

  // 核心資料操作
  const saveHistory = useCallback(() => setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(pages))]), [pages]);
  const undo = () => { if (history.length === 0) return; setPages(history[history.length - 1]); setHistory(prev => prev.slice(0, -1)); setSelectedId(null); };
  const updateActivePage = (data: Partial<MenuPage>) => { const newPages = [...pages]; newPages[activePageIndex] = { ...newPages[activePageIndex], ...data }; setPages(newPages); };
  const updateArea = (id: number, field: string, value: any) => { saveHistory(); updateActivePage({ areas: activePage.areas.map(a => a.id === id ? { ...a, [field]: value } : a) }); };
  const deleteArea = (id: number) => { saveHistory(); updateActivePage({ areas: activePage.areas.filter(a => a.id !== id) }); setSelectedId(null); };

  const deletePage = (e: React.MouseEvent, indexToDelete: number) => {
    e.stopPropagation();
    if (pages.length <= 1) { alert("⚠️ 必須至少保留一個分頁！"); return; }
    if (!confirm(`確定要刪除「${pages[indexToDelete].name}」嗎？`)) return;
    saveHistory();
    const newPages = pages.filter((_, i) => i !== indexToDelete);
    setPages(newPages);
    if (activePageIndex === indexToDelete) setActivePageIndex(Math.max(0, indexToDelete - 1));
    else if (activePageIndex > indexToDelete) setActivePageIndex(activePageIndex - 1);
    setSelectedId(null);
  };

  // 模擬器邏輯
  const handleSimulatorJump = (targetIndex: number) => {
    setPreviewHistory(prev => [...prev, previewPageIndex]);
    setPreviewPageIndex(targetIndex);
  };

  const handleSimulatorBack = () => {
    if (previewHistory.length > 0) {
      const newHistory = [...previewHistory];
      const lastPage = newHistory.pop();
      if (lastPage !== undefined) {
        setPreviewPageIndex(lastPage);
        setPreviewHistory(newHistory);
      }
    } else {
      setShowPreview(false);
    }
  };

  // 畫布操作
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!activePage.imageUrl || !containerRef.current) return;
    const target = e.target as HTMLElement;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    if (target.dataset.handle) {
      e.stopPropagation(); saveHistory(); setMode('resizing'); setActiveHandle(target.dataset.handle);
      setInteractionStart({ startX: x, startY: y, initialArea: { ...activePage.areas.find(a => a.id === selectedId) } }); return;
    }
    if (target.closest('.hot-area')) {
      e.stopPropagation(); setSelectedId(Number((target.closest('.hot-area') as HTMLElement).dataset.id));
      saveHistory(); setMode('dragging');
      setInteractionStart({ startX: x, startY: y, initialArea: { ...activePage.areas.find(a => a.id === Number((target.closest('.hot-area') as HTMLElement).dataset.id)) } }); return;
    }
    saveHistory(); setMode('drawing'); const newId = Date.now();
    updateActivePage({ areas: [...activePage.areas, { id: newId, x, y, w: 0.1, h: 0.1, type: 'switch', value: '' }] });
    setSelectedId(newId); setInteractionStart({ startX: x, startY: y, initialArea: null });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mode === 'idle' || !selectedId || !containerRef.current || !interactionStart) return;
    const rect = containerRef.current.getBoundingClientRect();
    const curX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const curY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    const deltaX = curX - interactionStart.startX;
    const deltaY = curY - interactionStart.startY;
    const { initialArea, startX, startY } = interactionStart;

    const updatedAreas = [...activePage.areas];
    const idx = updatedAreas.findIndex(a => a.id === selectedId);
    if (idx === -1) return;
    const n = { ...updatedAreas[idx] };

    if (mode === 'drawing') {
      n.w = Math.abs(curX - startX); n.h = Math.abs(curY - startY);
      n.x = curX < startX ? curX : startX; n.y = curY < startY ? curY : startY;
    } else if (mode === 'dragging') {
      n.x = Math.max(0, Math.min(100 - n.w, initialArea.x + deltaX));
      n.y = Math.max(0, Math.min(100 - n.h, initialArea.y + deltaY));
    } else if (mode === 'resizing' && activeHandle) {
      if (activeHandle.includes('e')) n.w = Math.max(1, Math.min(100 - initialArea.x, initialArea.w + deltaX));
      if (activeHandle.includes('s')) n.h = Math.max(1, Math.min(100 - initialArea.y, initialArea.h + deltaY));
      if (activeHandle.includes('w')) { const w = initialArea.w - deltaX; if (w > 1) { n.x = Math.max(0, initialArea.x + deltaX); n.w = w; } }
      if (activeHandle.includes('n')) { const h = initialArea.h - deltaY; if (h > 1) { n.y = Math.max(0, initialArea.y + deltaY); n.h = h; } }
    }
    updatedAreas[idx] = n; updateActivePage({ areas: updatedAreas });
  };

  const handleImageUpload = (e: any) => {
    const file = e.target.files[0]; if (!file) return;
    saveHistory(); const reader = new FileReader();
    reader.onload = (event: any) => {
      const img = new Image(); img.onload = () => {
        const canvas = document.createElement("canvas"); canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) { 
          ctx.drawImage(img, 0, 0, img.width, img.height); 
          updateActivePage({ imageUrl: canvas.toDataURL("image/jpeg", 0.7) }); 
          setImageSizeInfo({ w: img.width, h: img.height, mb: (file.size / 1024 / 1024).toFixed(2) }); 
        }
      }; img.src = event.target.result;
    }; reader.readAsDataURL(file);
  };

  const handleExport = async () => { setIsExporting(true); await new Promise(r => setTimeout(r, 1200)); setIsExporting(false); alert("🚀 專案已打包並發布至線上！"); };
  const hexToRgba = (hex: string, alpha: number) => `rgba(${parseInt(hex.slice(1,3),16)||0}, ${parseInt(hex.slice(3,5),16)||0}, ${parseInt(hex.slice(5,7),16)||0}, ${alpha})`;

  const askGemini = async () => {
    if (!aiInput.trim()) return;
    setAiMessages(prev => [...prev, { role: 'user', text: aiInput }]); setAiInput(""); setIsAiLoading(true);
    try {
      const res = await fetch("/api/gemini", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: aiInput, pagesInfo: pages.map(p => ({ name: p.name })) }) });
      const data = await res.json(); setAiMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
    } catch (err) { setAiMessages(prev => [...prev, { role: 'ai', text: "連線異常。" }]); } finally { setIsAiLoading(false); }
  };
  const formatMarkdown = (text: string) => text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\*\*(.*?)\*\*/g, `<strong style="color:${theme.primary}">$1</strong>`).replace(/\n/g, '<br/>');

  const currentBorder = hexToRgba(theme.borderColor, theme.borderOpacity);
  const activeArea = activePage.areas.find(a => a.id === selectedId);

  return (
    <main className="h-screen flex flex-col overflow-hidden font-sans select-none transition-colors duration-300 relative" style={{ backgroundColor: theme.bgMain, color: theme.textMain, fontSize: `${theme.fontSize}px` }}>
      
      {/* 🚀 Header */}
      <header className="h-[76px] border-b flex justify-between items-center px-8 shrink-0 relative z-40 shadow-sm transition-colors duration-300" style={{ backgroundColor: theme.bgHeader, borderColor: currentBorder }}>
        <div className="flex items-center gap-6">
          <Link href="/admin" className="p-2.5 rounded-full hover:bg-white/5 transition-all border" style={{ borderColor: currentBorder, color: theme.textDim }}><ChevronLeft size={20}/></Link>
          <div className="flex flex-col">
            <input value={activePage.name} onChange={(e) => updateActivePage({name: e.target.value})} className="bg-transparent border-none outline-none font-black rounded transition-all focus:bg-white/5" style={{ color: theme.textMain, fontSize: `${theme.fontSize * 1.5}px` }} />
            <div className="flex items-center gap-2 mt-1 px-1">
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: theme.primary, boxShadow: `0 0 8px ${theme.primary}` }}></span>
              <span className="uppercase tracking-[0.2em] font-mono font-bold" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.75}px` }}>V16 Full Production</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button type="button" onClick={undo} disabled={history.length === 0} className="px-5 py-2.5 rounded-xl transition-all border font-bold disabled:opacity-20 hover:opacity-80 flex items-center gap-2 cursor-pointer" style={{ backgroundColor: theme.bgInput, borderColor: currentBorder, color: theme.textDim, borderRadius: `${theme.radius}px`, fontSize: `${theme.fontSize}px` }}>
            <RotateCcw size={16}/> 撤銷
          </button>
          
          <button 
            type="button" 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPreviewPageIndex(0); setPreviewHistory([]); setShowPreview(true); }} 
            className="px-6 py-2.5 rounded-xl font-bold border transition-all hover:opacity-80 flex items-center gap-2 cursor-pointer relative z-50 pointer-events-auto" 
            style={{ backgroundColor: theme.bgInput, borderColor: theme.primary, color: theme.primary, borderRadius: `${theme.radius}px`, fontSize: `${theme.fontSize}px` }}
          >
            <Eye size={16}/> 模擬器
          </button>
          
          <button type="button" onClick={async () => { setSaving(true); await updateDoc(doc(db, "users", uid!), { megaMenuConfig: { pages, theme } }); setSaving(false); alert("✅ 專案與主題已儲存！"); }} className="px-8 py-2.5 rounded-xl font-black text-white shadow-lg active:scale-95 transition-all flex items-center gap-2 cursor-pointer" style={{ backgroundColor: theme.primary, borderRadius: `${theme.radius}px`, fontSize: `${theme.fontSize}px` }}>
            {saving ? <RefreshCw className="animate-spin" size={16}/> : <Save size={16}/>} 儲存
          </button>
        </div>
      </header>

      {/* 🧩 工作區 */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* 左側面板 */}
        <aside className="border-r flex flex-col shrink-0 relative z-30 shadow-xl transition-colors duration-300" style={{ width: "320px", backgroundColor: theme.bgPanel, borderColor: currentBorder }}>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            
            <button 
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowThemeModal(true); }}
              className="w-full p-4 flex items-center justify-center gap-2 border transition-all hover:brightness-125 shadow-sm font-black cursor-pointer relative z-50 pointer-events-auto"
              style={{ backgroundColor: `${theme.primary}15`, borderColor: `${theme.primary}50`, color: theme.primary, borderRadius: `${theme.radius}px`, fontSize: `${theme.fontSize}px` }}
            >
              <Palette size={16} /> 視覺主題設定 (Theme)
            </button>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-black uppercase tracking-widest flex items-center gap-2" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.8}px` }}><Layers size={14} style={{ color: theme.primary }}/> 分頁管理</h3>
                {pages.length < 6 && <button onClick={() => { saveHistory(); setPages([...pages, { id: `p${Date.now()}`, name: `新分頁`, imageUrl: null, areas: [], chatBarText: '✨' }]); setActivePageIndex(pages.length); }} className="p-1 hover:bg-white/10 rounded cursor-pointer" style={{ color: theme.textDim }}><span className="text-lg leading-none">+</span></button>}
              </div>
              <div className="space-y-2">
                {pages.map((page, index) => (
                  <div key={page.id} onClick={() => { setActivePageIndex(index); setSelectedId(null); }} className="group flex items-center justify-between p-3 transition-all border cursor-pointer" style={{ backgroundColor: activePageIndex === index ? theme.textMain : theme.bgInput, color: activePageIndex === index ? theme.bgMain : theme.textDim, borderColor: activePageIndex === index ? theme.textMain : currentBorder, borderRadius: `${theme.radius > 8 ? 8 : theme.radius}px`, fontSize: `${theme.fontSize * 0.9}px` }}>
                    <span className="font-bold whitespace-nowrap overflow-hidden text-ellipsis">{page.name}</span>
                    {pages.length > 1 && <button onClick={(e) => deletePage(e, index)} className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-opacity"><X size={14}/></button>}
                  </div>
                ))}
              </div>
            </div>

            <section className="p-5 border transition-all" style={{ backgroundColor: theme.bgInput, borderRadius: `${theme.radius}px`, borderColor: currentBorder }}>
              <h3 className="font-black uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.8}px` }}><Type size={14} style={{ color: theme.primary }}/> 底部標籤 (Chat Bar)</h3>
              <input value={activePage.chatBarText} onChange={(e) => updateActivePage({chatBarText: e.target.value})} className="w-full bg-black/10 border p-3 outline-none transition-all shadow-inner focus:ring-1" style={{ color: theme.textMain, borderColor: currentBorder, ringColor: theme.primary, borderRadius: `${theme.radius > 8 ? 8 : theme.radius}px`, fontSize: `${theme.fontSize * 0.9}px` }} placeholder="例如：點擊領取優惠" />
            </section>
          </div>
          <div className="p-6 border-t shrink-0" style={{ borderColor: currentBorder, backgroundColor: theme.bgHeader }}>
            <button onClick={handleExport} className="w-full py-4 flex items-center justify-center gap-2 font-black uppercase tracking-widest transition-all shadow-xl hover:brightness-110 active:scale-95 cursor-pointer" style={{ backgroundColor: theme.primary, color: "#fff", borderRadius: `${theme.radius}px`, fontSize: `${theme.fontSize}px` }}>
              {isExporting ? <RefreshCw className="animate-spin" size={16}/> : <Rocket size={16}/>} 發布至線上
            </button>
          </div>
        </aside>

        {/* 🎨 中央畫布 */}
        <section className="flex-1 flex flex-col relative overflow-hidden transition-colors duration-300 z-10" style={{ backgroundColor: theme.bgMain }}>
          <div className="flex-1 overflow-auto flex flex-col items-center justify-center p-12 bg-[radial-gradient(#ffffff10_1px,transparent_1px)] [background-size:24px_24px]">
            {!activePage.imageUrl ? (
              <label className="flex flex-col items-center justify-center gap-6 cursor-pointer w-full max-w-[600px] aspect-[4/3] border-2 border-dashed hover:border-white/30 transition-all bg-black/20 shadow-2xl backdrop-blur-sm" style={{ borderColor: currentBorder, borderRadius: `${theme.radius * 2}px` }}>
                <ImageIcon style={{ color: theme.textDim }} size={48} className="opacity-50"/>
                <p className="font-bold tracking-widest" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 1.2}px` }}>點擊上傳選單圖片</p>
                <input type="file" className="hidden" onChange={handleImageUpload} />
              </label>
            ) : (
              <div 
                ref={containerRef} 
                className="relative shadow-[0_30px_80px_rgba(0,0,0,0.6)] inline-block cursor-crosshair ring-1" 
                style={{ ringColor: currentBorder, borderRadius: `${theme.radius > 16 ? 16 : theme.radius}px`, backgroundColor: theme.bgInput }}
                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
              >
                <img src={activePage.imageUrl} draggable={false} className="max-h-[75vh] max-w-[60vw] object-contain pointer-events-none opacity-95" style={{ borderRadius: `${theme.radius > 16 ? 16 : theme.radius}px` }} />
                
                {activePage.areas.map(area => (
                  <div 
                    key={area.id} data-id={area.id}
                    className={`hot-area absolute border-2 flex items-center justify-center ${selectedId === area.id ? 'cursor-move z-30' : 'cursor-pointer transition-colors z-20'}`} 
                    style={{ left:`${area.x}%`, top:`${area.y}%`, width:`${area.w}%`, height:`${area.h}%`, borderColor: selectedId === area.id ? theme.primary : "rgba(255,255,255,0.4)", backgroundColor: selectedId === area.id ? `${theme.primary}30` : "rgba(0,0,0,0.1)", borderRadius: `${theme.radius > 8 ? 8 : theme.radius}px` }}
                  >
                    {selectedId === area.id && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); deleteArea(area.id); }} className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 z-50 cursor-pointer"><X size={12}/></button>
                        {['nw', 'ne', 'sw', 'se'].map((pos) => (
                          <div key={pos} data-handle={pos} className="absolute w-3 h-3 bg-white border-2 shadow-sm rounded-full z-40" style={{ borderColor: theme.primary, top: pos.includes('n') ? -6 : 'auto', bottom: pos.includes('s') ? -6 : 'auto', left: pos.includes('w') ? -6 : 'auto', right: pos.includes('e') ? -6 : 'auto', cursor: `${pos}-resize` }} />
                        ))}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 🔍 右側面板 */}
        <aside className="border-l flex flex-col overflow-hidden shrink-0 relative z-30 shadow-[-4px_0_24px_rgba(0,0,0,0.2)] transition-colors duration-300" style={{ width: "340px", backgroundColor: theme.bgPanel, borderColor: currentBorder }}>
          <div className="p-6 border-b shrink-0 flex items-center gap-2" style={{ borderColor: currentBorder }}>
            <Zap size={16} style={{ color: theme.primary }}/>
            <h3 className="font-black uppercase tracking-widest" style={{ color: theme.textMain, fontSize: `${theme.fontSize}px` }}>屬性檢視器</h3>
          </div>

          {activeArea ? (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex border-b shrink-0" style={{ borderColor: currentBorder, backgroundColor: theme.bgHeader }}>
                <button onClick={() => setInspectorTab('action')} className="flex-1 py-3 font-bold relative cursor-pointer" style={{ color: inspectorTab === 'action' ? theme.primary : theme.textDim, fontSize: `${theme.fontSize * 0.9}px` }}>
                  ⚡ 觸發動作
                  {inspectorTab === 'action' && <div className="absolute bottom-0 left-0 w-full h-[2px]" style={{ backgroundColor: theme.primary }}></div>}
                </button>
                <button onClick={() => setInspectorTab('layout')} className="flex-1 py-3 font-bold relative border-l cursor-pointer" style={{ color: inspectorTab === 'layout' ? theme.primary : theme.textDim, borderColor: currentBorder, fontSize: `${theme.fontSize * 0.9}px` }}>
                  📐 座標佈局
                  {inspectorTab === 'layout' && <div className="absolute bottom-0 left-0 w-full h-[2px]" style={{ backgroundColor: theme.primary }}></div>}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-black/5">
                {inspectorTab === 'action' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="space-y-3">
                      <label className="font-black uppercase tracking-widest" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.8}px` }}>選擇動作類型</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[ { id: 'switch', label: '跳轉分頁', icon: ArrowRightLeft }, { id: 'card', label: '數位名片', icon: Smartphone }, { id: 'uri', label: '外部網址', icon: LinkIcon }, { id: 'message', label: '自動回覆', icon: FileText } ].map(btn => (
                          <button key={btn.id} type="button" onClick={() => updateArea(activeArea.id, 'type', btn.id)} className="flex flex-col items-center justify-center gap-2 p-3 border font-bold transition-all hover:opacity-80 cursor-pointer" style={{ backgroundColor: activeArea.type === btn.id ? theme.primary : "transparent", borderColor: activeArea.type === btn.id ? theme.primary : currentBorder, color: activeArea.type === btn.id ? "#fff" : theme.textDim, borderRadius: `${theme.radius > 12 ? 12 : theme.radius}px`, fontSize: `${theme.fontSize * 0.9}px` }}>
                            <btn.icon size={18} className={activeArea.type === btn.id ? 'opacity-100' : 'opacity-60'}/> {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-3">
                      <label className="font-black uppercase tracking-widest flex justify-between items-center" style={{ color: theme.primary, fontSize: `${theme.fontSize * 0.8}px` }}>
                        <span>設定目標 ({activeArea.type.toUpperCase()})</span>
                      </label>
                      {activeArea.type === 'switch' ? (
                        <select value={activeArea.value} onChange={(e) => updateArea(activeArea.id, 'value', e.target.value)} className="w-full bg-black/10 border p-4 outline-none cursor-pointer focus:ring-1" style={{ color: theme.textMain, borderColor: currentBorder, ringColor: theme.primary, borderRadius: `${theme.radius > 12 ? 12 : theme.radius}px`, fontSize: `${theme.fontSize}px` }}>
                          <option value="" disabled style={{ color: theme.textDim }}>選擇目標分頁...</option>
                          {pages.map((p, i) => i !== activePageIndex && <option key={p.id} value={i}>➡️ {p.name}</option>)}
                        </select>
                      ) : activeArea.type === 'card' ? (
                        <select value={activeArea.value} onChange={(e) => updateArea(activeArea.id, 'value', e.target.value)} className="w-full bg-black/10 border p-4 outline-none cursor-pointer focus:ring-1" style={{ color: theme.textMain, borderColor: currentBorder, ringColor: theme.primary, borderRadius: `${theme.radius > 12 ? 12 : theme.radius}px`, fontSize: `${theme.fontSize}px` }}>
                          <option value="" disabled style={{ color: theme.textDim }}>選擇數位名片...</option>
                          {allUsers.map(u => <option key={u.id} value={`/p/${u.id}`}>👤 {u.displayName}</option>)}
                        </select>
                      ) : (
                        <textarea rows={6} value={activeArea.value} onChange={(e) => updateArea(activeArea.id, 'value', e.target.value)} className="w-full bg-black/10 border p-4 outline-none resize-none transition-all placeholder:opacity-40 focus:ring-1" style={{ color: theme.textMain, borderColor: currentBorder, ringColor: theme.primary, borderRadius: `${theme.radius > 12 ? 12 : theme.radius}px`, fontSize: `${theme.fontSize}px` }} placeholder={activeArea.type === 'uri' ? "https://..." : "輸入文字訊息..."} />
                      )}
                    </div>
                  </div>
                )}
                {inspectorTab === 'layout' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="p-5 border flex flex-col gap-4 bg-black/5 shadow-inner" style={{ borderColor: currentBorder, borderRadius: `${theme.radius}px` }}>
                      <label className="font-black uppercase tracking-widest text-center mb-2" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.85}px` }}>精確座標控制 (%)</label>
                      <div className="grid grid-cols-2 gap-4">
                        {['x', 'y', 'w', 'h'].map(k => (
                          <div key={k} className="flex flex-col gap-1 relative bg-black/10 p-2 rounded-lg border" style={{ borderColor: currentBorder }}>
                            <span className="font-mono uppercase font-black pl-1" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.75}px` }}>{k} 軸</span>
                            <input type="number" step="0.5" value={activeArea[k as keyof typeof activeArea].toFixed(1)} onChange={(e) => updateArea(activeArea.id, k, parseFloat(e.target.value))} className="w-full bg-transparent outline-none font-mono text-lg font-bold" style={{ color: theme.textMain, fontSize: `${theme.fontSize * 1.2}px` }} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-50 p-6 bg-black/5">
              <Crosshair size={48} className="mb-4" style={{ color: theme.textDim }}/>
              <div className="text-center font-black uppercase tracking-[0.2em] leading-loose" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.9}px` }}>在畫布上點擊熱區<br/>以編輯屬性</div>
            </div>
          )}
        </aside>
      </div>

      {/* 🤖 AI 對話框 (fixed z-50) */}
      <div className={`fixed bottom-8 right-8 z-[50] transition-all duration-300 ease-out flex flex-col justify-end items-end pointer-events-none ${showAI ? 'w-[380px] h-[580px]' : 'w-16 h-16'}`}>
        {!showAI ? (
          <button type="button" onClick={() => setShowAI(true)} className="w-16 h-16 flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:scale-105 transition-transform text-white border border-white/20 pointer-events-auto cursor-pointer" style={{ backgroundColor: theme.primary, borderRadius: `${theme.radius > 24 ? 24 : theme.radius}px` }}>
            <Sparkles size={24} />
          </button>
        ) : (
          <div className="w-full h-full border flex flex-col overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.8)] pointer-events-auto" style={{ backgroundColor: theme.bgPanel, borderColor: currentBorder, borderRadius: `${theme.radius > 24 ? 24 : theme.radius}px` }}>
            <div className="px-5 py-4 border-b flex justify-between items-center shrink-0" style={{ backgroundColor: theme.bgHeader, borderColor: currentBorder }}>
              <div className="flex items-center gap-2 font-black tracking-widest uppercase" style={{ color: theme.textMain, fontSize: `${theme.fontSize * 0.9}px` }}>
                <Sparkles size={16} style={{ color: theme.primary }}/> AI 營運顧問
              </div>
              <button type="button" onClick={() => setShowAI(false)} className="hover:opacity-50 opacity-100 transition-opacity cursor-pointer" style={{ color: theme.textDim }}><X size={18}/></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-5 select-text bg-black/10 custom-scrollbar">
              {aiMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div 
                    className={`max-w-[85%] px-4 py-3 leading-relaxed font-medium shadow-md ${m.role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none border'}`}
                    style={{ backgroundColor: m.role === 'user' ? theme.primary : theme.bgInput, color: m.role === 'user' ? "#fff" : theme.textMain, borderColor: m.role === 'user' ? "transparent" : currentBorder, borderRadius: `${theme.radius > 16 ? 16 : theme.radius}px`, fontSize: `${theme.fontSize}px` }}
                    dangerouslySetInnerHTML={{ __html: m.role === 'ai' ? formatMarkdown(m.text) : m.text }}
                  />
                </div>
              ))}
              {isAiLoading && <div className="font-bold animate-pulse uppercase tracking-[0.2em] flex items-center gap-2" style={{ color: theme.primary, fontSize: `${theme.fontSize * 0.8}px` }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.primary }}></span> 思考中...</div>}
              <div ref={chatEndRef} className="h-1 shrink-0" />
            </div>
            <div className="p-4 border-t flex gap-2 shrink-0" style={{ backgroundColor: theme.bgHeader, borderColor: currentBorder }}>
              <input value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && askGemini()} placeholder="輸入問題或指令..." className="flex-1 bg-black/20 border px-4 py-2.5 outline-none transition-all focus:ring-1" style={{ borderColor: currentBorder, ringColor: theme.primary, borderRadius: `${theme.radius > 12 ? 12 : theme.radius}px`, color: theme.textMain, fontSize: `${theme.fontSize}px` }} />
              <button type="button" onClick={askGemini} className="px-4 text-white shadow-sm flex items-center justify-center hover:brightness-110 active:scale-95 cursor-pointer" style={{ backgroundColor: theme.primary, borderRadius: `${theme.radius > 12 ? 12 : theme.radius}px` }}><Send size={16}/></button>
            </div>
          </div>
        )}
      </div>

      {/* 🎨 V16: 完美的懸浮視窗 (固定尺寸，絕不變形) */}
      {showThemeModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-auto" style={{ zIndex: 99999 }}>
          {/* 背景遮罩 */}
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in" onClick={() => setShowThemeModal(false)}></div>
          
          {/* 視窗主體 (強制鎖定 860x600) */}
          <div className="relative w-[860px] h-[600px] bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            
            {/* Header (固定 60px) */}
            <div className="h-[60px] px-6 border-b border-white/10 flex justify-between items-center shrink-0 bg-[#111111]">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-white/5"><Palette size={18} className="text-white"/></div>
                <div>
                  <h2 className="text-base font-black text-white leading-tight">主題風格工作站</h2>
                  <p className="uppercase tracking-widest font-bold text-gray-500 text-[9px]">SaaS Interface Customization</p>
                </div>
              </div>
              <button type="button" onClick={() => setShowThemeModal(false)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors active:scale-90 text-gray-400 hover:text-white cursor-pointer"><X size={18}/></button>
            </div>

            {/* Body */}
            <div className="flex-1 flex overflow-hidden">
              
              {/* 左側參數區 (固定 320px 寬，可滾動) */}
              <div className="w-[320px] shrink-0 border-r border-white/10 flex flex-col bg-[#111111]">
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">
                  
                  {/* 快速預設 */}
                  <section>
                    <div className="flex items-center gap-2 mb-3 text-white">
                      <Zap size={14}/><span className="font-black uppercase tracking-widest text-[10px]">快速風格套用</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(THEME_PRESETS).map(([name, p]) => (
                        <button key={name} type="button" onClick={() => setTheme(p)} className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5 transition-all hover:bg-white/10 group cursor-pointer">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 rounded-full border border-white/20 shadow-sm shrink-0" style={{ backgroundColor: p.primary }}></div>
                            <span className="font-bold text-[10px] text-gray-300 group-hover:text-white transition-colors">{name}</span>
                          </div>
                          {theme.primary === p.primary && <Check size={14} className="text-white shrink-0"/>}
                        </button>
                      ))}
                    </div>
                  </section>

                  {/* 色彩定義 */}
                  <section className="space-y-3">
                    <div className="flex items-center gap-2 mb-3 text-white">
                      <Layout size={14}/><span className="font-black uppercase tracking-widest text-[10px]">核心色彩定義</span>
                    </div>
                    <div className="space-y-2">
                      {[ { l: "品牌色", k: "primary" }, { l: "主要背景", k: "bgMain" }, { l: "標題底色", k: "bgHeader" }, { l: "面板底色", k: "bgPanel" }, { l: "輸入框底", k: "bgInput" }, { l: "主要文字", k: "textMain" }, { l: "次要文字", k: "textDim" } ].map(item => (
                        <div key={item.k} className="flex justify-between items-center p-2.5 rounded-lg border border-white/10 bg-black/40 hover:bg-black/60 transition-colors">
                          <span className="font-bold text-gray-300 text-xs px-1">{item.l}</span>
                          <div className="flex items-center gap-2">
                             <span className="font-mono uppercase text-gray-600 text-[9px]">{(theme as any)[item.k]}</span>
                             <input type="color" value={(theme as any)[item.k]} onChange={(e) => setTheme({...theme, [item.k]: e.target.value})} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent shrink-0"/>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* 幾何與細節 */}
                  <section className="space-y-4 pb-2">
                    <div className="flex items-center gap-2 mb-3 text-white">
                      <Sliders size={14}/><span className="font-black uppercase tracking-widest text-[10px]">幾何與細節</span>
                    </div>
                    {[ { l: "圓角幅度", k: "radius", m: 0, x: 32, s: 2, u: "px" }, { l: "邊框透感", k: "borderOpacity", m: 0, x: 0.5, s: 0.01, u: "" }, { l: "介面字體", k: "fontSize", m: 10, x: 18, s: 1, u: "px" } ].map(s => (
                      <div key={s.k} className="space-y-3 p-4 rounded-lg border border-white/10 bg-black/40">
                        <div className="flex justify-between items-center font-bold">
                          <span className="text-gray-300 text-xs px-1">{s.l}</span>
                          <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded text-white text-[10px]">{(theme as any)[s.k]}{s.u}</span>
                        </div>
                        <input type="range" min={s.m} max={s.x} step={s.s} value={(theme as any)[s.k]} onChange={(e) => setTheme({...theme, [s.k]: parseFloat(e.target.value)})} className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white"/>
                      </div>
                    ))}
                  </section>
                </div>
              </div>

              {/* 右側預覽區 (彈性佔滿剩餘空間，確保內部卡片置中不變形) */}
              <div className="flex-1 bg-[#050505] relative flex flex-col items-center justify-center p-8 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:20px_20px]">
                 
                 <div className="absolute top-6 flex items-center gap-1.5 px-4 py-1.5 rounded-full border border-white/10 shadow-sm backdrop-blur-md bg-white/5">
                    <Monitor size={12} className="text-gray-400"/>
                    <span className="font-black uppercase tracking-[0.2em] text-gray-400 text-[9px]">Live Preview</span>
                 </div>

                 {/* 預覽卡片本體：固定寬度 360px，確保內部元素有足夠空間 */}
                 <div className="w-[360px] shrink-0 border shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden transition-all duration-300" style={{ backgroundColor: theme.bgPanel, borderColor: currentBorder, borderRadius: `${theme.radius * 1.5}px` }}>
                    <div className="h-12 flex-none border-b flex items-center justify-between px-5" style={{ backgroundColor: theme.bgHeader, borderColor: currentBorder }}>
                        <div className="flex items-center gap-2">
                           <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: theme.primary }}></div>
                           <div className="w-20 h-1.5 rounded-full bg-white/10"></div>
                        </div>
                        <X size={14} style={{ color: theme.textDim }}/>
                    </div>
                    <div className="p-6 space-y-5 text-center flex-1 flex flex-col justify-center">
                       <div className="space-y-2.5">
                          <div className="h-2 w-full rounded-full bg-white/5"></div>
                          <div className="h-2 w-3/4 rounded-full bg-white/5 mx-auto"></div>
                       </div>
                       <button type="button" className="w-full py-4 font-black shadow-lg cursor-default text-xs transition-all" style={{ backgroundColor: theme.primary, color: "#fff", borderRadius: `${theme.radius}px` }}>
                          DEMO BUTTON
                       </button>
                       <div className="flex gap-3 pt-1">
                          <div className="flex-1 h-14 border-2 border-dashed flex items-center justify-center bg-black/10 transition-all" style={{ borderColor: currentBorder, borderRadius: `${theme.radius}px` }}>
                             <Type size={16} style={{ color: theme.primary }}/>
                          </div>
                          <div className="flex-1 h-14 border-2 border-dashed flex items-center justify-center bg-black/10 transition-all" style={{ borderColor: currentBorder, borderRadius: `${theme.radius}px` }}>
                             <Zap size={16} style={{ color: theme.textDim }} className="opacity-30"/>
                          </div>
                       </div>
                    </div>
                 </div>
                 
                 <p className="absolute bottom-6 font-bold italic tracking-widest opacity-40 text-gray-500 text-[9px]">變更將即時反映</p>
              </div>
            </div>

            {/* Footer (固定 60px) */}
            <div className="h-[60px] px-8 border-t border-white/10 flex justify-between items-center shrink-0 bg-[#111111]">
               <button type="button" onClick={() => setTheme(THEME_PRESETS["SaaS Pro"])} className="font-bold underline decoration-dashed underline-offset-4 text-gray-500 hover:text-white transition-colors text-[11px] cursor-pointer">恢復預設</button>
               <div className="flex gap-3">
                  <button type="button" onClick={() => setShowThemeModal(false)} className="px-6 py-2 font-bold text-gray-400 hover:bg-white/10 hover:text-white transition-all rounded-lg text-xs cursor-pointer">取消</button>
                  <button type="button" onClick={() => setShowThemeModal(false)} className="px-8 py-2 font-black text-black shadow-lg hover:brightness-110 active:scale-95 transition-all bg-white rounded-lg text-xs cursor-pointer">套用變更</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* 📱 模擬器 (Inline Z-Index 防呆) */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-10 pointer-events-auto" style={{ zIndex: 100000 }}>
          <div className="relative w-[380px] h-[780px] bg-neutral-800 rounded-[4rem] border-[14px] border-black shadow-[0_0_120px_rgba(0,0,0,1)] overflow-hidden flex flex-col ring-2 ring-white/10">
            <button type="button" onClick={() => setShowPreview(false)} className="absolute -right-24 top-0 text-white/30 hover:text-white transition group flex flex-col items-center gap-2 cursor-pointer"><div className="p-3 bg-white/5 rounded-full group-hover:bg-red-500 transition"><X size={32}/></div><span className="text-[10px] font-black uppercase tracking-widest">Close</span></button>
            <div className="bg-neutral-900 text-white p-6 flex items-center gap-3 shrink-0 border-b border-black/30 shadow-lg relative">
              <button type="button" onClick={handleSimulatorBack} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition flex items-center text-blue-400 cursor-pointer"><ChevronLeft size={24}/></button>
              <div className="font-black text-base tracking-tight flex-1 text-center pr-12">{pages[previewPageIndex].name}</div>
            </div>
            <div className="flex-1 p-8 flex flex-col justify-end gap-6 bg-[#7286a5]/30">
              <div className="flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-500"><div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/10 shadow-lg"><MessageCircle size={20} className="text-white/40"/></div><div className="bg-white text-[#1a1a1a] text-sm p-5 rounded-[24px] rounded-tl-none shadow-2xl leading-relaxed font-medium">歡迎來到預覽模式！點擊熱區即可測試動作。</div></div>
            </div>
            <div className="bg-white shrink-0 relative shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
              {pages[previewPageIndex].imageUrl && (
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: '2500/1686' }}>
                  <img src={pages[previewPageIndex].imageUrl!} className="w-full h-full object-cover" alt="Preview"/>
                  {pages[previewPageIndex].areas.map(area => (
                    <div 
                      key={area.id} 
                      className="absolute hover:bg-black/10 transition-colors cursor-pointer group flex items-center justify-center border border-dashed border-transparent hover:border-black/30" 
                      style={{left:`${area.x}%`, top:`${area.y}%`, width:`${area.w}%`, height:`${area.h}%` }}
                      onClick={() => {
                        if (area.type === 'switch' && area.value !== "") handleSimulatorJump(parseInt(area.value));
                        else alert(`⚡ 觸發動作\n類型：${area.type.toUpperCase()}\n目標：${area.value || '未設定'}`);
                      }}
                    >
                      <span className="opacity-0 group-hover:opacity-100 bg-black/90 text-white text-[10px] font-black px-2.5 py-1 rounded shadow-lg transition-opacity scale-95 group-hover:scale-100">{area.type === 'switch' ? 'JUMP' : area.type.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="h-16 flex items-center justify-center border-t border-gray-100 text-xs font-black text-gray-900 tracking-widest bg-gray-50 uppercase shadow-inner">{pages[previewPageIndex].chatBarText}</div>
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-36 h-1.5 bg-black/30 rounded-full"></div>
          </div>
        </div>
      )}
    </main>
  );
}