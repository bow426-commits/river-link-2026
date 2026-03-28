"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "../../../lib/firebase";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "firebase/firestore";

export default function PublicProfile() {
  const params = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [userRef, setUserRef] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchProfile = async () => {
      if (!params?.id) return;
      const idOrSlug = params.id as string;
      
      try {
        let userData: any = null;
        let docRef: any = null;

        // 🔍 雙模組搜尋
        // 1. 先嘗試用 UID 找 (相容舊網址)
        const directRef = doc(db, "users", idOrSlug);
        try {
          const docSnap = await getDoc(directRef);
          if (docSnap.exists()) {
            docRef = directRef;
            userData = docSnap.data();
          }
        } catch (e) {
          console.log("非 UID，嘗試搜尋 Slug...");
        }

        // 2. 如果找不到，改用 Slug 搜尋 (自定義網址)
        if (!userData) {
          const q = query(collection(db, "users"), where("slug", "==", idOrSlug));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            docRef = querySnapshot.docs[0].ref;
            userData = querySnapshot.docs[0].data();
          }
        }

        if (userData) {
          if (userData.status === "banned") {
            setError("此帳號目前無法查看");
          } else {
            setProfile(userData);
            setUserRef(docRef); // 儲存位置，準備寫入點擊數
          }
        } else {
          setError("找不到此用戶頁面");
        }
      } catch (err) {
        console.error("讀取錯誤:", err);
        setError("資料讀取失敗 (請確認 Firebase 規則)");
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [params]);

  // 🎯 核心動作：點擊追蹤
  const handleLinkClick = async (index: number) => {
    if (!profile || !userRef) return;

    try {
      // 複製一份目前的 links 陣列
      const newLinks = [...profile.links];
      // 將被點擊的那一條連結的 clicks 數字 +1 (如果原本沒有就從 0 開始加)
      newLinks[index].clicks = (newLinks[index].clicks || 0) + 1;
      
      // 寫回 Firestore (背景靜默執行，不影響用戶跳轉)
      await updateDoc(userRef, { links: newLinks });
    } catch (err) {
      console.error("追蹤點擊失敗", err);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center font-bold animate-pulse">載入中...</div>;
  if (error) return <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center font-bold text-red-500">{error}</div>;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-6 flex flex-col items-center pt-20">
      <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-8 duration-1000 text-center">
        {profile.photoURL ? (
          <img src={profile.photoURL} className="w-24 h-24 rounded-full border-2 border-white/20 shadow-2xl mx-auto mb-6" />
        ) : (
          <div className="w-24 h-24 bg-gradient-to-br from-gray-700 to-black rounded-full border-2 border-white/20 flex items-center justify-center font-black text-4xl mx-auto mb-6">
            {profile.displayName?.[0]}
          </div>
        )}
        <h1 className="text-2xl font-black tracking-tight mb-10">{profile.displayName}</h1>
        
        <div className="space-y-4">
          {profile.links?.map((link: any, index: number) => (
            <a 
              key={index} 
              href={link.url.startsWith('http') ? link.url : `https://${link.url}`} 
              target="_blank" 
              rel="noopener noreferrer"
              onClick={() => handleLinkClick(index)} // 🔥 觸發追蹤的開關
              className="block w-full bg-white/5 hover:bg-white/10 border border-white/10 p-5 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl"
            >
              <span className="font-bold text-lg">{link.title}</span>
            </a>
          ))}
        </div>
        <div className="mt-20 opacity-30 text-[10px] font-black tracking-widest uppercase italic">Powered by River Link</div>
      </div>
    </main>
  );
}