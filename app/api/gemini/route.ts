import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, pagesInfo } = body;

    const API_KEY = "AIzaSyDd-RRPIY668POQrs3HMfyjx5RMYYJKrLU"; 
    const MODEL = "gemini-2.5-flash-lite";
    const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`;

    const response = await fetch(URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ 
          parts: [{ 
            // 💡 加上緊箍咒：強制要求精簡、列點、限制字數
            text: `你現在是 River-Link 的系統專屬助手。
                  目前專案：共有 ${pagesInfo?.length || 1} 頁。
                  
                  【請嚴格遵守以下對話規則】：
                  1. 絕對精簡：回答請控制在 100 字以內，不要廢話。
                  2. 易讀排版：盡量使用「條列式」給予直接的操作或文案建議。
                  3. 語氣設定：專業、俐落。不要長篇大論。
                  
                  客戶的問題是：${prompt}` 
          }] 
        }],
        generationConfig: {
          temperature: 0.3, // 💡 調低溫度 (0.0~1.0)，讓它不要過度發散，回答會更精準
          maxOutputTokens: 300, // 💡 強制限制最大輸出字數，預防文字牆
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      return NextResponse.json({ reply: `⚠️ 錯誤: ${data.error?.message}` }, { status: 400 });
    }

    const aiReply = data.candidates[0].content.parts[0].text;
    return NextResponse.json({ reply: aiReply });

  } catch (error: any) {
    return NextResponse.json({ reply: `❌ 連線中斷: ${error.message}` }, { status: 500 });
  }
}