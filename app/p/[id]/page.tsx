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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const docRef = doc(db, "users", id as string);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfile(docSnap.data());
        }
      } catch (error) {
        console.error("抓取資料失敗:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
        className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full"
      />
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-black flex items-center justify-center text-white text-center p-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">找不到這個頁面</h1>
        <p className="opacity-50">請檢查網址 ID 是否正確</p>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-black text-white p-6 font-sans selection:bg-white selection:text-black flex flex-col items-center justify-center overflow-hidden">
      <header className="max-w-4xl w-full text-center mb-16">
        <motion.div 
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="w-28 h-28 bg-white rounded-full mx-auto mb-6 flex items-center justify-center"
        >
          <span className="text-4xl font-black text-black">
            {String(id).charAt(0).toUpperCase()}
          </span>
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-4xl font-black tracking-tighter mb-2 uppercase"
        >
          {id}
        </motion.h1>
      </header>

      <section className="w-full max-w-[100vw]">
        <div className="flex overflow-x-auto pb-12 pt-4 px-6 md:px-12 gap-6 snap-x snap-mandatory hide-scrollbar items-center">
          {profile.links?.map((link: any, index: number) => (
            <motion.a
              key={index}
              href={link.url.startsWith('http') ? link.url : `https://${link.url}`}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex-shrink-0 w-[280px] md:w-[320px] aspect-[4/5] bg-white/10 backdrop-blur-md border border-white/20 rounded-[2.5rem] p-10 flex flex-col justify-between snap-center"
            >
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-black">
                <Globe size={32} />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tight mb-4 leading-none">
                  {link.title}
                </h2>
                <div className="text-xs font-mono opacity-50 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  ONLINE
                </div>
              </div>
            </motion.a>
          ))}
          <div className="w-12 flex-shrink-0" />
        </div>
      </section>

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      <footer className="mt-16 opacity-20 text-[10px] font-black tracking-widest uppercase italic">
        River Link 2026
      </footer>
    </main>
  );
}