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
// 💡 核心編輯器組件 (被 Suspense 包裹)
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
  const activePage = pages[activePageIndex];

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
      } catch (e) { console.error(e); }
    };
    init();
  }, [uid]);

  const saveHistory = useCallback(() => setHistory(prev => [...prev.slice(-19), JSON.parse(JSON.stringify(pages))]), [pages]);
  const undo = () => { if (history.length > 0) { setPages(history[history.length - 1]); setHistory(prev => prev.slice(0, -1)); setSelectedId(null); } };
  const updateActivePage = (data: Partial<MenuPage>) => { const n = [...pages]; n[activePageIndex] = { ...n[activePageIndex], ...data }; setPages(n); };
  const updateArea = (id: number, field: string, value: any) => { saveHistory(); updateActivePage({ areas: activePage.areas.map(a => a.id === id ? { ...a, [field]: value } : a) }); };
  const deleteArea = (id: number) => { saveHistory(); updateActivePage({ areas: activePage.areas.filter(a => a.id !== id) }); setSelectedId(null); };

  const handleSimulatorJump = (targetIndex: number) => { setPreviewHistory(prev => [...prev, previewPageIndex]); setPreviewPageIndex(targetIndex); };
  const handleSimulatorBack = () => { if (previewHistory.length > 0) { const newH = [...previewHistory]; setPreviewPageIndex(newH.pop()!); setPreviewHistory(newH); } else setShowPreview(false); };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!activePage.imageUrl || !containerRef.current) return;
    const target = e.target as HTMLElement;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    if (target.dataset.handle) { e.stopPropagation(); saveHistory(); setMode('resizing'); setActiveHandle(target.dataset.handle); setInteractionStart({ startX: x, startY: y, initialArea: { ...activePage.areas.find(a => a.id === selectedId) } }); return; }
    if (target.closest('.hot-area')) { e.stopPropagation(); setSelectedId(Number((target.closest('.hot-area') as HTMLElement).dataset.id)); saveHistory(); setMode('dragging'); setInteractionStart({ startX: x, startY: y, initialArea: { ...activePage.areas.find(a => a.id === Number((target.closest('.hot-area') as HTMLElement).dataset.id)) } }); return; }
    saveHistory(); setMode('drawing'); const newId = Date.now(); updateActivePage({ areas: [...activePage.areas, { id: newId, x, y, w: 0.1, h: 0.1, type: 'switch', value: '' }] }); setSelectedId(newId); setInteractionStart({ startX: x, startY: y, initialArea: null });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (mode === 'idle' || !selectedId || !containerRef.current || !interactionStart) return;
    const rect = containerRef.current.getBoundingClientRect();
    const curX = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const curY = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    const deltaX = curX - interactionStart.startX; const deltaY = curY - interactionStart.startY;
    const updatedAreas = [...activePage.areas]; const idx = updatedAreas.findIndex(a => a.id === selectedId);
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

  return (
    <main className="h-screen flex flex-col overflow-hidden font-sans select-none transition-colors duration-300 relative" style={{ backgroundColor: theme.bgMain, color: theme.textMain, fontSize: `${theme.fontSize}px` }} onMouseUp={() => setMode('idle')}>
      
      {/* HEADER */}
      <header className="h-[70px] border-b flex justify-between items-center px-6 shrink-0 relative z-40 shadow-sm" style={{ backgroundColor: theme.bgHeader, borderColor: currentBorder }}>
        <div className="flex items-center gap-4">
          <Link href="/admin" className="p-2 rounded-full hover:bg-white/5 transition-all border" style={{ borderColor: currentBorder, color: theme.textDim }}><ChevronLeft size={18}/></Link>
          <div className="flex flex-col">
            <input value={activePage.name} onChange={(e) => updateActivePage({name: e.target.value})} className="bg-transparent border-none outline-none font-black rounded transition-all focus:bg-white/5" style={{ color: theme.textMain, fontSize: `${theme.fontSize * 1.2}px` }} />
            <span className="uppercase tracking-[0.2em] font-mono font-bold text-[9px]" style={{ color: theme.primary }}>V16.3 SYSTEM DEPLOYED</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={undo} disabled={history.length === 0} className="px-4 py-2 rounded-lg border font-bold disabled:opacity-20 hover:opacity-80 flex items-center gap-1.5 text-xs transition-all" style={{ backgroundColor: theme.bgInput, borderColor: currentBorder, color: theme.textDim }}><RotateCcw size={14}/> 撤銷</button>
          <button onClick={() => setShowPreview(true)} className="px-5 py-2 rounded-lg font-bold border hover:opacity-80 flex items-center gap-1.5 text-xs transition-all" style={{ backgroundColor: theme.bgInput, borderColor: theme.primary, color: theme.primary }}><Eye size={14}/> 模擬器</button>
          <button onClick={async () => { setSaving(true); await updateDoc(doc(db, "users", uid!), { megaMenuConfig: { pages, theme } }); setSaving(false); alert("✅ 儲存成功"); }} className="px-6 py-2 rounded-lg font-black text-white shadow-lg active:scale-95 flex items-center gap-1.5 text-xs transition-all" style={{ backgroundColor: theme.primary }}>{saving ? <RefreshCw className="animate-spin" size={14}/> : <Save size={14}/>} 儲存</button>
        </div>
      </header>

      {/* 工作區 */}
      <div className="flex-1 flex overflow-hidden relative z-10">
        <aside className="border-r flex flex-col shrink-0 relative z-30 shadow-xl" style={{ width: "280px", backgroundColor: theme.bgPanel, borderColor: currentBorder }}>
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            <button onClick={() => setShowThemeModal(true)} className="w-full p-4 flex items-center justify-center gap-2 border hover:brightness-125 shadow-sm font-black cursor-pointer rounded-xl text-xs transition-all" style={{ backgroundColor: `${theme.primary}15`, borderColor: theme.primary, color: theme.primary }}><Palette size={16} /> 視覺主題設定</button>
            <div className="space-y-3">
              <h3 className="font-black uppercase tracking-widest text-[10px] opacity-40 flex items-center gap-2"><Layers size={14}/> 分頁管理</h3>
              <div className="space-y-2">
                {pages.map((p, i) => (
                  <div key={p.id} onClick={() => { setActivePageIndex(i); setSelectedId(null); }} className="flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all" style={{ backgroundColor: activePageIndex === i ? theme.textMain : theme.bgInput, color: activePageIndex === i ? theme.bgMain : theme.textDim, borderColor: activePageIndex === i ? theme.textMain : currentBorder }}>
                    <span className="font-bold text-xs truncate">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
            <section className="p-4 border rounded-xl" style={{ backgroundColor: theme.bgInput, borderColor: currentBorder }}>
              <h3 className="font-black uppercase tracking-widest mb-3 flex items-center gap-2 text-[10px] opacity-40"><Type size={14}/> 底部標籤</h3>
              <input value={activePage.chatBarText} onChange={(e) => updateActivePage({chatBarText: e.target.value})} className="w-full bg-black/10 border p-2.5 outline-none rounded-lg text-xs" style={{ color: theme.textMain, borderColor: currentBorder }} />
            </section>
          </div>
        </aside>

        {/* 畫布 */}
        <section className="flex-1 flex flex-col relative overflow-hidden z-10" style={{ backgroundColor: theme.bgMain }}>
          <div className="flex-1 overflow-auto flex flex-col items-center justify-center p-10 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px]">
            {!activePage.imageUrl ? (
              <label className="flex flex-col items-center justify-center gap-4 cursor-pointer w-full max-w-[500px] aspect-[4/3] border-2 border-dashed border-white/10 hover:border-white/30 transition-all bg-black/20 shadow-2xl rounded-[24px]"><ImageIcon size={40} className="opacity-20"/><p className="font-bold opacity-40">上傳選單圖片</p><input type="file" className="hidden" onChange={handleImageUpload} /></label>
            ) : (
              <div ref={containerRef} className="relative shadow-2xl inline-block cursor-crosshair ring-1" style={{ ringColor: currentBorder, borderRadius: `${theme.radius}px`, backgroundColor: theme.bgInput }} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}>
                <img src={activePage.imageUrl} draggable={false} className="max-h-[75vh] max-w-[60vw] pointer-events-none opacity-95" style={{ borderRadius: `${theme.radius}px` }} />
                {activePage.areas.map(area => (
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

        {/* 右側面板 */}
        <aside className="border-l flex flex-col overflow-hidden shrink-0 relative z-30 shadow-xl" style={{ width: "300px", backgroundColor: theme.bgPanel, borderColor: currentBorder }}>
          <div className="p-5 border-b flex items-center gap-2" style={{ borderColor: currentBorder }}><Zap size={14} style={{ color: theme.primary }}/><h3 className="font-black uppercase tracking-widest text-xs">屬性面板</h3></div>
          {activeArea ? (
            <div className="flex-1 flex flex-col">
              <div className="flex border-b" style={{ backgroundColor: theme.bgHeader, borderColor: currentBorder }}>
                <button onClick={() => setInspectorTab('action')} className={`flex-1 py-3 font-bold text-[10px] tracking-widest uppercase ${inspectorTab === 'action' ? 'text-white border-b-2' : 'opacity-40'}`} style={{ borderBottomColor: inspectorTab === 'action' ? theme.primary : 'transparent' }}>⚡ 動作</button>
                <button onClick={() => setInspectorTab('layout')} className={`flex-1 py-3 font-bold text-[10px] tracking-widest uppercase ${inspectorTab === 'layout' ? 'text-white border-b-2' : 'opacity-40'}`} style={{ borderBottomColor: inspectorTab === 'layout' ? theme.primary : 'transparent' }}>📐 佈局</button>
              </div>
              <div className="p-5 overflow-y-auto custom-scrollbar flex-1 bg-black/10">
                {inspectorTab === 'action' ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-2">
                      {[ { id: 'switch', label: '跳轉', icon: ArrowRightLeft }, { id: 'card', label: '名片', icon: Smartphone }, { id: 'uri', label: '網址', icon: LinkIcon }, { id: 'message', label: '回覆', icon: FileText } ].map(btn => (
                        <button key={btn.id} onClick={() => updateArea(activeArea.id, 'type', btn.id)} className="flex flex-col items-center gap-1.5 p-2.5 border rounded-xl font-bold transition-all" style={{ backgroundColor: activeArea.type === btn.id ? theme.primary : 'transparent', borderColor: activeArea.type === btn.id ? theme.primary : currentBorder, color: activeArea.type === btn.id ? '#fff' : theme.textDim }}>
                          <btn.icon size={16}/> <span className="text-[10px]">{btn.label}</span>
                        </button>
                      ))}
                    </div>
                    <select value={activeArea.value} onChange={(e) => updateArea(activeArea.id, 'value', e.target.value)} className="w-full bg-black/30 border p-3 rounded-xl text-white text-xs outline-none" style={{ borderColor: currentBorder }}>
                      <option value="">設定目標內容...</option>
                      {activeArea.type === 'switch' && pages.map((p, i) => i !== activePageIndex && <option key={p.id} value={i}>➡️ {p.name}</option>)}
                      {activeArea.type === 'card' && allUsers.map(u => <option key={u.id} value={u.id}>👤 {u.displayName}</option>)}
                    </select>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {['x','y','w','h'].map(k => (
                      <div key={k} className="p-3 border rounded-xl bg-black/30" style={{ borderColor: currentBorder }}>
                        <span className="text-[9px] font-black uppercase opacity-40">{k} %</span>
                        <input type="number" step="0.5" value={activeArea[k as keyof typeof activeArea].toFixed(1)} onChange={(e) => updateArea(activeArea.id, k, parseFloat(e.target.value))} className="w-full bg-transparent text-white font-mono font-bold mt-1 text-sm outline-none" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : <div className="flex-1 flex flex-col items-center justify-center opacity-30 text-center px-10"><Crosshair size={36} className="mb-4"/><p className="text-[10px] font-black uppercase tracking-[0.2em]">點擊熱區進行配置</p></div>}
        </aside>
      </div>

      {/* --- THEME MODAL --- */}
      {showThemeModal && (
        <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-auto" style={{ zIndex: 99999 }}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setShowThemeModal(false)}></div>
          <div className="relative z-10 w-[860px] h-[600px] bg-[#0a0a0a] border border-white/10 rounded-2xl shadow-[0_30px_100px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden animate-in zoom-in-95">
            <div className="h-[60px] px-6 border-b border-white/10 flex justify-between items-center bg-[#111111] shrink-0">
              <div className="flex items-center gap-3"><Palette size={18} className="text-white"/><h2 className="text-base font-black text-white uppercase tracking-widest">視覺主題配置</h2></div>
              <button onClick={() => setShowThemeModal(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-all text-gray-400 hover:text-white"><X size={18}/></button>
            </div>
            <div className="flex-1 flex overflow-hidden">
              <div className="w-[300px] border-r border-white/10 flex flex-col bg-[#111111]">
                <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
                   <section><div className="text-[10px] font-black uppercase text-gray-500 mb-3 tracking-widest">快速預設</div>
                    <div className="grid grid-cols-2 gap-2">{Object.entries(THEME_PRESETS).map(([name, p]) => (
                      <button key={name} onClick={() => setTheme(p)} className="flex items-center gap-2 p-2.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-[10px] font-bold text-gray-300">
                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.primary }}></div>{name}
                      </button>
                    ))}</div>
                   </section>
                   <section className="space-y-3"><div className="text-[10px] font-black uppercase text-gray-500 mb-3 tracking-widest">色彩控制</div>
                    {[ { l: "品牌色", k: "primary" }, { l: "背景", k: "bgMain" }, { l: "面板", k: "bgPanel" }, { l: "文字", k: "textMain" } ].map(item => (
                      <div key={item.k} className="flex justify-between items-center p-2.5 rounded-lg border border-white/10 bg-black/40">
                        <span className="text-[10px] font-bold text-gray-400">{item.l}</span><input type="color" value={(theme as any)[item.k]} onChange={(e) => setTheme({...theme, [item.k]: e.target.value})} className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent shrink-0"/>
                      </div>
                    ))}
                   </section>
                </div>
              </div>
              <div className="flex-1 bg-[#050505] flex flex-col items-center justify-center p-8 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:20px_20px]">
                 <div className="w-[280px] shrink-0 border shadow-2xl overflow-hidden flex flex-col bg-opacity-95" style={{ backgroundColor: theme.bgPanel, borderColor: currentBorder, borderRadius: `${theme.radius}px` }}>
                    <div className="h-10 border-b flex items-center justify-between px-4" style={{ backgroundColor: theme.bgHeader, borderColor: currentBorder }}><div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: theme.primary }}></div><div className="w-16 h-1.5 rounded-full bg-white/10"></div></div><Monitor size={12} className="text-gray-500"/></div>
                    <div className="p-6 space-y-4 text-center">
                       <div className="space-y-2"><div className="h-1.5 w-full rounded-full bg-white/5"></div><div className="h-1.5 w-3/4 rounded-full bg-white/5 mx-auto"></div></div>
                       <button className="w-full py-2.5 font-black text-[10px] text-white shadow-lg" style={{ backgroundColor: theme.primary, borderRadius: `${theme.radius > 8 ? 8 : theme.radius}px` }}>PREVIEW BUTTON</button>
                    </div>
                 </div>
              </div>
            </div>
            <div className="h-[60px] px-6 border-t border-white/10 flex justify-between items-center bg-[#111111] shrink-0">
               <button onClick={() => setTheme(THEME_PRESETS["SaaS Pro"])} className="text-[10px] font-bold text-gray-500 underline underline-offset-4">恢復預設</button>
               <div className="flex gap-3"><button onClick={() => setShowThemeModal(false)} className="px-5 py-2 font-bold text-gray-400 hover:text-white transition-all text-xs">取消</button><button onClick={() => setShowThemeModal(false)} className="px-6 py-2 font-black text-black bg-white rounded-lg shadow-lg active:scale-95 transition-all text-xs">套用變更</button></div>
            </div>
          </div>
        </div>
      )}

      {/* --- SIMULATOR --- */}
      {showPreview && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-2xl flex items-center justify-center p-10 pointer-events-auto" style={{ zIndex: 100000 }}>
          <div className="relative w-[340px] h-[700px] bg-neutral-800 rounded-[3.5rem] border-[10px] border-black shadow-2xl overflow-hidden flex flex-col ring-2 ring-white/10">
            <button onClick={() => setShowPreview(false)} className="absolute -right-24 top-0 text-white/30 hover:text-white transition group flex flex-col items-center gap-2"><X size={32}/></button>
            <div className="bg-neutral-900 text-white p-5 flex items-center gap-3 shrink-0 border-b border-black/30 shadow-lg relative">
              <button onClick={handleSimulatorBack} className="p-2 -ml-2 hover:bg-white/10 rounded-full transition flex items-center text-blue-400"><ChevronLeft size={20}/></button>
              <div className="font-black text-sm tracking-tight flex-1 text-center pr-10 truncate">{pages[previewPageIndex].name}</div>
            </div>
            <div className="flex-1 p-6 flex flex-col justify-end gap-6 bg-gradient-to-b from-neutral-800 to-neutral-900">
              <div className="flex items-start gap-3 animate-in slide-in-from-bottom-4 duration-500"><div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shrink-0 border border-white/20 shadow-lg text-white"><MessageCircle size={16}/></div><div className="bg-white text-black text-[11px] p-3 rounded-2xl rounded-tl-none shadow-2xl leading-relaxed font-medium">預覽已啟動。</div></div>
            </div>
            <div className="bg-white shrink-0 relative">
              {pages[previewPageIndex].imageUrl && (
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: '2500/1686' }}>
                  <img src={pages[previewPageIndex].imageUrl!} className="w-full h-full object-cover" alt="Sim"/>
                  {pages[previewPageIndex].areas.map(area => (
                    <div key={area.id} className="absolute hover:bg-black/10 transition-colors cursor-pointer group flex items-center justify-center border border-dashed border-transparent hover:border-black/20" style={{left:`${area.x}%`, top:`${area.y}%`, width:`${area.w}%`, height:`${area.h}%` }} onClick={() => { if (area.type === 'switch' && area.value !== "") handleSimulatorJump(parseInt(area.value)); else alert(`⚡ 動作: ${area.type.toUpperCase()}`); }}></div>
                  ))}
                </div>
              )}
              <div className="h-12 flex items-center justify-center border-t border-gray-100 text-[10px] font-black text-gray-900 tracking-widest bg-gray-50 uppercase shadow-inner truncate px-4">{pages[previewPageIndex].chatBarText}</div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

// ==========================================
// 🛡️ Vercel Suspense 防護罩 (最終匯出)
// ==========================================
export default function AdminEditorPage() {
  return (
    <Suspense fallback={<div className="h-screen w-screen bg-[#050505] flex items-center justify-center text-white font-black tracking-widest animate-pulse">系統載入中...</div>}>
      <EditorContent />
    </Suspense>
  );
}