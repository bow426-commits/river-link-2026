"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import { LayoutDashboard, Users, Palette } from "lucide-react";
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
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalLinks = users.reduce((acc, user) => acc + (user.links?.length || 0), 0);

  if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white font-black animate-pulse">LOADING DASHBOARD...</div>;

  return (
    <div className="min-h-screen bg-black text-white p-8 font-sans">
      <div className="max-w-5xl mx-auto mb-12">
        <h1 className="text-2xl font-black flex items-center gap-3 mb-8">
          <div className="p-2 bg-red-500/10 rounded-lg text-red-500">
            <LayoutDashboard size={24} />
          </div>
          後台管理系統
        </h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[#111] border border-white/5 p-8 rounded-[32px] shadow-2xl">
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">全站用戶</p>
            <h2 className="text-5xl font-black">{users.length}</h2>
          </div>
          <div className="bg-[#111] border border-white/5 p-8 rounded-[32px] shadow-2xl">
            <p className="text-gray-500 font-bold uppercase tracking-widest text-xs mb-2">累積連結</p>
            <h2 className="text-5xl font-black text-blue-500">{totalLinks}</h2>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-6 text-gray-400">
           <Users size={18} />
           <h3 className="font-black uppercase tracking-widest text-sm">用戶監控名單</h3>
        </div>

        <div className="space-y-4">
          {users.map((user) => (
            <div key={user.id} className="bg-[#111] border border-white/5 p-6 rounded-[24px] flex items-center justify-between hover:bg-[#151515] transition-all group">
              <div className="flex items-center gap-5">
                <div className="w-14 h-14 bg-neutral-800 rounded-full flex items-center justify-center font-black text-xl border border-white/10 text-gray-300 group-hover:border-white/30">
                  {user.displayName?.[0] || "R"}
                </div>
                <div>
                  <h4 className="font-black text-lg">{user.displayName || "River"}</h4>
                  <p className="text-xs font-mono text-gray-600 tracking-tighter mt-1">{user.id}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* 🎨 這裡就是通往編輯器的按鈕！ */}
                <Link 
                  href={`/admin/editor?uid=${user.id}`}
                  className="flex items-center gap-2 px-5 py-2.5 bg-white text-black rounded-xl font-black text-sm hover:scale-105 active:scale-95 transition-all shadow-xl"
                >
                  <Palette size={16} />
                  視覺編輯器
                </Link>
                
                <button className="px-5 py-2.5 bg-red-600/10 text-red-500 border border-red-500/20 rounded-xl font-bold text-sm hover:bg-red-600 hover:text-white transition-all">
                  停權
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}