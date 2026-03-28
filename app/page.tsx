"use client";
import { useState, useEffect } from "react";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // v3.0 新增：Slug 狀態
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDocRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (userData.status === "banned") {
            alert("⚠️ 您的帳號已被停權。");
            await signOut(auth);
            setUser(null);
            setLoading(false);
            return;
          }
          setUser({ ...currentUser, ...userData });
          setLinks(userData.links || []);
          setSlug(userData.slug || ""); // 讀取現有 Slug
        } else {
          const newUserData = {
            displayName: currentUser.displayName,
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            links: [],
            status: "active",
            role: "user",
            slug: ""
          };
          await setDoc(userDocRef, newUserData);
          setUser(currentUser);
        }
      } else {
        setUser(null);
        setLinks([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // v3.0 新增：檢查 Slug 是否重複
  const checkSlug = async (value: string) => {
    const cleanSlug = value.toLowerCase().trim().replace(/[^a-z0-9]/g, "");
    setSlug(cleanSlug);
    
    if (cleanSlug.length < 3) {
      setSlugStatus("invalid");
      return;
    }

    setSlugStatus("checking");
    const q = query(collection(db, "users"), where("slug", "==", cleanSlug));
    const querySnapshot = await getDocs(q);
    
    // 如果找到文件，且不是目前登入的這個人，就是被取走了
    const isTaken = querySnapshot.docs.some(doc => doc.id !== user.uid);
    setSlugStatus(isTaken ? "taken" : "available");
  };

  const saveSlug = async () => {
    if (slugStatus === "available" && user) {
      await updateDoc(doc(db, "users", user.uid), { slug: slug });
      alert("✅ 專屬網址設定成功！");
      setSlugStatus("idle");
    }
  };

  const login = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const saveLinks = async (newLinks: any[]) => {
    if (user) await updateDoc(doc(db, "users", user.uid), { links: newLinks });
  };

  const addLink = () => {
    const newLinks = [...links, { title: "新連結", url: "https://", clicks: 0 }];
    setLinks(newLinks);
    saveLinks(newLinks);
  };

  const onDragEnd = (result: any) => {
    if (!result.destination) return;
    const items = Array.from(links);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    setLinks(items);
    saveLinks(items);
  };

  if (loading) return <div className="min-h-screen bg-[#0a0a0a] text-white flex items-center justify-center font-black text-2xl animate-pulse">RIVER LINK.</div>;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white p-4 md:p-10 selection:bg-blue-500/30 font-sans">
      <div className="max-w-2xl mx-auto">
        {!user ? (
          <div className="text-center py-32">
            <h1 className="text-7xl font-black mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-gray-500 tracking-tighter">River Link.</h1>
            <button onClick={login} className="bg-white text-black px-12 py-5 rounded-full font-black hover:scale-105 transition-all text-xl">開始使用</button>
          </div>
        ) : (
          <div className="animate-in fade-in duration-1000">
            {/* Header */}
            <div className="flex justify-between items-center mb-12">
              <h1 className="text-3xl font-black italic tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">RIVER LINK.</h1>
              <div className="flex items-center gap-4">
                <button onClick={() => window.open('/admin', '_blank')} className="text-[10px] font-bold text-red-500/40 hover:text-red-500 tracking-widest">上帝模式</button>
                <button onClick={() => signOut(auth)} className="text-gray-600 hover:text-white text-[10px] font-bold tracking-widest">登出</button>
              </div>
            </div>

            {/* v3.0 Slug 設定區塊 */}
            <div className="bg-white/5 border border-white/10 p-8 rounded-[2.5rem] mb-10 backdrop-blur-3xl">
               <div className="flex items-center gap-5 mb-8">
                  <img src={user.photoURL} className="w-16 h-16 rounded-full border border-white/10 shadow-2xl" />
                  <div>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Personal URL</p>
                    <p className="font-black text-xl tracking-tight">river-link.com/p/{user.slug || "..."}</p>
                  </div>
               </div>

               <div className="relative">
                  <input 
                    className="w-full bg-black/40 border border-white/5 p-4 rounded-2xl focus:outline-none focus:border-blue-500/50 transition-all font-bold placeholder:text-gray-700"
                    placeholder="設定你的專屬 ID (例如: river)"
                    value={slug}
                    onChange={(e) => checkSlug(e.target.value)}
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase tracking-widest">
                    {slugStatus === "checking" && <span className="text-blue-500 animate-pulse">檢查中...</span>}
                    {slugStatus === "available" && <button onClick={saveSlug} className="text-green-500 hover:underline">儲存網址</button>}
                    {slugStatus === "taken" && <span className="text-red-500">已被佔用</span>}
                    {slugStatus === "invalid" && <span className="text-gray-600">至少 3 個字</span>}
                  </div>
               </div>
            </div>

            <button onClick={addLink} className="w-full bg-white text-black hover:bg-gray-200 py-5 rounded-3xl font-black mb-10 transition-all shadow-xl shadow-white/5 active:scale-95">
              ＋ 新增社交連結
            </button>

            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="links">
                {(provided) => (
                  <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                    {links.map((link, index) => (
                      <Draggable key={index} draggableId={`link-${index}`} index={index}>
                        {(provided) => (
                          <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} className="group bg-white/5 border border-white/10 p-6 rounded-[2.5rem] hover:bg-white/[0.08] transition-all">
                            <div className="flex justify-between items-start mb-2">
                                <input 
                                  className="bg-transparent font-black text-2xl block w-full focus:outline-none placeholder:text-gray-800" 
                                  value={link.title} 
                                  placeholder="連結標題"
                                  onChange={(e) => {
                                    const newLinks = [...links];
                                    newLinks[index].title = e.target.value;
                                    setLinks(newLinks);
                                    saveLinks(newLinks);
                                  }}
                                />
                                <span className="text-[10px] font-black text-blue-500/50 bg-blue-500/5 px-2 py-1 rounded-md">{link.clicks || 0} 點擊</span>
                            </div>
                            <input 
                              className="bg-transparent text-gray-500 text-sm block w-full focus:outline-none font-medium truncate" 
                              value={link.url} 
                              placeholder="https://..."
                              onChange={(e) => {
                                const newLinks = [...links];
                                newLinks[index].url = e.target.value;
                                setLinks(newLinks);
                                saveLinks(newLinks);
                              }}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </div>
        )}
      </div>
    </main>
  );
}