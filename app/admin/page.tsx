"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, doc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
          setIsAdmin(true);
          fetchData();
        } else { router.push("/"); }
      } else { router.push("/"); }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const fetchData = async () => {
    const querySnapshot = await getDocs(collection(db, "users"));
    setAllUsers(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
  };

  const toggleBan = async (uid: string, currentStatus: string) => {
    const newStatus = currentStatus === "banned" ? "active" : "banned";
    if (confirm(`確定要將此用戶設為 ${newStatus} 嗎？`)) {
      await updateDoc(doc(db, "users", uid), { status: newStatus });
      fetchData(); // 重新整理資料
    }
  };

  if (loading) return <div className="min-h-screen bg-black text-white flex items-center justify-center">🛡️ 安全載入中...</div>;
  if (!isAdmin) return null;

  // 計算統計數據
  const totalLinks = allUsers.reduce((acc, curr) => acc + (curr.links?.length || 0), 0);

  return (
    <main className="min-h-screen bg-[#060606] text-white p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        {/* 1. 數據統計區 */}
        <div className="grid grid-cols-2 gap-4 mb-10">
          <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-md">
            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">全站用戶</p>
            <p className="text-4xl font-black text-white">{allUsers.length}</p>
          </div>
          <div className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-md">
            <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">累積連結</p>
            <p className="text-4xl font-black text-blue-500">{totalLinks}</p>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" /> 用戶監控名單
        </h2>

        <div className="space-y-4">
          {allUsers.map((u) => (
            <div key={u.id} className={`bg-white/5 border rounded-3xl transition-all ${u.status === 'banned' ? 'border-red-900/50 opacity-60' : 'border-white/10'}`}>
              <div className="p-6 flex justify-between items-center cursor-pointer" onClick={() => setExpandedUser(expandedUser === u.id ? null : u.id)}>
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold border ${u.status === 'banned' ? 'bg-red-500/20 border-red-500' : 'bg-gray-800 border-white/10'}`}>
                    {u.displayName?.[0] || "?"}
                  </div>
                  <div>
                    <p className="font-bold text-lg">{u.displayName || "匿名用戶"} {u.status === 'banned' && "🚫"}</p>
                    <p className="text-gray-500 text-xs">{u.id}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={(e) => { e.stopPropagation(); toggleBan(u.id, u.status); }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${u.status === 'banned' ? 'bg-green-600 hover:bg-green-500' : 'bg-red-600 hover:bg-red-500'}`}
                  >
                    {u.status === 'banned' ? '解封' : '停權'}
                  </button>
                  <span className="text-gray-600">▼</span>
                </div>
              </div>

              {/* 2. 用戶詳細內容 (透視模式) */}
              {expandedUser === u.id && (
                <div className="px-6 pb-6 pt-2 border-t border-white/5 bg-black/20 rounded-b-3xl">
                  <p className="text-xs font-bold text-gray-500 mb-4 uppercase tracking-tighter">連結詳細清單 ({u.links?.length || 0})</p>
                  <div className="space-y-2">
                    {u.links?.map((l: any, i: number) => (
                      <div key={i} className="bg-white/5 p-3 rounded-xl border border-white/5 flex justify-between">
                        <span className="font-bold text-sm">{l.title}</span>
                        <span className="text-blue-400 text-xs truncate max-w-[200px]">{l.url}</span>
                      </div>
                    ))}
                    {(!u.links || u.links.length === 0) && <p className="text-gray-600 text-sm">該用戶尚未建立任何連結</p>}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}