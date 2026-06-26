import express from "express";
import path from "path";
import os from "os";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is required but not set. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Raw / Text body parser for the proxy to forward requests exactly as-is
  app.use(express.text({ type: '*/*', limit: '50mb' }));

  // API proxy route to bypass CORS/iframe fetch restrictions
  app.all("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing 'url' query parameter" });
    }

    try {
      const fetchOptions: any = {
        method: req.method,
        headers: {
          'Accept': '*/*',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      };

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        fetchOptions.body = req.body;
        const contentType = req.headers['content-type'];
        if (contentType) {
          fetchOptions.headers['content-type'] = contentType;
        }
      }

      const response = await fetch(targetUrl, fetchOptions);
      
      // Copy target content-type to response
      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("content-type", contentType);
      }
      
      // Permit cross-origin on our own proxy
      res.setHeader("Access-Control-Allow-Origin", "*");
      
      // Handle the data as arrayBuffer to support any file/format (JSON, CSV, ZIP, binary)
      const buffer = await response.arrayBuffer();
      res.status(response.status).send(Buffer.from(buffer));
    } catch (error: any) {
      console.error("Proxy error for URL:", targetUrl, error.message);
      res.status(502).json({ error: "Bad Gateway proxy error", message: error.message });
    }
  });

  // API Route for Gemini Chat / Data Analysis
  app.post("/api/gemini/chat", async (req, res) => {
    let data: any = {};
    try {
      if (typeof req.body === 'string') {
        data = JSON.parse(req.body);
      } else {
        data = req.body;
      }
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const { prompt, systemInstruction, responseMimeType, responseSchema } = data;
    if (!prompt) {
      return res.status(400).json({ error: "Missing 'prompt' parameter" });
    }

    try {
      const ai = getGeminiClient();
      const config: any = {};
      if (systemInstruction) config.systemInstruction = systemInstruction;
      if (responseMimeType) config.responseMimeType = responseMimeType;
      if (responseSchema) config.responseSchema = responseSchema;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config,
      });

      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Chat API error:", error.message);
      res.status(500).json({ error: "Gemini API error", message: error.message });
    }
  });

  // API Route for Gemini Card Background Generation
  app.post("/api/gemini/generate-image", async (req, res) => {
    let data: any = {};
    try {
      if (typeof req.body === 'string') {
        data = JSON.parse(req.body);
      } else {
        data = req.body;
      }
    } catch (e) {
      return res.status(400).json({ error: "Invalid JSON body" });
    }

    const { prompt, aspectRatio } = data;
    if (!prompt) {
      return res.status(400).json({ error: "Missing 'prompt' parameter" });
    }

    try {
      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: prompt,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: aspectRatio || "1:1",
          },
        },
      });

      let base64Image = "";
      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.inlineData?.data) {
            base64Image = part.inlineData.data;
            break;
          }
        }
      }

      if (!base64Image) {
        return res.status(500).json({ error: "Model did not return any image data." });
      }

      res.json({ imageUrl: `data:image/png;base64,${base64Image}` });
    } catch (error: any) {
      console.error("Gemini Image API error:", error.message);
      res.status(500).json({ error: "Gemini Image API error", message: error.message });
    }
  });

  // Vite middleware for development or serving index.html in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        host: true
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log("=================================================");
    console.log(`🚀 SAPTA ADMIN Server is starting...`);
    console.log(`👉 Local URL:     http://localhost:${PORT}`);
    
    const localIps = getLocalIpAddresses();
    if (localIps.length > 0) {
      localIps.forEach(ip => {
        console.log(`👉 Network IP:    http://${ip}:${PORT}  (Akses dari HP / Jaringan Lokal)`);
      });
    } else {
      console.log(`👉 Network IP:    http://0.0.0.0:${PORT}`);
    }
    console.log("=================================================");
  });
}

startServer();
