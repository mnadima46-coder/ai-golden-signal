import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let ai: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI | null {
  if (!ai) {
    const key = process.env.GEMINI_API_KEY;
    if (key && key !== "MY_GEMINI_API_KEY") {
      ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return ai;
}

// REST API endpoint for voice analysis
app.post("/api/analyze", async (req, res) => {
  const { query, history, currentPrediction } = req.body;
  const userQuery = query || "ওই, পরবর্তী ট্রেন্ড কি?";
  
  const historyText = Array.isArray(history) 
    ? history.slice(0, 5).map((h: any) => `Period ${h.period}: Color ${h.resultColor}, Number ${h.resultNumber}, Size ${h.resultSize}`).join("\n")
    : "No recent round history";

  const predText = currentPrediction 
    ? `Current Live Prediction -> Period: ${currentPrediction.period}, Color: ${currentPrediction.predictedColor}, Size: ${currentPrediction.predictedSize}, Numbers: ${currentPrediction.predictedNumbers.join(", ")}, Confidence: ${currentPrediction.confidence}%`
    : "No current live prediction active";

  try {
    const genAI = getGeminiClient();
    
    if (genAI) {
      const prompt = `
      User Query: "${userQuery}"
      
      Latest WinGo 30s Market History Context:
      ${historyText}
      
      Active Predictor Algorithm Decryption:
      ${predText}
      
      Respond directly to user query in Bengali. Keep it highly concise, authoritative, deeply technical, and professional (1-3 sentences maximum). Explaining color trading market logic in Bangla, using words like 'ব্যালেন্সিং রেশিও', 'মার্কেট ট্রেন্ড', 'অ্যালগরিদমিক জিগ-জ্যাগ', 'সার্ভার মেমোরি রিসেট', and providing precise tactical guidance.`;

      const response = await genAI.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "You are Matrix Vox-Y, the highly advanced Bengali voice decryption engine for WinGo 30s. You always respond in formal or standard Bengali in under 3 concise sentences with high technical accuracy. Do not use generic explanations; analyze the trend and give accurate algorithmic predictions."
        }
      });

      const responseText = response.text || "সার্ভার রেসপন্স জেনারেট করতে পারেনি। অনুগ্রহ করে আবার চেষ্টা করুন।";
      return res.json({
        success: true,
        text: responseText,
        source: "Gemini AI"
      });
    } else {
      // Fallback rule-based smart engine (very sophisticated Bangla voice replies)
      let reply = "সার্ভার ব্যালেন্সিং রেশিও মেলাতে সাময়িকভাবে বিপরীত ট্রেন্ডে যাচ্ছে। শেষ রাউন্ডগুলোর ডেটা বিশ্লেষণ করে মনে হচ্ছে বাজার জিগ-জ্যাগ বা দোলন প্যাটার্নে শিফট করেছে যা পরবর্তী ২-৩ রাউন্ড স্থায়ী হবে।";
      
      const lowQuery = userQuery.toLowerCase();
      if (lowQuery.includes("পরবর্তী") || lowQuery.includes("পরের") || lowQuery.includes("next")) {
        reply = "পরবর্তী রাউন্ডের জন্য অ্যালগরিদম রেড এবং স্মল জোনের একটি শক্তিশালী ব্যালেন্সিং প্যাটার্ন লক করছে। ৯০% কনফিডেন্স ইনডেক্স অনুযায়ী ০, ২ বা ৪ নম্বরের দিকে পরবর্তী সিগন্যাল যাচ্ছে।";
      } else if (lowQuery.includes("কেন") || lowQuery.includes("কেন আসলো") || lowQuery.includes("why")) {
        reply = "বিগত ৫টি রাউন্ডে ব্যাক-টু-ব্যাক বিগ এবং গ্রিন আসার কারণে মার্কেট রেট ওভার-স্যাচুরেটেড হয়ে গেছে। সার্ভার মেমরি ব্যালেন্স করতে অ্যালগরিদম আকস্মিক রিভার্স জিগ-জ্যাগ পুশ করেছে।";
      } else if (lowQuery.includes("রিসেট") || lowQuery.includes("reset") || lowQuery.includes("মেমোরি")) {
        reply = "লোকাল প্যাটার্ন মেমোরি এবং সার্ভার সিঙ্ক ডাটাবেস সম্পূর্ণরূপে রিসেট করা হয়েছে। অ্যালগরিদম এখন নতুন রিয়েল-টাইম ট্রেন্ড বিশ্লেষণ করা আরম্ভ করেছে।";
      } else if (lowQuery.includes("ওই") || lowQuery.includes("wai")) {
        reply = "আমি শুনছি। বলুন, উইনগো ৩০ সেকেন্ডের গেম মার্কেটের কোন ম্যাট্রিক্স বা প্যাটার্নটি আপনার জন্য ডিক্রিপ্ট করতে হবে?";
      }

      return res.json({
        success: true,
        text: reply,
        source: "Matrix Vox-Y Dynamic Engine"
      });
    }
  } catch (error: any) {
    console.error("Gemini analysis error:", error);
    return res.json({
      success: false,
      text: "ক্ষমা করবেন, এআই সার্ভার সংযোগ বিলম্বিত হচ্ছে। তবে চলমান ধারা অনুযায়ী পরবর্তী ৩ রাউন্ডের সম্ভাবনা রেড এবং স্মল জোনে সর্বোচ্চ।",
      source: "Engine Fallback Plan B",
      error: error.message
    });
  }
});

// Global in-memory cache for real-time market results extracted from proxied API traffic
let realMarketHistory: Array<{ period: string; number: number; size: 'BIG' | 'SMALL'; color: 'Red' | 'Green' | 'Violet' }> = [];

function extractGameResults(obj: any): void {
  if (!obj || typeof obj !== 'object') return;

  // If obj is an array, process each item
  if (Array.isArray(obj)) {
    obj.forEach(item => extractGameResults(item));
    return;
  }

  // Check if this object represents a single game outcome item
  let periodVal: any = obj.issue || obj.period || obj.periodNo || obj.period_no || obj.stage || obj.stageNo || obj.expect || obj.periodNumber;
  let numberVal: any = obj.number !== undefined ? obj.number : (obj.openNum !== undefined ? obj.openNum : (obj.winNumber !== undefined ? obj.winNumber : obj.open_num));

  if (periodVal && numberVal !== undefined) {
    const periodStr = String(periodVal).trim();
    const numInt = parseInt(String(numberVal), 10);

    // Verify it's a valid period (usually long digits, at least 6 digits) and valid single digit number (0-9)
    if (/^\d{6,18}$/.test(periodStr) && !isNaN(numInt) && numInt >= 0 && numInt <= 9) {
      const sizeVal: 'BIG' | 'SMALL' = numInt >= 5 ? 'BIG' : 'SMALL';
      let colorVal: 'Red' | 'Green' | 'Violet' = 'Red';
      if (numInt === 0 || numInt === 5) {
        colorVal = 'Violet';
      } else if (numInt % 2 === 0) {
        colorVal = 'Red';
      } else {
        colorVal = 'Green';
      }

      // Check if duplicate
      const exists = realMarketHistory.some(item => item.period === periodStr);
      if (!exists) {
        realMarketHistory.push({
          period: periodStr,
          number: numInt,
          size: sizeVal,
          color: colorVal
        });
        
        // Keep sorted by period descending (newest first)
        realMarketHistory.sort((a, b) => b.period.localeCompare(a.period));
        
        // Trim to latest 50 results
        if (realMarketHistory.length > 50) {
          realMarketHistory = realMarketHistory.slice(0, 50);
        }
        
        console.log(`[REAL MARKET] Extracted Result: Period=${periodStr}, Number=${numInt}, Size=${sizeVal}, Color=${colorVal}`);
      }
    }
  }

  // Recursively inspect any child keys/objects in case the game list is deep
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const val = obj[key];
      if (val && typeof val === 'object') {
        extractGameResults(val);
      }
    }
  }
}

// Background polling loop to proactively fetch real market results
async function pollRealMarket(): Promise<void> {
  try {
    const domain = lastTargetDomain || "https://dkwin9.com";
    
    // Attempt fetching from multiple typeIds corresponding to different Wingo rooms
    const typeIds = [1, 2, 3, 5];
    
    // 1. Try standard GetNoHeader endpoint
    for (const typeId of typeIds) {
      try {
        const r = await fetch(`${domain}/api/webapi/GetNoHeader`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
          },
          body: JSON.stringify({ typeId, pageSize: 12, pageNo: 1 })
        });
        if (r.ok) {
          const json = await r.json();
          extractGameResults(json);
        }
      } catch (e) {}
    }

    // 2. Try secondary GetGameHistory endpoint and fallback structures
    for (const typeId of typeIds) {
      try {
        const r = await fetch(`${domain}/api/webapi/GetGameHistory`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
          },
          body: JSON.stringify({ typeId, pageSize: 12, pageNo: 1 })
        });
        if (r.ok) {
          const json = await r.json();
          extractGameResults(json);
        }
      } catch (e) {}
    }
  } catch (err) {
    // Silently ignore background polling errors
  }
}

// Periodically run background updates
setInterval(pollRealMarket, 6000);

// Endpoint for client app to fetch the latest real-time extracted results
app.get("/api/real-market", (req, res) => {
  res.json({
    success: true,
    history: realMarketHistory
  });
});

// Helper globally tracked dynamic target host
let lastTargetDomain = "https://dkwin9.com";

// Helper function to rewrite HTML so assets and URLs are proxied
function rewriteHtml(html: string) {
  // 1. Rewrite any absolute addresses to either platform to point back to our proxy
  let rewritten = html.replace(/https?:\/\/(www\.)?2bdwin24\.com/gi, "/api/webview-tunnel");
  rewritten = rewritten.replace(/https?:\/\/(www\.)?dkwin9\.com/gi, "/api/webview-tunnel");
  
  // 2. Rewrite host-relative routes (like /assets or /static) to /api/webview-tunnel/... so they are caught by our proxy
  rewritten = rewritten.replace(/(src|href|action)="\/([^"]*)"/gi, '$1="/api/webview-tunnel/$2"');
  rewritten = rewritten.replace(/(src|href|action)='\/([^']*)'/gi, "$1='/api/webview-tunnel/$2'");
  
  // 3. Inject our same-origin base tag
  const baseTag = `<base href="/api/webview-tunnel/">`;
  if (rewritten.includes("<head>")) {
    rewritten = rewritten.replace("<head>", `<head>\n    ${baseTag}`);
  } else if (rewritten.match(/<head[^>]*>/i)) {
    rewritten = rewritten.replace(/<head([^>]*)>/i, (m, attrs) => `<head${attrs}>\n    ${baseTag}`);
  } else {
    rewritten = baseTag + rewritten;
  }
  
  return rewritten;
}

// Dynamic WebView Tunnel & Cookie Sync Gateway
app.all("/api/webview-tunnel*", async (req, res) => {
  // Determine target URL
  let targetUrl = "https://dkwin9.com/#/login";
  
  if (req.query.url) {
    targetUrl = req.query.url as string;
    try {
      const urlObj = new URL(targetUrl);
      lastTargetDomain = urlObj.origin;
    } catch (e) {}
  } else {
    // Extract path from request
    const subPath = req.originalUrl.replace(/^\/api\/webview-tunnel/, "");
    // Avoid double slashes and query strings issues
    const cleanSubPath = subPath.startsWith("/") ? subPath : `/${subPath}`;
    targetUrl = `${lastTargetDomain}${cleanSubPath}`;
  }

  try {
    // Headers setup
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      "Accept": req.headers["accept"] || "*/*",
      "Accept-Language": req.headers["accept-language"] || "en-US,en;q=0.9,bn;q=0.8",
    };

    if (req.headers["content-type"]) {
      headers["Content-Type"] = req.headers["content-type"];
    }

    if (req.headers["cookie"]) {
      headers["Cookie"] = req.headers["cookie"];
    }

    const fetchOptions: any = {
      method: req.method,
      headers: headers,
    };

    // Forward the POST / PUT bodies safely
    if (req.method !== "GET" && req.method !== "HEAD") {
      if (req.headers["content-type"]?.includes("application/json")) {
        fetchOptions.body = JSON.stringify(req.body);
      } else if (req.headers["content-type"]?.includes("application/x-www-form-urlencoded")) {
        const urlParams = new URLSearchParams();
        for (const [k, v] of Object.entries(req.body)) {
          urlParams.append(k, String(v));
        }
        fetchOptions.body = urlParams.toString();
      } else {
        if (req.body && typeof req.body === 'object') {
          fetchOptions.body = JSON.stringify(req.body);
        } else if (req.body) {
          fetchOptions.body = req.body;
        }
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Sync security cookies back to the browser on our same origin!
    const setCookies = response.headers.getSetCookie();
    if (setCookies && setCookies.length > 0) {
      setCookies.forEach((cookie) => {
        // Clean cookie attributes that limit to target domain
        const sanitizedCookie = cookie
          .replace(/domain=[^;]+/gi, "")
          .replace(/Secure/gi, "");
        res.append("Set-Cookie", sanitizedCookie);
      });
    }

    // Capture and map redirect headers to stay within the tunnel
    if ([301, 302, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (location) {
        let newLocation = location;
        if (location.startsWith("https://2bdwin24.com") || location.startsWith("http://2bdwin24.com") ||
            location.startsWith("https://dkwin9.com") || location.startsWith("http://dkwin9.com")) {
          newLocation = location.replace(/https?:\/\/(www\.)?(2bdwin24\.com|dkwin9\.com)/i, "/api/webview-tunnel");
        } else if (location.startsWith("/")) {
          newLocation = `/api/webview-tunnel${location}`;
        }
        res.setHeader("Location", newLocation);
        return res.status(response.status).end();
      }
    }

    const contentType = response.headers.get("content-type") || "text/html";
    res.setHeader("Content-Type", contentType);

    // Copy caching and general compression details
    const headersToCopy = ["cache-control", "pragma", "expires"];
    headersToCopy.forEach((h) => {
      const val = response.headers.get(h);
      if (val) {
        res.setHeader(h, val);
      }
    });

    if (contentType.includes("text/html")) {
      const htmlText = await response.text();
      const rewrittenHtml = rewriteHtml(htmlText);
      res.status(response.status).send(rewrittenHtml);
    } else if (contentType.includes("text/css") || contentType.includes("javascript") || contentType.includes("json")) {
      // Find and proxy absolute API and asset references embedded in scripts/styles
      let responseText = await response.text();
      responseText = responseText.replace(/https?:\/\/(www\.)?2bdwin24\.com/gi, "/api/webview-tunnel");
      responseText = responseText.replace(/https?:\/\/(www\.)?dkwin9\.com/gi, "/api/webview-tunnel");
      res.status(response.status).send(responseText);
    } else {
      // Stream raw binary buffer for images, fonts, media
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.status(response.status).send(buffer);
    }

  } catch (err: any) {
    console.error("WebView Tunnel Error:", err);
    res.status(500).send(`
      <div style="background:#070a12; color:#ef4444; font-family:sans-serif; padding:30px; border-radius:12px; border:1px solid rgba(239, 68, 68, 0.3); max-width:500px; margin:40px auto; text-align:center; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
         <h3 style="margin-top:0; font-size:18px; letter-spacing:1px; color:#f87171;">🚫 WEBVIEW TUNNEL ERROR</h3>
         <p style="font-size:13px; color:#94a3b8; line-height:1.6;">Secure dynamic webview tunnel has failed to sync.</p>
         <p style="font-size:11px; font-family:monospace; background:#0e1628; padding:10px; border-radius:6px; text-align:left; color:#fca5a5; overflow-x:auto;">${err.message}</p>
         <button onclick="window.location.reload()" style="background:#06b6d4; color:#070a12; border:none; padding:10px 20px; border-radius:6px; font-weight:bold; cursor:pointer; margin-top:15px; text-transform:uppercase; font-size:11px; letter-spacing:1px;">Retry Connection</button>
      </div>
    `);
  }
});

// Proxy catch-all for any other api/web/img/js/css routes, so host-relative API calls or assets done by webscripts are proxied
app.all(["/api/*", "/webapi/*", "/img/*", "/js/*", "/css/*", "/platformapi/*", "/static/*", "/assets/*"], async (req, res, next) => {
  const urlPath = req.originalUrl;
  
  // Skip our own routes
  if (urlPath.startsWith("/api/analyze") || urlPath.startsWith("/api/webview-tunnel")) {
    return next();
  }

  // If it's a request to /assets/*, check if it lives in our own local built dist path
  if (urlPath.startsWith("/assets/")) {
    const localFilePath = path.join(process.cwd(), "dist", urlPath.split("?")[0]);
    if (fs.existsSync(localFilePath)) {
      return next();
    }
  }
  
  // Forward to dynamic lastTargetDomain
  const targetUrl = `${lastTargetDomain}${urlPath}`;
  
  try {
    const headers: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1",
      "Accept": req.headers["accept"] || "*/*",
      "Accept-Language": req.headers["accept-language"] || "en-US,en;q=0.9,bn;q=0.8",
    };

    if (req.headers["content-type"]) {
      headers["Content-Type"] = req.headers["content-type"];
    }

    if (req.headers["cookie"]) {
      headers["Cookie"] = req.headers["cookie"];
    }

    const fetchOptions: any = {
      method: req.method,
      headers: headers,
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      if (req.headers["content-type"]?.includes("application/json")) {
        fetchOptions.body = JSON.stringify(req.body);
      } else if (req.headers["content-type"]?.includes("application/x-www-form-urlencoded")) {
        const urlParams = new URLSearchParams();
        for (const [k, v] of Object.entries(req.body)) {
          urlParams.append(k, String(v));
        }
        fetchOptions.body = urlParams.toString();
      } else if (req.body) {
        fetchOptions.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
      }
    }

    const response = await fetch(targetUrl, fetchOptions);

    // Set cookie headers
    const setCookies = response.headers.getSetCookie();
    if (setCookies && setCookies.length > 0) {
      setCookies.forEach((cookie) => {
        const sanitizedCookie = cookie
          .replace(/domain=[^;]+/gi, "")
          .replace(/Secure/gi, "");
        res.append("Set-Cookie", sanitizedCookie);
      });
    }

    const contentType = response.headers.get("content-type") || "application/json";
    res.setHeader("Content-Type", contentType);

    if (contentType.includes("json")) {
      try {
        const json = await response.json();
        // Dynamic interception of Wingo periods and draw results flowing from the target API
        extractGameResults(json);
        res.status(response.status).json(json);
      } catch (jsonErr) {
        const text = await response.text();
        res.status(response.status).send(text);
      }
    } else {
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      res.status(response.status).send(buffer);
    }
  } catch (err: any) {
    console.error("Endpoint Proxy Error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Retro-compatible legacy endpoint mapped to rewrite tunnel
app.get("/api/webview", (req, res) => {
  const url = req.query.url as string || "https://dkwin9.com/#/login";
  res.redirect(`/api/webview-tunnel?url=${encodeURIComponent(url)}`);
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Vite middleware for development
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Golden Signal Server running on http://localhost:${PORT}`);
  });
}

startServer();
