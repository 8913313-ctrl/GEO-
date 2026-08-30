import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", service: "UPS Corporate Portal API" });
  });

  // Gemini AI Pre-Sales & Technical Consultant Endpoint
  app.post("/api/consult", async (req, res) => {
    try {
      const { prompt, history, loadInfo } = req.body;
      
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "系统未配置 GEMINI_API_KEY，请在 Settings > Secrets 中配置。"
        });
      }

      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const systemInstruction = `你叫"山东新硕捷-资深电源系统选型专家"，是"山东新硕捷电子科技有限公司"（服务商/品牌代理）的售前与工程技术专家。
公司地址：山东省淄博市张店区新村西路223号世源大厦1210房。联系电话：18678123345，邮箱：70712289@qq.com。
你的职责是为客户提供专业、严谨、客观的不间断电源（UPS）选型指导、多品牌代采对比、蓄电池容量计算（Ah/Wh）与现场施工方案建议。

关于山东新硕捷代理与销售的产品线：
1. **主流品牌UPS电源**:
   - 代理品牌：山特 (SANTAK)、硕天 (CyberPower)、华为 (HUAWEI)、维谛 (VERTIV Liebert)、施耐德 (Schneider / APC)、科华 (Kehua)、科士达 (Kstar)、易事特 (East)、山顿 (Sendon)
   - 包含高频在线式、三相模块化机房柜、工频隔离变压器电源、IP65户外一体机等
2. **原厂配套蓄电池**:
   - 圣阳、理士、汤浅、西恩迪、童氏、风帆等
   - 铅酸免维护蓄电池、长寿命胶体电池、磷酸铁锂电池组
3. **山东新硕捷14大工程落地服务**:
   - 包含：需求沟通、现场勘察、负载分析、设备选型、方案设计、代采购直供、安装施工、线路接线、系统调试、运维巡检、蓄电池检测与替代更换、设备续保等

回答规范：
- 用专业、客气、严谨的中文回答。
- 强调山东新硕捷作为“工厂落地服务商与品牌代理”的优势：多品牌客观比价、正品保证、工厂直供低价、淄博及山东本地快速现场派工。
- 提供清晰的计算逻辑（如涉及负载功率转换 kVA=kW/PF，电池容量 Ah，延时计算，冗余等级 N+1 等）。
- 适当用 Markdown 格式输出排版（列表、加粗、表单等）。`;

      let formattedPrompt = prompt;
      if (loadInfo) {
        formattedPrompt = `【客户当前选型参数】
- 负载功率: ${loadInfo.powerKw} kW (${loadInfo.powerKva} kVA)
- 功率因数 PF: ${loadInfo.powerFactor}
- 期望后备时间: ${loadInfo.backupTime}
- 冗余配置: ${loadInfo.redundancy}
- 应用场景: ${loadInfo.environment}

客户咨询问题: ${prompt}`;
      }

      const contents = [];
      if (Array.isArray(history) && history.length > 0) {
        for (const item of history) {
          contents.push({
            role: item.role === "user" ? "user" : "model",
            parts: [{ text: item.content }]
          });
        }
      }
      contents.push({
        role: "user",
        parts: [{ text: formattedPrompt }]
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.7-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      const replyText = response.text || "抱歉，暂时未能生成回复，请稍后重试。";
      res.json({ text: replyText });
    } catch (err: any) {
      console.error("Gemini consultation API error:", err);
      res.status(500).json({ error: "服务器处理咨询时出现异常: " + (err.message || String(err)) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[UPS Enterprise Server] Running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
