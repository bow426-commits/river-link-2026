"use client";
import { useState, useRef, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { 
  ImageIcon, Link as LinkIcon, ChevronLeft, Save, RefreshCw, 
  Smartphone, Type, FileText, Eye, X, MessageCircle,
  Layers, ArrowRightLeft, RotateCcw, Palette, Crosshair, Rocket, Zap, Sliders, Check, Monitor
} from "lucide-react";
import Link from "next/link";

const THEME_PRESETS = {
  "SaaS Pro": { primary: "#3b82f6", bgMain: "#050505", bgHeader: "#0a0a0a", bgPanel: "#0a0a0a", bgInput: "#151515", borderColor: "#ffffff", borderOpacity: 0.1, radius: 12, fontSize: 12, textMain: "#ffffff", textDim: "#9ca3af" },
  "Cyberpunk": { primary: "#f43f5e", bgMain: "#0f0f13", bgHeader: "#1a1a24", bgPanel: "#1a1a24", bgInput: "#2a2a35", borderColor: "#f43f5e", borderOpacity: 0.2, radius: 6, fontSize: 12, textMain: "#ffffff", textDim: "#fda4af" },
  "Midnight": { primary: "#38bdf8", bgMain: "#020617", bgHeader: "#0f172a", bgPanel: "#0f172a", bgInput: "#1e293b", borderColor: "#38bdf8", borderOpacity: 0.15, radius: 16, fontSize: 12, textMain: "#f8fafc", textDim: "#94a3b8" }
};

interface MenuPage { id: string; name: string; imageUrl: string | null; areas: any[]; chatBarText: string; }

// ==========================================
// 💡 核心編輯器組件
// ==========================================
function EditorContent() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  
  const [pages, setPages] = useState<MenuPage[]>([{ id: 'p1', name: '主選單', imageUrl: null, areas: [], chatBarText: '✨ 點擊展開 ✨' }]);
  const [activePageIndex, setActivePageIndex] = useState(0); 
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [history, setHistory] = useState<MenuPage[][]>([]); 
  const [theme, setTheme] = useState(THEME_PRESETS["SaaS Pro"]);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<'action' | 'layout'>('action');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [mode, setMode] = useState<'idle' | 'drawing' | 'dragging' | 'resizing'>('idle');
  const [activeHandle, setActiveHandle] = useState<string | null>(null);
  const [interactionStart, setInteractionStart] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [previewHistory, setPreviewHistory] = useState<number[]>([]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const activePage = pages[activePageIndex] || { name: '載入中', areas: [] };

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
          if (config.theme) setTheme(config.theme);
        }
      } catch (e) { console.error("Firebase Error:", e); }
    };
    init();
  }, [uid]);

  const saveHistory = useCallback(() => setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(pages))]), [pages]);
  const undo = () => { if (history.length > 0) { setPages(history[history.length - 1]); setHistory(prev => prev.slice(0, -1)); setSelectedId(null); } };
  const updateActivePage = (data: Partial<MenuPage>) => { const n = [...pages]; n[activePageIndex] = { ...n[activePageIndex], ...data }; setPages(n); };
  const updateArea = (id: number, field: string, value: any) => { saveHistory(); updateActivePage({ areas: activePage.areas.map((a:any) => a.id === id ? { ...a, [field]: value } : a) }); };
  const deleteArea = (id: number) => { saveHistory(); updateActivePage({ areas: activePage.areas.filter((a:any) => a.id !== id) }); setSelectedId(null); };

  const handleSimulatorJump = (targetIndex: number) => { setPreviewHistory(prev => [...prev, previewPageIndex]); setPreviewPageIndex(targetIndex); };
  const handleSimulatorBack = () => { if (previewHistory.length > 0) { const newH = [...previewHistory]; setPreviewPageIndex(newH.pop()!); setPreviewHistory(newH); } else setShowPreview(false); };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!activePage.imageUrl || !containerRef.current) return;
    const target = e.target as HTMLElement;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    if (target.dataset.handle) { e.stopPropagation(); saveHistory(); setMode('resizing'); setActiveHandle(target.dataset.handle); setInteractionStart({ startX: x, startY: y, initialArea: { ...activePage.areas.find((a:any) => a.id === selectedId) } }); return; }
    if (target.closest('.hot-area')) { e.stopPropagation(); const id = Number((target.closest('.hot-area') as HTMLElement).dataset.id); setSelectedId(id); saveHistory(); setMode('dragging'); setInteractionStart({ startX: x, startY: y, initialArea: { ...activePage.areas.find((a:any) => a.id === id) } }); return; }
    saveHistory(); setMode('drawing'); const newId = Date.now(); updateActivePage({ areas: [...activePage.areas, { id: newId, x, y, w: 0.1, h: 0.1, type: 'switch', value: '' }] }); setSelectedId(newId); setInteractionStart({ startX: x, startY: y, initialArea: null });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mode === 'idle' || !selectedId || !containerRef.current || !interactionStart) return;
    const rect = containerRef.current.getBoundingClientRect();
    const curX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const curY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    const deltaX = curX - interactionStart.startX; const deltaY = curY - interactionStart.startY;
    const updatedAreas = [...activePage.areas]; const idx = updatedAreas.findIndex((a:any) => a.id === selectedId);
    if (idx === -1) return; const n = { ...updatedAreas[idx] };
    if (mode === 'drawing') { n.w = Math.abs(curX - interactionStart.startX); n.h = Math.abs(curY - interactionStart.startY); n.x = curX < interactionStart.startX ? curX : interactionStart.startX; n.y = curY < interactionStart.startY ? curY : interactionStart.startY; }
    else if (mode === 'dragging') { n.x = Math.max(0, Math.min(100 - n.w, interactionStart.initialArea.x + deltaX)); n.y = Math.max(0, Math.min(100 - n.h, interactionStart.initialArea.y + deltaY)); }
    else if (mode === 'resizing' && activeHandle) {
      if (activeHandle.includes('e')) n.w = Math.max(1, Math.min(100 - interactionStart.initialArea.x, interactionStart.initialArea.w + deltaX));
      if (activeHandle.includes('s')) n.h = Math.max(1, Math.min(100 - interactionStart.initialArea.y, interactionStart.initialArea.h + deltaY));
      if (activeHandle.includes('w')) { const w = interactionStart.initialArea.w - deltaX; if (w > 1) { n.x = Math.max(0, interactionStart.initialArea.x + deltaX); n.w = w; } }
      if (activeHandle.includes('n')) { const h = interactionStart.initialArea.h - deltaY; if (h > 1) { n.y = Math.max(0, interactionStart.initialArea.y + deltaY); n.h = h; } }
    }
    updatedAreas[idx] = n; updateActivePage({ areas: updatedAreas });
  };

  const handleGlobalMouseUp = useCallback(() => { if (mode !== 'idle') { setMode('idle'); setActiveHandle(null); setInteractionStart(null); } }, [mode]);
  useEffect(() => { window.addEventListener('mouseup', handleGlobalMouseUp); return () => window.removeEventListener('mouseup', handleGlobalMouseUp); }, [handleGlobalMouseUp]);

  const handleImageUpload = (e: any) => {
    const file = e.target.files[0]; if (!file) return;
    saveHistory(); const reader = new FileReader();
    reader.onload = (event: any) => {
      const img = new Image(); img.onload = () => {
        const canvas = document.createElement("canvas"); canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext("2d"); if (ctx) { ctx.drawImage(img, 0, 0, img.width, img.height); updateActivePage({ imageUrl: canvas.toDataURL("image/jpeg", 0.7) }); }
      }; img.src = event.target.result;
    }; reader.readAsDataURL(file);
  };

  const hexToRgba = (hex: string, alpha: number) => `rgba(${parseInt(hex.slice(1,3),16)||0}, ${parseInt(hex.slice(3,5),16)||0}, ${parseInt(hex.slice(5,7),16)||0}, ${alpha})`;
  const currentBorder = hexToRgba(theme.borderColor, theme.borderOpacity);
  
  // 🚨 就是漏了這一行！現在它已經強勢回歸了！
  const activeArea = activePage?.areas?.find((a:any) => a.id === selectedId);

  return (
    <main className="h-screen flex flex-col overflow-hidden font-sans select-none relative transition-colors duration-300" style={{ backgroundColor: theme.bgMain, color: theme.textMain, fontSize: `${theme.fontSize}px` }} onMouseUp={() => setMode('idle')}>
      
      {/* 🚀 HEADER */}
      <header className="h-[76px] border-b flex justify-between items-center px-8 shrink-0 relative z-40 shadow-sm" style={{ backgroundColor: theme.bgHeader, borderColor: currentBorder }}>
        <div className="flex items-center gap-6">
          <Link href="/admin" className="p-2.5 rounded-full hover:bg-white/5 border transition-all" style={{ borderColor: currentBorder, color: theme.textDim }}><ChevronLeft size={20}/></Link>
          <div className="flex flex-col">
            <input value={activePage.name} onChange={(e) => updateActivePage({name: e.target.value})} className="bg-transparent border-none outline-none font-black" style={{ color: theme.textMain, fontSize: `${theme.fontSize * 1.5}px` }} />
            <span className="uppercase tracking-[0.2em] font-mono font-bold mt-1" style={{ color: theme.primary, fontSize: `${theme.fontSize * 0.75}px` }}>V16.6 SYSTEM DEPLOYED</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={undo} disabled={history.length === 0} className="px-5 py-2.5 rounded-xl border font-bold disabled:opacity-20 hover:opacity-80 flex items-center gap-2 transition-all" style={{ backgroundColor: theme.bgInput, borderColor: currentBorder, color: theme.textDim, borderRadius: `${theme.radius}px`, fontSize: `${theme.fontSize}px` }}><RotateCcw size={16}/> 撤銷</button>
          <button onClick={() => setShowPreview(true)} className="px-6 py-2.5 rounded-xl font-bold border hover:opacity-80 flex items-center gap-2 transition-all" style={{ backgroundColor: theme.bgInput, borderColor: theme.primary, color: theme.primary, borderRadius: `${theme.radius}px`, fontSize: `${theme.fontSize}px` }}><Eye size={16}/> 模擬器</button>
          <button onClick={async () => { setSaving(true); await updateDoc(doc(db, "users", uid!), { megaMenuConfig: { pages, theme } }); setSaving(false); alert("✅ 儲存成功"); }} className="px-8 py-2.5 rounded-xl font-black text-white shadow-lg active:scale-95 flex items-center gap-2 transition-all" style={{ backgroundColor: theme.primary, borderRadius: `${theme.radius}px`, fontSize: `${theme.fontSize}px` }}>{saving ? <RefreshCw className="animate-spin" size={16}/> : <Save size={16}/>} 儲存</button>
        </div>
      </header>

      {/* 🧩 工作區 */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        
        {/* 左側面板 */}
        <aside className="border-r flex flex-col shrink-0 relative z-30 shadow-xl" style={{ width: "320px", backgroundColor: theme.bgPanel, borderColor: currentBorder }}>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            <button onClick={() => setShowThemeModal(true)} className="w-full p-4 flex items-center justify-center gap-2 border hover:brightness-125 shadow-sm font-black transition-all" style={{ backgroundColor: `${theme.primary}15`, borderColor: theme.primary, color: theme.primary, borderRadius: `${theme.radius}px`, fontSize: `${theme.fontSize}px` }}><Palette size={16} /> 視覺主題設定</button>
            <div className="space-y-3">
              <h3 className="font-black uppercase tracking-widest flex items-center gap-2" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.8}px` }}><Layers size={14} style={{ color: theme.primary }}/> 分頁管理</h3>
              <div className="space-y-2">
                {pages.map((p, i) => (
                  <div key={p.id} onClick={() => { setActivePageIndex(i); setSelectedId(null); }} className="flex items-center justify-between p-3 border cursor-pointer transition-all font-bold" style={{ backgroundColor: activePageIndex === i ? theme.textMain : theme.bgInput, color: activePageIndex === i ? theme.bgMain : theme.textDim, borderColor: activePageIndex === i ? theme.textMain : currentBorder, borderRadius: `${theme.radius > 8 ? 8 : theme.radius}px`, fontSize: `${theme.fontSize * 0.9}px` }}>
                    <span className="truncate">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <section className="p-5 border transition-all" style={{ backgroundColor: theme.bgInput, borderRadius: `${theme.radius}px`, borderColor: currentBorder }}>
              <h3 className="font-black uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.8}px` }}><Type size={14} style={{ color: theme.primary }}/> 底部標籤</h3>
              <input value={activePage.chatBarText} onChange={(e) => updateActivePage({chatBarText: e.target.value})} className="w-full bg-black/10 border p-3 outline-none transition-all shadow-inner focus:ring-1" style={{ color: theme.textMain, borderColor: currentBorder, ringColor: theme.primary, borderRadius: `${theme.radius > 8 ? 8 : theme.radius}px`, fontSize: `${theme.fontSize * 0.9}px` }} />
            </section>
          </div>
        </aside>

        {/* 🎨 中央畫布 */}
        <section className="flex-1 flex flex-col relative overflow-hidden z-10" style={{ backgroundColor: theme.bgMain }}>
          <div className="flex-1 overflow-auto flex flex-col items-center justify-center p-12 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px]">
            {!activePage.imageUrl ? (
              <label className="flex flex-col items-center justify-center gap-6 cursor-pointer w-full max-w-[600px] aspect-[4/3] border-2 border-dashed hover:border-white/30 transition-all bg-black/20 shadow-2xl backdrop-blur-sm" style={{ borderColor: currentBorder, borderRadius: `${theme.radius * 2}px` }}>
                <ImageIcon style={{ color: theme.textDim }} size={48} className="opacity-50"/>
                <p className="font-bold tracking-widest" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 1.2}px` }}>上傳選單圖片</p>
                <input type="file" className="hidden" onChange={handleImageUpload} />
              </label>
            ) : (
              <div ref={containerRef} className="relative shadow-[0_30px_80px_rgba(0,0,0,0.6)] inline-block cursor-crosshair ring-1" style={{ ringColor: currentBorder, borderRadius: `${theme.radius > 16 ? 16 : theme.radius}px`, backgroundColor: theme.bgInput }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}>
                <img src={activePage.imageUrl} draggable={false} className="max-h-[75vh] max-w-[60vw] object-contain pointer-events-none opacity-95" style={{ borderRadius: `${theme.radius > 16 ? 16 : theme.radius}px` }} />
                {activePage.areas.map((area:any) => (
                  <div key={area.id} data-id={area.id} className={`hot-area absolute border-2 flex items-center justify-center ${selectedId === area.id ? 'z-30 cursor-move' : 'z-20 cursor-pointer transition-all'}`} style={{ left:`${area.x}%`, top:`${area.y}%`, width:`${area.w}%`, height:`${area.h}%`, borderColor: selectedId === area.id ? theme.primary : "rgba(255,255,255,0.4)", backgroundColor: selectedId === area.id ? `${theme.primary}30` : "rgba(0,0,0,0.1)", borderRadius: `4px` }}>
                    {selectedId === area.id && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); deleteArea(area.id); }} className="absolute -top-3 -right-3 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 z-50"><X size={12}/></button>
                        {['nw', 'ne', 'sw', 'se'].map(pos => <div key={pos} data-handle={pos} className="absolute w-3 h-3 bg-white border-2 shadow-sm rounded-full z-40" style={{ borderColor: theme.primary, top: pos.includes('n') ? -6 : 'auto', bottom: pos.includes('s') ? -6 : 'auto', left: pos.includes('w') ? -6 : 'auto', right: pos.includes('e') ? -6 : 'auto', cursor: `${pos}-resize` }} />)}
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 🔍 右側面板 */}
        <aside className="border-l flex flex-col overflow-hidden shrink-0 relative z-30 shadow-[-4px_0_24px_rgba(0,0,0,0.2)]" style={{ width: "340px", backgroundColor: theme.bgPanel, borderColor: currentBorder }}>
          <div className="p-6 border-b flex items-center gap-2" style={{ borderColor: currentBorder }}><Zap size={16} style={{ color: theme.primary }}/><h3 className="font-black uppercase tracking-widest" style={{ color: theme.textMain, fontSize: `${theme.fontSize}px` }}>屬性檢視器</h3></div>
          {activeArea ? (
            <div className="flex-1 flex flex-col">
              <div className="flex border-b" style={{ backgroundColor: theme.bgHeader, borderColor: currentBorder }}>
                <button onClick={() => setInspectorTab('action')} className="flex-1 py-3 font-bold relative" style={{ color: inspectorTab === 'action' ? theme.primary : theme.textDim, fontSize: `${theme.fontSize * 0.9}px` }}>⚡ 觸發動作{inspectorTab === 'action' && <div className="absolute bottom-0 left-0 w-full h-[2px]" style={{ backgroundColor: theme.primary }}></div>}</button>
                <button onClick={() => setInspectorTab('layout')} className="flex-1 py-3 font-bold relative border-l" style={{ color: inspectorTab === 'layout' ? theme.primary : theme.textDim, borderColor: currentBorder, fontSize: `${theme.fontSize * 0.9}px` }}>📐 座標佈局{inspectorTab === 'layout' && <div className="absolute bottom-0 left-0 w-full h-[2px]" style={{ backgroundColor: theme.primary }}></div>}</button>
              </div>
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-black/5">
                {inspectorTab === 'action' ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                      {[ { id: 'switch', label: '跳轉分頁', icon: ArrowRightLeft }, { id: 'card', label: '數位名片', icon: Smartphone }, { id: 'uri', label: '外部網址', icon: LinkIcon }, { id: 'message', label: '自動回覆', icon: FileText } ].map(btn => (
                        <button key={btn.id} onClick={() => updateArea(activeArea.id, 'type', btn.id)} className="flex flex-col items-center justify-center gap-2 p-3 border font-bold transition-all hover:opacity-80" style={{ backgroundColor: activeArea.type === btn.id ? theme.primary : 'transparent', borderColor: activeArea.type === btn.id ? theme.primary : currentBorder, color: activeArea.type === btn.id ? '#fff' : theme.textDim, borderRadius: `${theme.radius > 12 ? 12 : theme.radius}px`, fontSize: `${theme.fontSize * 0.9}px` }}><btn.icon size={18} className={activeArea.type === btn.id ? 'opacity-100' : 'opacity-60'}/> {btn.label}</button>
                      ))}
                    </div>
                    <select value={activeArea.value} onChange={(e) => updateArea(activeArea.id, 'value', e.target.value)} className="w-full bg-black/10 border p-4 outline-none focus:ring-1" style={{ color: theme.textMain, borderColor: currentBorder, ringColor: theme.primary, borderRadius: `${theme.radius > 12 ? 12 : theme.radius}px`, fontSize: `${theme.fontSize}px` }}>
                      <option value="" disabled style={{ color: theme.textDim }}>選擇目標...</option>
                      {activeArea.type === 'switch' && pages.map((p, i) => i !== activePageIndex && <option key={p.id} value={i}>➡️ {p.name}</option>)}
                      {activeArea.type === 'card' && allUsers.map(u => <option key={u.id} value={u.id}>👤 {u.displayName}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {['x','y','w','h'].map(k => (
                      <div key={k} className="flex flex-col gap-1 relative bg-black/10 p-2 rounded-lg border" style={{ borderColor: currentBorder }}><span className="font-mono uppercase font-black pl-1" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.75}px` }}>{k} 軸 (%)</span><input type="number" step="0.5" value={activeArea[k as keyof typeof activeArea].toFixed(1)} onChange={(e) => updateArea(activeArea.id, k, parseFloat(e.target.value))} className="w-full bg-transparent outline-none font-mono text-lg font-bold" style={{ color: theme.textMain }} /></div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : <div className="flex-1 flex flex-col items-center justify-center opacity-50 p-6 bg-black/5"><Crosshair size={48} className="mb-4" style={{ color: theme.textDim }}/><div className="text-center font-black uppercase tracking-[0.2em] leading-loose" style={{ color: theme.textDim, fontSize: `${theme.fontSize * 0.9}px` }}>點擊熱區編輯</div></div>}
        </aside>
      </div>

      {/* 🎨 主題設定視窗 */}
      {showThemeModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-auto" style={{ zIndex: 99999 }}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in" onClick={() => setShowThemeModal(false)}></div>
          <div className="relative w-[860px] h-[600px] bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_40px_100px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="h-[60px] px-6 border-b border-white/10 flex justify-between items-center shrink-0 bg-[#111111]">
              <div className="flex items-center gap-3"><div className="p-1.5 rounded-lg bg-white/5"><Palette size={18} className="text-white"/></div><h2 className="text-base font-black text-white">主題風格</h2></div>
              <button onClick={() => setShowThemeModal(false)} className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"><X size={18}/></button>
            </div>
            <div className="flex-1 flex overflow-hidden">
              <div className="w-[320px] shrink-0 border-r border-white/10 flex flex-col bg-[#111111]">
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
                  <section><div className="text-[10px] font-black uppercase text-gray-500 mb-3 tracking-widest">快速風格套用</div>
                    <div className="grid grid-cols-2 gap-2">{Object.entries(THEME_PRESETS).map(([name, p]) => (
                      <button key={name} onClick={() => setTheme(p)} className="flex items-center gap-2 p-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-[10px] font-bold text-gray-300"><div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: p.primary }}></div>{name}</button>
                    ))}</div>
                  </section>
                  <section className="space-y-2"><div className="text-[10px] font-black uppercase text-gray-500 mb-3 tracking-widest">核心色彩定義</div>
                    {[ { l: "品牌色", k: "primary" }, { l: "主要背景", k: "bgMain" }, { l: "面板底色", k: "bgPanel" }, { l: "主要文字", k: "textMain" } ].map(item => (
                      <div key={item.k} className="flex justify-between items-center p-2.5 rounded-lg border border-white/10 bg-black/40"><span className="font-bold text-gray-300 text-xs px-1">{item.l}</span><input type="color" value={(theme as any)[item.k]} onChange={(e) => setTheme({...theme, [item.k]: e.target.value})} className="w-6 h-6 rounded border-0 bg-transparent cursor-pointer"/></div>
                    ))}
                  </section>
                </div>
              </div>
              <div className="flex-1 bg-[#050505] flex flex-col items-center justify-center p-8 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:20px_20px]">
                 <div className="w-[360px] shrink-0 border shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden" style={{ backgroundColor: theme.bgPanel, borderColor: currentBorder, borderRadius: `${theme.radius * 1.5}px` }}>
                    <div className="h-12 border-b flex items-center px-5" style={{ backgroundColor: theme.bgHeader, borderColor: currentBorder }}><div className="w-3 h-3 rounded-full" style={{ backgroundColor: theme.primary }}></div></div>
                    <div className="p-6 space-y-5 text-center flex-1 flex flex-col justify-center">
                       <button className="w-full py-4 font-black text-xs" style={{ backgroundColor: theme.primary, color: "#fff", borderRadius: `${theme.radius}px` }}>DEMO BUTTON</button>
                    </div>
                 </div>
              </div>
            </div>
            <div className="h-[60px] px-8 border-t border-white/10 flex justify-end items-center shrink-0 bg-[#111111]">
               <button onClick={() => setShowThemeModal(false)} className="px-8 py-2 font-black text-black bg-white rounded-lg shadow-lg hover:brightness-110 active:scale-95 text-xs">套用變更</button>
            </div>
          </div>
        </div>
      )}

      {/* 📱 模擬器 */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-10 pointer-events-auto" style={{ zIndex: 100000 }}>
          <div className="relative w-[380px] h-[780px] bg-neutral-800 rounded-[4rem] border-[14px] border-black shadow-[0_0_120px_rgba(0,0,0,1)] overflow-hidden flex flex-col ring-2 ring-white/10">
            <button onClick={() => setShowPreview(false)} className="absolute -right-24 top-0 text-white/30 hover:text-white transition group flex flex-col items-center gap-2 cursor-pointer"><X size={32}/></button>
            <div className="bg-neutral-900 text-white p-6 flex items-center gap-3 shrink-0 border-b border-black/30 shadow-lg relative">
              <button onClick={handleSimulatorBack} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition flex items-center text-blue-400 cursor-pointer"><ChevronLeft size={24}/></button>
              <div className="font-black text-base tracking-tight flex-1 text-center pr-12">{pages[previewPageIndex].name}</div>
            </div>
            <div className="flex-1 p-8 flex flex-col justify-end gap-6 bg-[#7286a5]/30">
              <div className="flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-500"><div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/10 shadow-lg"><MessageCircle size={20} className="text-white/40"/></div><div className="bg-white text-[#1a1a1a] text-sm p-5 rounded-[24px] rounded-tl-none shadow-2xl leading-relaxed font-medium">歡迎來到預覽模式！點擊熱區即可測試動作。</div></div>
            </div>
            <div className="bg-white shrink-0 relative shadow-[0_-10px_40px_rgba(0,0,0,0.2)]">
              {pages[previewPageIndex].imageUrl && (
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: '2500/1686' }}>
                  <img src={pages[previewPageIndex].imageUrl!} className="w-full h-full object-cover" alt="Preview"/>
                  {pages[previewPageIndex].areas.map((area:any) => (
                    <div key={area.id} className="absolute hover:bg-black/10 transition-colors cursor-pointer group flex items-center justify-center border border-dashed border-transparent hover:border-black/30" style={{left:`${area.x}%`, top:`${area.y}%`, width:`${area.w}%`, height:`${area.h}%` }} onClick={() => { if (area.type === 'switch' && area.value !== "") handleSimulatorJump(parseInt(area.value)); else alert(`⚡ 觸發動作\n類型：${area.type.toUpperCase()}\n目標：${area.value || '未設定'}`); }}>
                      <span className="opacity-0 group-hover:opacity-100 bg-black/90 text-white text-[10px] font-black px-2.5 py-1 rounded shadow-lg transition-opacity scale-95 group-hover:scale-100">{area.type === 'switch' ? 'JUMP' : area.type.toUpperCase()}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="h-16 flex items-center justify-center border-t border-gray-100 text-xs font-black text-gray-900 tracking-widest bg-gray-50 uppercase shadow-inner">{pages[previewPageIndex].chatBarText}</div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ==========================================
// 🛡️ Vercel Suspense 防護罩 (最終安全匯出)
// ==========================================
export default function AdminEditorPage() {
  return (
    <Suspense fallback={
      <div className="h-screen w-screen bg-[#050505] flex items-center justify-center text-white font-black tracking-widest animate-pulse">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-white/10 border-t-blue-500 rounded-full animate-spin"></div>
          LOADING WORKSPACE...
        </div>
      </div>
    }>
      <EditorContent />
    </Suspense>
  );
}