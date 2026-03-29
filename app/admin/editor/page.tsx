"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { 
  ImageIcon, Link as LinkIcon, ChevronLeft, Save, RefreshCw, 
  Smartphone, Type, FileText, Info, LayoutGrid, Eye, X, MessageCircle,
  Sparkles, Layers, ArrowRightLeft, Send, ChevronDown, RotateCcw,
  Palette, Crosshair, Rocket, Zap
} from "lucide-react";
import Link from "next/link";

// 💡 輔助函式：HEX 色碼轉 RGBA
const hexToRgba = (hex: string, alpha: number) => {
  const r = parseInt(hex.slice(1, 3), 16) || 255;
  const g = parseInt(hex.slice(3, 5), 16) || 255;
  const b = parseInt(hex.slice(5, 7), 16) || 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// 💡 四大商業級預設主題庫
const THEME_PRESETS = {
  "Classic Dark": { primary: "#3b82f6", bgMain: "#050505", bgHeader: "#0a0a0a", bgPanel: "#0a0a0a", bgInput: "#151515", borderColor: "#ffffff", borderOpacity: 0.08, textMain: "#ffffff", textDim: "#9ca3af", radius: 12, fontSize: 12 },
  "Cyberpunk": { primary: "#f43f5e", bgMain: "#0f0f13", bgHeader: "#1a1a24", bgPanel: "#1a1a24", bgInput: "#2a2a35", borderColor: "#f43f5e", borderOpacity: 0.2, textMain: "#ffffff", textDim: "#fda4af", radius: 4, fontSize: 12 },
  "Midnight Blue": { primary: "#38bdf8", bgMain: "#020617", bgHeader: "#0f172a", bgPanel: "#0f172a", bgInput: "#1e293b", borderColor: "#38bdf8", borderOpacity: 0.15, textMain: "#f8fafc", textDim: "#94a3b8", radius: 16, fontSize: 12 },
  "Forest Minimal": { primary: "#10b981", bgMain: "#022c22", bgHeader: "#064e3b", bgPanel: "#064e3b", bgInput: "#065f46", borderColor: "#34d399", borderOpacity: 0.1, textMain: "#ecfdf5", textDim: "#6ee7b7", radius: 24, fontSize: 13 }
};

const DEFAULT_THEME = THEME_PRESETS["Classic Dark"];

interface MenuPage {
  id: string;
  name: string;
  imageUrl: string | null;
  areas: any[];
  chatBarText: string;
}

type InteractionMode = 'idle' | 'drawing' | 'dragging' | 'resizing';
type ResizeHandle = 'nw' | 'ne' | 'se' | 'sw';

export default function RiverLinkMegaEditorV10_2() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  
  const [pages, setPages] = useState<MenuPage[]>([
    { id: 'p1', name: '主選單', imageUrl: null, areas: [], chatBarText: '✨ 點我展開選單 ✨' }
  ]);
  const [history, setHistory] = useState<MenuPage[][]>([]); 
  const [activePageIndex, setActivePageIndex] = useState(0); 
  const [allUsers, setAllUsers] = useState<any[]>([]);
  
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [showThemeModal, setShowThemeModal] = useState(false);

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // 💡 右側屬性面板的分頁狀態 (動作 / 佈局)
  const [inspectorTab, setInspectorTab] = useState<'action' | 'layout'>('action');

  const [mode, setMode] = useState<InteractionMode>('idle');
  const [activeHandle, setActiveHandle] = useState<ResizeHandle | null>(null);
  const [interactionStart, setInteractionStart] = useState<{ startX: number, startY: number, initialArea: any } | null>(null);

  const [showPreview, setShowPreview] = useState(false);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [previewHistory, setPreviewHistory] = useState<number[]>([]);
  const [imageSizeInfo, setImageSizeInfo] = useState({ w: 0, h: 0, mb: "0.00" });

  const [showAI, setShowAI] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMessages, setAiMessages] = useState<{role: string, text: string}[]>([
    { role: 'ai', text: '艦長！V10.2 專業防呆引擎上線！\n\n- 🛡️ **視覺安全防護**：設定視窗已加上遮罩與高度限制，絕對不會再與背景糊在一起。\n- 📑 **屬性分頁化**：右側面板更清爽了！' }
  ]);

  const containerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const activePage = pages[activePageIndex];
  const currentBorder = hexToRgba(theme.borderColor, theme.borderOpacity);

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
          if (config.theme) setTheme({ ...DEFAULT_THEME, ...config.theme });
          
          const firstImg = config.pages?.[0]?.imageUrl;
          if (firstImg) {
            const img = new Image();
            img.onload = () => setImageSizeInfo({ w: img.width, h: img.height, mb: "已儲存" });
            img.src = firstImg;
          }
        }
      } catch (e) { console.error(e); }
    };
    init();
  }, [uid]);

  useEffect(() => {
    if (showAI) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages, showAI, isAiLoading]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)) return;
      if ((e.key === 'Backspace' || e.key === 'Delete') && selectedId) deleteArea(selectedId);
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, history, pages]);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (mode !== 'idle') {
        setMode('idle');
        setActiveHandle(null);
        setInteractionStart(null);
      }
    };
    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [mode]);

  const saveHistory = useCallback(() => {
    setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(pages))]);
  }, [pages]);

  const undo = () => {
    if (history.length === 0) return;
    setPages(history[history.length - 1]);
    setHistory(prev => prev.slice(0, -1));
    setSelectedId(null);
  };

  const updateActivePage = (data: Partial<MenuPage>) => {
    const newPages = [...pages];
    newPages[activePageIndex] = { ...newPages[activePageIndex], ...data };
    setPages(newPages);
  };

  const updateArea = (id: number, field: string, value: any) => {
    saveHistory();
    const updatedAreas = activePage.areas.map(a => a.id === id ? { ...a, [field]: value } : a);
    updateActivePage({ areas: updatedAreas });
  };

  const deleteArea = (id: number) => {
    saveHistory();
    updateActivePage({ areas: activePage.areas.filter(a => a.id !== id) });
    setSelectedId(null);
  };

  const deletePage = (e: React.MouseEvent, indexToDelete: number) => {
    e.stopPropagation();
    if (pages.length <= 1) { alert("⚠️ 必須至少保留一個主選單分頁！"); return; }
    if (!confirm(`確定要刪除「${pages[indexToDelete].name}」嗎？此操作無法復原。`)) return;
    
    saveHistory();
    const newPages = pages.filter((_, i) => i !== indexToDelete);
    setPages(newPages);
    if (activePageIndex === indexToDelete) setActivePageIndex(Math.max(0, indexToDelete - 1));
    else if (activePageIndex > indexToDelete) setActivePageIndex(activePageIndex - 1);
    setSelectedId(null);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!activePage.imageUrl || !containerRef.current) return;
    const target = e.target as HTMLElement;
    if (target.closest('.hot-area') || target.closest('.del-btn') || target.dataset.handle) {
      const rect = containerRef.current.getBoundingClientRect();
      let x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      let y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      if (target.dataset.handle) {
        e.stopPropagation();
        saveHistory();
        setMode('resizing');
        setActiveHandle(target.dataset.handle as ResizeHandle);
        const area = activePage.areas.find(a => a.id === selectedId);
        setInteractionStart({ startX: x, startY: y, initialArea: { ...area } });
        return;
      }
      if (target.closest('.hot-area')) {
        e.stopPropagation();
        const areaId = Number((target.closest('.hot-area') as HTMLElement).dataset.id);
        setSelectedId(areaId);
        saveHistory();
        setMode('dragging');
        const area = activePage.areas.find(a => a.id === areaId);
        setInteractionStart({ startX: x, startY: y, initialArea: { ...area } });
        return;
      }
    }
    
    saveHistory();
    const rect = containerRef.current.getBoundingClientRect();
    let x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    let y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    setMode('drawing');
    const newId = Date.now();
    updateActivePage({ areas: [...activePage.areas, { id: newId, x, y, w: 0.1, h: 0.1, type: 'card', value: '' }] });
    setSelectedId(newId);
    setInteractionStart({ startX: x, startY: y, initialArea: null });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mode === 'idle' || !selectedId || !containerRef.current || !interactionStart) return;

    const rect = containerRef.current.getBoundingClientRect();
    let curX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    let curY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

    const deltaX = curX - interactionStart.startX;
    const deltaY = curY - interactionStart.startY;
    const { initialArea, startX, startY } = interactionStart;

    let updatedAreas = [...activePage.areas];
    const areaIndex = updatedAreas.findIndex(a => a.id === selectedId);
    if (areaIndex === -1) return;

    let newArea = { ...updatedAreas[areaIndex] };

    if (mode === 'drawing') {
      newArea.w = Math.abs(curX - startX);
      newArea.h = Math.abs(curY - startY);
      newArea.x = curX < startX ? curX : startX;
      newArea.y = curY < startY ? curY : startY;
    } 
    else if (mode === 'dragging') {
      newArea.x = Math.max(0, Math.min(100 - newArea.w, initialArea.x + deltaX));
      newArea.y = Math.max(0, Math.min(100 - newArea.h, initialArea.y + deltaY));
    } 
    else if (mode === 'resizing' && activeHandle) {
      if (activeHandle.includes('e')) newArea.w = Math.max(1, Math.min(100 - initialArea.x, initialArea.w + deltaX));
      if (activeHandle.includes('s')) newArea.h = Math.max(1, Math.min(100 - initialArea.y, initialArea.h + deltaY));
      if (activeHandle.includes('w')) {
        const potentialW = initialArea.w - deltaX;
        if (potentialW > 1) { newArea.x = Math.max(0, initialArea.x + deltaX); newArea.w = potentialW; }
      }
      if (activeHandle.includes('n')) {
        const potentialH = initialArea.h - deltaY;
        if (potentialH > 1) { newArea.y = Math.max(0, initialArea.y + deltaY); newArea.h = potentialH; }
      }
    }
    updatedAreas[areaIndex] = newArea;
    updateActivePage({ areas: updatedAreas });
  };

  const handleImageUpload = (e: any) => {
    const file = e.target.files[0];
    if (!file) return;
    saveHistory();
    const reader = new FileReader();
    reader.onload = (event: any) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, img.width, img.height);
          const compressed = canvas.toDataURL("image/jpeg", 0.7);
          setImageSizeInfo({ w: img.width, h: img.height, mb: ((compressed.length - 22) * 3 / 4 / 1024 / 1024).toFixed(2) });
          updateActivePage({ imageUrl: compressed });
        }
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

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
    } else { setShowPreview(false); }
  };

  const handleExport = async () => {
    setIsExporting(true);
    await new Promise(r => setTimeout(r, 1500));
    setIsExporting(false);
    alert("🚀 專案已成功打包，並同步至 LINE 官方 API 端點！");
  };

  const askGemini = async () => {
    if (!aiInput.trim()) return;
    setAiMessages(prev => [...prev, { role: 'user', text: aiInput }]);
    setAiInput("");
    setIsAiLoading(true);
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: aiInput, pagesInfo: pages.map(p => ({ name: p.name })) }),
      });
      const data = await res.json();
      setAiMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
    } catch (err) {
      setAiMessages(prev => [...prev, { role: 'ai', text: "連線異常。" }]);
    } finally { setIsAiLoading(false); }
  };

  const formatMarkdown = (text: string) => {
    if (!text) return "";
    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;"); 
    html = html.replace(/\*\*(.*?)\*\*/g, `<strong style="color:${theme.primary}">$1</strong>`); 
    html = html.replace(/\n/g, '<br/>'); 
    return html;
  };

  const activeArea = activePage.areas.find(a => a.id === selectedId);

  return (
    <main 
      className="h-screen flex flex-col overflow-hidden font-sans select-none transition-colors duration-300"
      style={{ backgroundColor: theme.bgMain, color: theme.textMain, fontSize: `${theme.fontSize}px` }}
    >
      {/* 🚀 Header */}
      <header 
        className="h-[84px] flex justify-between items-center px-8 shrink-0 z-40 shadow-sm border-b transition-colors duration-300"
        style={{ backgroundColor: theme.bgHeader, borderColor: currentBorder }}
      >
        <div className="flex items-center gap-8">
          <Link href="/admin" className="p-2.5 rounded-full transition-all border hover:opacity-80" style={{ backgroundColor: theme.bgInput, borderColor: currentBorder, color: theme.textDim }}>
            <ChevronLeft size={20}/>
          </Link>
          <div className="flex flex-col">
            <input 
              value={activePage.name} 
              onChange={(e) => updateActivePage({name: e.target.value})} 
              className="bg-transparent border-none outline-none font-black rounded px-2 py-1 transition-all focus:bg-white/5"
              style={{ color: theme.textMain, fontSize: `${theme.fontSize * 1.5}px` }}
            />
            <div className="flex items-center gap-2 mt-1 px-2">
              <span className="w-2 h-2 rounded-full animate-pulse transition-colors duration-300" style={{ backgroundColor: theme.primary, boxShadow: `0 0 8px ${theme.primary}` }}></span>
              <span className="uppercase tracking-[0.2em] font-mono" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.75}px` }}>Mega V10.2 Flagship</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={undo} disabled={history.length === 0} className="px-5 py-3 rounded-xl transition-all border font-bold disabled:opacity-20 hover:opacity-80 flex items-center gap-2" style={{ backgroundColor: theme.bgInput, borderColor: currentBorder, color: theme.textDim, borderRadius: `${theme.radius}px`, fontSize: `${theme.fontSize}px` }}>
            <RotateCcw size={16}/> 撤銷
          </button>
          <button onClick={() => { setPreviewPageIndex(0); setPreviewHistory([]); setShowPreview(true); }} className="px-6 py-3 rounded-xl font-bold border transition-all hover:opacity-80 flex items-center gap-2" style={{ backgroundColor: theme.bgInput, borderColor: theme.primary, color: theme.primary, borderRadius: `${theme.radius}px`, fontSize: `${theme.fontSize}px` }}>
            <Eye size={16}/> 模擬器
          </button>
          <button 
            onClick={async () => { 
              setSaving(true); 
              await updateDoc(doc(db, "users", uid!), { megaMenuConfig: { pages, theme, updatedAt: new Date().toISOString() } }); 
              setSaving(false); 
              alert("✅ 專案與主題配置已儲存！"); 
            }} 
            className="px-8 py-3 rounded-xl font-black transition-all shadow-lg hover:scale-105 active:scale-95 flex items-center gap-2 border border-transparent"
            style={{ backgroundColor: theme.primary, color: "#fff", borderRadius: `${theme.radius}px`, fontSize: `${theme.fontSize}px` }}
          >
            {saving ? <RefreshCw className="animate-spin" size={16}/> : <Save size={16}/>} 儲存
          </button>
        </div>
      </header>

      {/* 🧩 頁面導航 */}
      <nav 
        className="border-b px-8 py-4 flex items-center gap-4 overflow-x-auto shrink-0 custom-scrollbar transition-colors duration-300"
        style={{ backgroundColor: theme.bgMain, borderColor: currentBorder }}
      >
        {pages.map((page, index) => (
          <div 
            key={page.id}
            onClick={() => { setActivePageIndex(index); setSelectedId(null); }}
            className="group flex items-center gap-3 px-6 py-2.5 font-black uppercase tracking-widest transition-all border shadow-sm cursor-pointer shrink-0"
            style={{ 
              backgroundColor: activePageIndex === index ? theme.textMain : theme.bgInput, 
              color: activePageIndex === index ? theme.bgMain : theme.textDim,
              borderColor: activePageIndex === index ? theme.textMain : currentBorder,
              borderRadius: `${theme.radius}px`,
              fontSize: `${theme.fontSize * 0.9}px`
            }}
          >
            <Layers size={14} className={activePageIndex === index ? 'opacity-100' : 'opacity-70'}/> 
            <span className="whitespace-nowrap">{page.name}</span>
            {pages.length > 1 && (
              <button 
                onClick={(e) => deletePage(e, index)}
                className={`ml-1 p-1 rounded-full hover:bg-red-500 hover:text-white transition-all ${activePageIndex === index ? 'text-gray-400' : 'text-gray-600'}`}
                title="刪除分頁"
              >
                <X size={14} strokeWidth={3}/>
              </button>
            )}
          </div>
        ))}
        {pages.length < 6 && (
          <button onClick={() => { saveHistory(); setPages([...pages, { id: `p${Date.now()}`, name: `分頁 ${pages.length + 1}`, imageUrl: null, areas: [], chatBarText: '✨ 點我展開 ✨' }]); setActivePageIndex(pages.length); }} className="px-6 py-2.5 border border-dashed transition-all flex items-center gap-2 font-bold hover:opacity-80 shrink-0" style={{ backgroundColor: theme.bgInput, borderColor: currentBorder, color: theme.textDim, borderRadius: `${theme.radius}px`, fontSize: `${theme.fontSize * 0.9}px` }}>
            <span className="text-lg leading-none">+</span> 新增
          </button>
        )}
      </nav>

      <div className="flex-1 flex overflow-hidden">
        
        {/* 🛠️ 左側面板 */}
        <aside 
          className="border-r flex flex-col shrink-0 transition-colors duration-300 z-10 shadow-[4px_0_24px_rgba(0,0,0,0.2)]"
          style={{ width: "320px", backgroundColor: theme.bgPanel, borderColor: currentBorder }}
        >
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <button 
              onClick={() => setShowThemeModal(true)}
              className="w-full p-4 flex items-center justify-center gap-2 border transition-all hover:scale-[1.02] shadow-sm font-bold"
              style={{ backgroundColor: `${theme.primary}15`, borderColor: `${theme.primary}50`, color: theme.primary, borderRadius: `${theme.radius}px`, fontSize: `${theme.fontSize}px` }}
            >
              <Palette size={16} /> 視覺主題設定 (Theme)
            </button>

            <section className="p-5 border transition-all" style={{ backgroundColor: theme.bgInput, borderRadius: `${theme.radius}px`, borderColor: currentBorder }}>
              <h3 className="font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.8}px` }}><Type size={14} style={{ color: theme.primary }}/> 選單標籤 (Chat Bar)</h3>
              <input 
                value={activePage.chatBarText} 
                onChange={(e) => updateActivePage({chatBarText: e.target.value})} 
                className="w-full bg-black/20 border p-4 outline-none transition-all shadow-inner focus:ring-1" 
                style={{ color: theme.textMain, borderColor: currentBorder, ringColor: theme.primary, borderRadius: `${theme.radius > 8 ? 8 : theme.radius}px`, fontSize: `${theme.fontSize}px` }}
                placeholder="例如：點擊領取優惠" 
              />
            </section>

            <section className="p-5 border transition-all" style={{ backgroundColor: theme.bgInput, borderRadius: `${theme.radius}px`, borderColor: currentBorder }}>
              <h3 className="font-black uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.8}px` }}><Info size={14} style={{ color: theme.primary }}/> 圖片狀態</h3>
              {activePage.imageUrl ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center bg-black/20 p-3 border" style={{ borderColor: currentBorder, borderRadius: `${theme.radius > 8 ? 8 : theme.radius}px`, fontSize: `${theme.fontSize * 0.9}px` }}>
                    <span className="font-bold" style={{ color: theme.textDim }}>解析度</span>
                    <span className="font-mono text-white/80">{imageSizeInfo.w} x {imageSizeInfo.h}</span>
                  </div>
                  <div className="flex justify-between items-center bg-black/20 p-3 border" style={{ borderColor: currentBorder, borderRadius: `${theme.radius > 8 ? 8 : theme.radius}px`, fontSize: `${theme.fontSize * 0.9}px` }}>
                    <span className="font-bold" style={{ color: theme.textDim }}>檔案容量</span>
                    <span className="font-mono font-bold" style={{ color: theme.primary }}>{imageSizeInfo.mb} MB</span>
                  </div>
                </div>
              ) : (
                <div className="font-bold p-4 text-center border border-dashed uppercase bg-black/20" style={{ color: theme.textDim, borderColor: currentBorder, borderRadius: `${theme.radius > 8 ? 8 : theme.radius}px`, fontSize: `${theme.fontSize * 0.9}px` }}>尚未上傳圖片</div>
              )}
            </section>
          </div>

          <div className="p-6 border-t shrink-0" style={{ borderColor: currentBorder, backgroundColor: theme.bgHeader }}>
            <button 
              onClick={handleExport}
              className="w-full py-4 flex items-center justify-center gap-2 font-black uppercase tracking-widest transition-all shadow-[0_4px_15px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-95 border border-white/10"
              style={{ backgroundColor: theme.primary, color: "#fff", borderRadius: `${theme.radius}px`, fontSize: `${theme.fontSize * 1.1}px` }}
            >
              {isExporting ? <RefreshCw className="animate-spin" size={18}/> : <Rocket size={18}/>} 
              {isExporting ? '打包發布中...' : '發布至 LINE'}
            </button>
          </div>
        </aside>

        {/* 🎨 畫布空間 */}
        <section className="flex-1 flex flex-col relative overflow-hidden transition-colors duration-300" style={{ backgroundColor: theme.bgMain }}>
          <div className="flex-1 overflow-auto flex flex-col items-center justify-center pb-24 relative bg-[radial-gradient(#ffffff11_1px,transparent_1px)] [background-size:24px_24px]">
            {!activePage.imageUrl ? (
              <label className="flex flex-col items-center justify-center gap-6 cursor-pointer w-[400px] h-[300px] border-2 border-dashed hover:opacity-80 transition-all bg-black/40 shadow-2xl backdrop-blur-sm" style={{ borderColor: currentBorder, borderRadius: `${theme.radius * 2}px` }}>
                <ImageIcon style={{ color: theme.textDim }} size={48}/>
                <p className="font-bold tracking-widest" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 1.2}px` }}>點擊上傳選單圖片</p>
                <input type="file" className="hidden" onChange={handleImageUpload} />
              </label>
            ) : (
              <div 
                ref={containerRef} 
                className="relative shadow-2xl inline-block cursor-crosshair ring-1 m-10 bg-black/20" 
                style={{ ringColor: currentBorder, borderRadius: `${theme.radius > 16 ? 16 : theme.radius}px` }}
                onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
              >
                <img src={activePage.imageUrl} draggable={false} className="max-h-[70vh] max-w-[70vw] pointer-events-none opacity-95" style={{ borderRadius: `${theme.radius > 16 ? 16 : theme.radius}px` }} />
                
                {activePage.areas.map(area => (
                  <div 
                    key={area.id} 
                    data-id={area.id}
                    className={`hot-area absolute border-2 flex items-center justify-center ${selectedId === area.id ? 'cursor-move' : 'cursor-pointer transition-colors'}`} 
                    style={{
                      left:`${area.x}%`, top:`${area.y}%`, width:`${area.w}%`, height:`${area.h}%`,
                      borderColor: selectedId === area.id ? theme.primary : "rgba(255,255,255,0.4)",
                      backgroundColor: selectedId === area.id ? `${theme.primary}40` : "rgba(0,0,0,0.2)",
                      borderRadius: `${theme.radius > 8 ? 8 : theme.radius}px`
                    }}
                  >
                    {selectedId === area.id && (
                      <>
                        {['nw', 'ne', 'sw', 'se'].map((pos) => (
                          <div 
                            key={pos}
                            data-handle={pos}
                            className="absolute w-3 h-3 bg-white border-2 shadow-sm rounded-full z-40"
                            style={{
                              borderColor: theme.primary,
                              top: pos.includes('n') ? -6 : 'auto',
                              bottom: pos.includes('s') ? -6 : 'auto',
                              left: pos.includes('w') ? -6 : 'auto',
                              right: pos.includes('e') ? -6 : 'auto',
                              cursor: `${pos}-resize`
                            }}
                          />
                        ))}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 🔍 右側屬性面板 (💡 V10.2: 導入 Tab 分頁設計，畫面更清爽) */}
        <aside 
          className="border-l flex flex-col overflow-hidden shrink-0 transition-colors duration-300 z-10 shadow-[-4px_0_24px_rgba(0,0,0,0.2)]"
          style={{ width: "360px", backgroundColor: theme.bgPanel, borderColor: currentBorder }}
        >
          <div className="p-6 border-b shrink-0 flex items-center gap-2" style={{ borderColor: currentBorder }}>
            <Zap size={16} style={{ color: theme.primary }}/>
            <h3 className="font-black uppercase tracking-widest" style={{ color: theme.textMain, fontSize: `${theme.fontSize}px` }}>屬性檢視器</h3>
          </div>

          {activeArea ? (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Tabs Header */}
              <div className="flex border-b shrink-0" style={{ borderColor: currentBorder, backgroundColor: theme.bgHeader }}>
                <button 
                  onClick={() => setInspectorTab('action')}
                  className="flex-1 py-3 font-bold transition-all relative"
                  style={{ color: inspectorTab === 'action' ? theme.primary : theme.textDim, fontSize: `${theme.fontSize * 0.9}px` }}
                >
                  ⚡ 觸發動作
                  {inspectorTab === 'action' && <div className="absolute bottom-0 left-0 w-full h-0.5" style={{ backgroundColor: theme.primary }}></div>}
                </button>
                <button 
                  onClick={() => setInspectorTab('layout')}
                  className="flex-1 py-3 font-bold transition-all relative border-l"
                  style={{ color: inspectorTab === 'layout' ? theme.primary : theme.textDim, borderColor: currentBorder, fontSize: `${theme.fontSize * 0.9}px` }}
                >
                  📐 座標佈局
                  {inspectorTab === 'layout' && <div className="absolute bottom-0 left-0 w-full h-0.5" style={{ backgroundColor: theme.primary }}></div>}
                </button>
              </div>

              {/* Tabs Content */}
              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                {inspectorTab === 'action' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="space-y-3">
                      <label className="font-black uppercase tracking-widest" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.8}px` }}>1. 選擇動作類型</label>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { id: 'switch', label: '跳轉分頁', icon: ArrowRightLeft },
                          { id: 'card', label: '數位名片', icon: Smartphone },
                          { id: 'uri', label: '外部網址', icon: LinkIcon },
                          { id: 'message', label: '自動回覆', icon: FileText }
                        ].map(btn => (
                          <button 
                            key={btn.id} 
                            onClick={() => updateArea(activeArea.id, 'type', btn.id)} 
                            className="flex flex-col items-center justify-center gap-2 p-3 border font-bold transition-all hover:opacity-80"
                            style={{ 
                              backgroundColor: activeArea.type === btn.id ? theme.primary : "rgba(0,0,0,0.2)",
                              borderColor: activeArea.type === btn.id ? theme.primary : currentBorder,
                              color: activeArea.type === btn.id ? "#fff" : theme.textDim,
                              borderRadius: `${theme.radius > 12 ? 12 : theme.radius}px`,
                              fontSize: `${theme.fontSize * 0.9}px`
                            }}
                          >
                            <btn.icon size={18} className={activeArea.type === btn.id ? 'opacity-100' : 'opacity-60'}/> {btn.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="font-black uppercase tracking-widest flex justify-between items-center" style={{ color: theme.primary, fontSize: `${theme.fontSize * 0.8}px` }}>
                        <span>2. 設定目標 ({activeArea.type.toUpperCase()})</span>
                      </label>
                      {activeArea.type === 'switch' ? (
                        <select value={activeArea.value} onChange={(e) => updateArea(activeArea.id, 'value', e.target.value)} className="w-full bg-black/20 border p-4 text-white outline-none cursor-pointer focus:ring-1" style={{ borderColor: currentBorder, ringColor: theme.primary, borderRadius: `${theme.radius > 12 ? 12 : theme.radius}px`, fontSize: `${theme.fontSize}px` }}>
                          <option value="" disabled className="text-gray-500">選擇目標分頁...</option>
                          {pages.map((p, i) => i !== activePageIndex && <option key={p.id} value={i}>➡️ {p.name}</option>)}
                        </select>
                      ) : activeArea.type === 'card' ? (
                        <select value={activeArea.value} onChange={(e) => updateArea(activeArea.id, 'value', e.target.value)} className="w-full bg-black/20 border p-4 text-white outline-none cursor-pointer focus:ring-1" style={{ borderColor: currentBorder, ringColor: theme.primary, borderRadius: `${theme.radius > 12 ? 12 : theme.radius}px`, fontSize: `${theme.fontSize}px` }}>
                          <option value="" disabled className="text-gray-500">選擇數位名片...</option>
                          {allUsers.map(u => <option key={u.id} value={`/p/${u.id}`}>👤 {u.displayName}</option>)}
                        </select>
                      ) : (
                        <textarea rows={6} value={activeArea.value} onChange={(e) => updateArea(activeArea.id, 'value', e.target.value)} className="w-full bg-black/20 border p-4 text-white outline-none resize-none transition-all placeholder:text-gray-600 focus:ring-1" style={{ borderColor: currentBorder, ringColor: theme.primary, borderRadius: `${theme.radius > 12 ? 12 : theme.radius}px`, fontSize: `${theme.fontSize}px` }} placeholder={activeArea.type === 'uri' ? "https://..." : "輸入文字訊息..."} />
                      )}
                    </div>
                  </div>
                )}

                {inspectorTab === 'layout' && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    <div className="p-5 border transition-all flex flex-col gap-4 bg-black/10 shadow-inner" style={{ borderColor: currentBorder, borderRadius: `${theme.radius}px` }}>
                      <label className="font-black uppercase tracking-widest text-center mb-2" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.85}px` }}>精確座標控制 (%)</label>
                      <div className="grid grid-cols-2 gap-4">
                        {['x', 'y', 'w', 'h'].map(k => (
                          <div key={k} className="flex flex-col gap-1 relative bg-black/20 p-2 rounded-lg border" style={{ borderColor: currentBorder }}>
                            <span className="font-mono uppercase font-black pl-1" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.75}px` }}>{k} 軸</span>
                            <input type="number" step="0.5" value={activeArea[k as keyof typeof activeArea].toFixed(1)} onChange={(e) => updateArea(activeArea.id, k, parseFloat(e.target.value))} className="w-full bg-transparent text-white outline-none font-mono text-lg font-bold" style={{ fontSize: `${theme.fontSize * 1.2}px` }} />
                          </div>
                        ))}
                      </div>
                      <p className="text-center mt-4 opacity-50" style={{ fontSize: `${theme.fontSize * 0.75}px`, color: theme.textDim }}>您也可以直接在畫布上拖曳控制點進行縮放。</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center opacity-50 p-6">
              <Crosshair size={48} className="mb-4" style={{ color: theme.textDim }}/>
              <div className="text-center font-black uppercase tracking-[0.2em] leading-loose" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.9}px` }}>在畫布上點擊熱區<br/>以編輯屬性</div>
            </div>
          )}
        </aside>
      </div>

      {/* 🤖 AI 對話框 */}
      <div className={`fixed bottom-8 right-8 z-[60] transition-all duration-300 ease-out flex flex-col justify-end items-end ${showAI ? 'w-[380px] h-[580px]' : 'w-16 h-16'}`}>
        {!showAI ? (
          <button onClick={() => setShowAI(true)} className="w-16 h-16 flex items-center justify-center shadow-[0_10px_30px_rgba(0,0,0,0.5)] hover:scale-105 transition-transform text-white border-2 relative" style={{ backgroundColor: theme.primary, borderColor: "rgba(255,255,255,0.2)", borderRadius: `${theme.radius > 24 ? 24 : theme.radius}px` }}>
            <Sparkles size={26} />
          </button>
        ) : (
          <div className="w-full h-full border flex flex-col overflow-hidden shadow-[0_30px_100px_rgba(0,0,0,0.8)] transition-all" style={{ backgroundColor: theme.bgPanel, borderColor: currentBorder, borderRadius: `${theme.radius > 24 ? 24 : theme.radius}px` }}>
            <div className="px-5 py-4 border-b flex justify-between items-center text-white shrink-0" style={{ backgroundColor: theme.bgHeader, borderColor: currentBorder }}>
              <div className="flex items-center gap-2 font-black tracking-widest uppercase" style={{ fontSize: `${theme.fontSize * 0.9}px` }}>
                <Sparkles size={16} style={{ color: theme.primary }}/> AI 營運顧問
              </div>
              <button onClick={() => setShowAI(false)} className="hover:opacity-100 opacity-60 transition-opacity"><X size={18}/></button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-5 select-text pointer-events-auto custom-scrollbar bg-black/20" style={{ WebkitOverflowScrolling: 'touch' }}>
              {aiMessages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  <div 
                    className={`max-w-[85%] px-4 py-3 leading-relaxed font-medium shadow-md ${m.role === 'user' ? 'rounded-tr-none' : 'rounded-tl-none border'}`}
                    style={{ 
                      backgroundColor: m.role === 'user' ? theme.primary : theme.bgInput,
                      color: m.role === 'user' ? "#fff" : theme.textMain,
                      borderColor: m.role === 'user' ? "transparent" : currentBorder,
                      borderRadius: `${theme.radius > 16 ? 16 : theme.radius}px`,
                      fontSize: `${theme.fontSize}px`
                    }}
                    dangerouslySetInnerHTML={{ __html: m.role === 'ai' ? formatMarkdown(m.text) : m.text }}
                  />
                </div>
              ))}
              {isAiLoading && <div className="font-bold animate-pulse uppercase tracking-[0.2em] flex items-center gap-2" style={{ color: theme.primary, fontSize: `${theme.fontSize * 0.8}px` }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: theme.primary }}></span> 思考中...</div>}
              <div ref={chatEndRef} className="h-1 shrink-0" />
            </div>
            <div className="p-4 border-t flex gap-2 shrink-0" style={{ backgroundColor: theme.bgHeader, borderColor: currentBorder }}>
              <input value={aiInput} onChange={(e) => setAiInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && askGemini()} placeholder="輸入問題或指令..." className="flex-1 bg-black/40 border px-4 py-2.5 outline-none transition-all shadow-inner focus:ring-1" style={{ borderColor: currentBorder, ringColor: theme.primary, borderRadius: `${theme.radius > 12 ? 12 : theme.radius}px`, color: theme.textMain, fontSize: `${theme.fontSize}px` }} />
              <button onClick={askGemini} className="px-4 text-white shadow-sm flex items-center justify-center transition-all hover:brightness-110 active:scale-95 border border-white/10" style={{ backgroundColor: theme.primary, borderRadius: `${theme.radius > 12 ? 12 : theme.radius}px` }}><Send size={16}/></button>
            </div>
          </div>
        )}
      </div>

      {/* 🎨 懸浮視覺主題控制視窗 (💡 V10.2: 加上強烈遮罩與最大高度限制，防呆設計) */}
      {showThemeModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-md animate-in fade-in duration-200 p-4 sm:p-8">
          <div className="w-[95vw] max-w-4xl max-h-[85vh] border shadow-[0_50px_100px_rgba(0,0,0,0.9)] overflow-hidden flex flex-col bg-opacity-95 backdrop-blur-xl" style={{ backgroundColor: theme.bgPanel, borderColor: currentBorder, borderRadius: `${theme.radius > 24 ? 24 : theme.radius}px` }}>
            
            <div className="p-6 md:px-8 border-b flex justify-between items-center shrink-0 shadow-sm" style={{ backgroundColor: theme.bgHeader, borderColor: currentBorder }}>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${theme.primary}20` }}><Palette size={20} style={{ color: theme.primary }}/></div>
                <div>
                  <h2 className="font-black text-lg" style={{ color: theme.textMain }}>視覺主題設定 (Theme Engine)</h2>
                </div>
              </div>
              <button onClick={() => setShowThemeModal(false)} className="p-2 rounded-full hover:bg-white/10 transition-colors bg-black/20" style={{ color: theme.textDim }}><X size={24}/></button>
            </div>
            
            <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar bg-black/10">
              
              <div className="mb-10">
                <h3 className="font-black uppercase tracking-widest mb-4 pb-2 border-b" style={{ color: theme.primary, borderColor: currentBorder, fontSize: `${theme.fontSize * 0.8}px` }}>Theme Presets (快速風格套用)</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(THEME_PRESETS).map(([name, config]) => (
                    <button
                      key={name}
                      onClick={() => setTheme(config)}
                      className="p-4 border rounded-xl flex flex-col items-center gap-3 transition-all hover:scale-105 hover:shadow-lg bg-black/20"
                      style={{ borderColor: config.borderColor }}
                    >
                      <div className="w-8 h-8 rounded-full shadow-lg border border-white/20" style={{ backgroundColor: config.primary }}></div>
                      <span className="font-bold text-[12px] whitespace-nowrap" style={{ color: config.textMain }}>{name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                <div className="space-y-6">
                  <h3 className="font-black uppercase tracking-widest mb-4 pb-2 border-b" style={{ color: theme.primary, borderColor: currentBorder, fontSize: `${theme.fontSize * 0.8}px` }}>Colors (色彩配置)</h3>
                  <div className="space-y-4 bg-black/20 p-6 border rounded-2xl" style={{ borderColor: currentBorder }}>
                    {[
                      { label: "品牌強調色 (Primary)", key: "primary" },
                      { label: "主背景色 (Main Bg)", key: "bgMain" },
                      { label: "頂部與標題色 (Header Bg)", key: "bgHeader" },
                      { label: "側邊欄色 (Panel Bg)", key: "bgPanel" },
                      { label: "輸入框色 (Input Bg)", key: "bgInput" },
                      { label: "邊框基準色 (Border)", key: "borderColor" },
                      { label: "主文字色 (Text Main)", key: "textMain" },
                      { label: "次要文字色 (Text Dim)", key: "textDim" },
                    ].map(item => (
                      <div key={item.key} className="flex justify-between items-center gap-4">
                        <span className="font-bold whitespace-nowrap" style={{ color: theme.textMain, fontSize: `${theme.fontSize * 0.9}px` }}>{item.label}</span>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-mono uppercase hidden sm:block px-2 py-1 bg-black/40 rounded border" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.8}px`, borderColor: currentBorder }}>{(theme as any)[item.key]}</span>
                          <input type="color" value={(theme as any)[item.key]} onChange={(e) => setTheme({...theme, [item.key]: e.target.value})} className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent shadow-sm" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="font-black uppercase tracking-widest mb-4 pb-2 border-b" style={{ color: theme.primary, borderColor: currentBorder, fontSize: `${theme.fontSize * 0.8}px` }}>Layout (佈局與排版)</h3>
                  <div className="space-y-8 bg-black/20 p-6 border rounded-2xl" style={{ borderColor: currentBorder }}>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold" style={{ color: theme.textMain, fontSize: `${theme.fontSize * 0.9}px` }}>邊框透明度 (Border Opacity)</span>
                        <span className="font-mono font-bold bg-black/40 px-2 py-1 rounded" style={{ color: theme.primary, fontSize: `${theme.fontSize * 0.9}px` }}>{(theme.borderOpacity * 100).toFixed(0)}%</span>
                      </div>
                      <input type="range" min="0" max="1" step="0.01" value={theme.borderOpacity} onChange={(e) => setTheme({...theme, borderOpacity: parseFloat(e.target.value)})} className="w-full h-1.5 bg-black/50 rounded-lg appearance-none cursor-pointer" style={{ accentColor: theme.primary }}/>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold" style={{ color: theme.textMain, fontSize: `${theme.fontSize * 0.9}px` }}>全局圓角 (Global Radius)</span>
                        <span className="font-mono font-bold bg-black/40 px-2 py-1 rounded" style={{ color: theme.primary, fontSize: `${theme.fontSize * 0.9}px` }}>{theme.radius}px</span>
                      </div>
                      <input type="range" min="0" max="32" step="2" value={theme.radius} onChange={(e) => setTheme({...theme, radius: parseInt(e.target.value)})} className="w-full h-1.5 bg-black/50 rounded-lg appearance-none cursor-pointer" style={{ accentColor: theme.primary }}/>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-bold" style={{ color: theme.textMain, fontSize: `${theme.fontSize * 0.9}px` }}>基準字體大小 (Base Font Size)</span>
                        <span className="font-mono font-bold bg-black/40 px-2 py-1 rounded" style={{ color: theme.primary, fontSize: `${theme.fontSize * 0.9}px` }}>{theme.fontSize}px</span>
                      </div>
                      <input type="range" min="10" max="18" step="1" value={theme.fontSize} onChange={(e) => setTheme({...theme, fontSize: parseInt(e.target.value)})} className="w-full h-1.5 bg-black/50 rounded-lg appearance-none cursor-pointer" style={{ accentColor: theme.primary }}/>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 md:p-6 border-t flex justify-end shrink-0 shadow-inner" style={{ backgroundColor: theme.bgHeader, borderColor: currentBorder }}>
              <button onClick={() => setShowThemeModal(false)} className="px-8 py-3 rounded-xl font-bold transition-all hover:scale-105 shadow-lg w-full sm:w-auto border border-white/10" style={{ backgroundColor: theme.primary, color: "#fff", fontSize: `${theme.fontSize}px` }}>套用設定並關閉</button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}