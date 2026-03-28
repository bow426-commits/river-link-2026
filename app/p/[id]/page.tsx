"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { ExternalLink, Globe } from "lucide-react";

export default function PublicProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;
      const docRef = doc(db, "users", id as string);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setProfile(docSnap.data());
      }
    };
    fetchProfile();
  }, [id]);

  if (!profile) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full"
      />
    </div>
  );

  return (
    <main className="min-h-screen bg-black text-white p-6 font-sans selection:bg-white selection:text-black flex flex-col items-center justify-center">
      {/* 個人頭像與標題區塊 */}
      <header className="max-w-4xl w-full text-center mb-16">
        <motion.div 
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 20 }}
          className="w-28 h-28 bg-gradient-to-tr from-gray-700 to-gray-400 rounded-full mx-auto mb-6 border-4 border-white/10 shadow-[0_0_40px_rgba(255,255,255,0.1)] overflow-hidden flex items-center justify-center"
        >
          {/* 如果你有頭像網址可以用 img，暫時用 ID 的第一個字母作為頭像 */}
          <span className="text-4xl font-black text-white drop-shadow-md">
            {String(id).charAt(0).toUpperCase()}
          </span>
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="text-4xl font-black tracking-tighter mb-2 uppercase"
        >
          {id}
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          className="opacity-50 text-sm font-medium tracking-widest uppercase"
        >
          {profile.bio || "Personal Space"}
        </motion.p>
      </header>

      {/* 拖拉滑動卡片區域 */}
      <section className="w-full max-w-[100vw]">
        {/* 使用 overflow-x-auto 達成原生順滑的橫向滾動，並隱藏滾動條 */}
        <div className="flex overflow-x-auto pb-12 pt-4 px-6 md:px-12 gap-6 snap-x snap-mandatory hide-scrollbar items-center">
          {profile.links?.map((link: any, index: number) => (
            <motion.a
              key={index}
              href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ 
                type: "spring", 
                stiffness: 100, 
                damping: 15, 
                delay: index * 0.1 // 讓卡片一張一張飛進來
              }}
              whileHover={{ scale: 1.02, y: -5 }}
              whileTap={{ scale: 0.98 }}
              className="flex-shrink-0 w-[280px] md:w-[320px] aspect-[4/5] bg-white/5 backdrop-blur-md border border-white/10 rounded-[2rem] p-8 flex flex-col justify-between snap-center hover:bg-white/10 hover:border-white/20 hover:shadow-[0_0_30px_rgba(255,255,255,0.05)] transition-all duration-300 group relative overflow-hidden"
            >
              {/* 卡片右上角的背景裝飾光暈 */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-50" />

              {/* 卡片上半部：圖示 */}
              <div className="flex justify-between items-start relative z-10">
                <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white backdrop-blur-sm border border-white/5">
                  <Globe size={28} strokeWidth={1.5} />
                </div>
                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/0 group-hover:bg-white/10 transition-colors duration-300">
                  <ExternalLink size={20} className="text-white/30 group-hover:text-white transition-colors duration-300" />
                </div>
              </div>
              
              {/* 卡片下半部：文字 */}
              <div className="relative z-10">
                <h2 className="text-2xl font-bold tracking-tight mb-3 line-clamp-2 leading-tight">
                  {link.title}
                </h2>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <p className="text-xs font-mono opacity-60 truncate max-w-[180px]">
                    {link.url.replace(/^https?:\/\//, '')}
                  </p>
                </div>
              </div>
            </motion.a>
          ))}
          
          {/* 結尾的留白，讓最後一張卡片可以滑到中間 */}
          <div className="w-6 md:w-12 flex-shrink-0" />
        </div>
      </section>

      {/* 隱藏滾動條的 CSS (放在全域或這裡都可以，這裡用 inline style 確保生效) */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}} />

      <footer className="mt-16 text-center opacity-20 text-[10px] font-black tracking-widest uppercase italic">
        Powered by River Link 2026
      </footer>
    </main>
  );
}