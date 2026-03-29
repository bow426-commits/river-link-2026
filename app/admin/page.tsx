"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { LayoutDashboard, Users, Palette, Activity, ChevronRight } from "lucide-react";
import Link from "next/link";

export default function AdminDashboard() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "users"));
        const userData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setUsers(userData);
      } catch (error) { 
        console.error("獲取用戶資料失敗:", error); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchData();
  }, []);

  const totalLinks = users.reduce((acc, user) => acc + (user.links?.length || 0), 0);

  // 載入中的酷炫動畫
  if (loading) return (
    <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center text-white gap-6">
      <div className="w-16 h-16 border-4 border-white/10 border-t-white rounded-full animate-spin"></div>
      <span className="font-black tracking-[0.5em] text-xs opacity-50 animate-pulse">COMMAND CENTER INITIALIZING</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-12 font-sans selection:bg-white selection:text-black">
      <div className="max-w-5xl mx-auto mb-16">
        <div className="flex justify-between items-end mb-10">
          <h1 className="text-3xl font-black flex items-center gap-4">
            <div className="p-3 bg-red-500/20 rounded-2xl text-red-500 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
              <LayoutDashboard size={32} strokeWidth={2.5} />
            </div>
            River 營運總署
          </h1>
        </div>

        {/* 📊 數據統計區塊 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-[#0f0f11] border border-white/10 p-10 rounded-[40px] shadow-2xl relative overflow-hidden group">
            <div className="absolute -top-4 -right-4 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700 text-white"><Users size={120}/></div>
            <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-[10px] mb-4">全站啟動用戶 / Users</p>
            <h2 className="text-7xl font-black tracking-tighter">{users.length}</h2>
          </div>
          <div className="bg-[#0f0f11] border border-white/10 p-10 rounded-[40px] shadow-2xl relative overflow-hidden group">
             <div className="absolute -top-4 -right-4 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700 text-blue-500"><Activity size={120}/></div>
            <p className="text-gray-500 font-bold uppercase tracking-[0.3em] text-[10px] mb-4">系統累積連結 / Links</p>
            <h2 className="text-7xl font-black tracking-tighter text-blue-500">{totalLinks}</h2>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-10">
           <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
           <h3 className="font-black uppercase tracking-[0.3em] text-xs text-gray-500">用戶監控與視覺管理中心</h3>
        </div>

        {/* 👥 用戶列表與操作區塊 */}
        <div className="space-y-6">
          {users.map((user) => (
            <div key={user.id} className="bg-[#0f0f11] border border-white/5 p-8 rounded-[32px] flex flex-col md:flex-row items-center justify-between hover:bg-[#151518] transition-all group border-l-8 border-l-transparent hover:border-l-blue-500 shadow-xl">
              
              <div className="flex items-center gap-8 mb-6 md:mb-0 w-full md:w-auto">
                <div className="w-20 h-20 bg-gradient-to-br from-neutral-800 to-black rounded-3xl flex items-center justify-center font-black text-3xl border border-white/10 text-white shadow-2xl group-hover:scale-105 transition-transform duration-500">
                  {user.displayName?.[0] || "R"}
                </div>
                <div>
                  <h4 className="font-black text-2xl text-gray-100 group-hover:text-white transition-colors">{user.displayName || "River"}</h4>
                  <p className="text-[11px] font-mono text-gray-600 tracking-wider mt-2 bg-black/40 px-3 py-1 rounded-full border border-white/5 inline-block">{user.id}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 w-full md:w-auto">
                {/* 🚀 這是通往編輯器的絕對入口按鈕 */}
                <Link 
                  href={`/admin/editor?uid=${user.id}`}
                  className="flex-1 md:flex-none flex items-center justify-center gap-3 px-8 py-4 bg-white text-black rounded-2xl font-black text-base hover:bg-blue-500 hover:text-white transition-all shadow-[0_15px_30px_rgba(255,255,255,0.1)] active:scale-95 group/btn"
                >
                  <Palette size={20} />
                  視覺編輯器
                  <ChevronRight size={18} className="group-hover/btn:translate-x-1 transition-transform" />
                </Link>
                
                <button className="px-8 py-4 bg-red-500/10 text-red-500 border border-red-500/20 rounded-2xl font-bold text-sm hover:bg-red-500 hover:text-white transition-all active:scale-95">
                  暫時停權
                </button>
              </div>

            </div>
          ))}
        </div>
      </div>
    </div>
  );
}