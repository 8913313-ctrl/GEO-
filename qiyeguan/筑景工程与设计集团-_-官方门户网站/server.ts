import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini AI Client lazily or safely on server
const getAiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

// Simulated synchronized backend system data (Mocking sync with user's local backend system)
let simulatedAdminData = {
  syncStatus: "Connected to Local Admin API (Simulated)",
  lastSyncTime: new Date().toISOString(),
  totalProjects: 128,
  activeSites: 38,
  ongoingDesigns: 14,
  qualityPassRate: "99.8%",
  recentSystemLogs: [
    { id: 1, time: "10:24", action: "BIM 5D 碰撞检测审查完成", location: "陆家嘴金融中心项目部" },
    { id: 2, time: "09:45", action: "德系隐蔽工程水压测试合格", location: "滨江一号顶奢别墅" },
    { id: 3, time: "08:30", action: "材料批次防伪验收入库 (Saint-Gobain / Daikin)", location: "中央物流仓" }
  ]
};

// API: Sync statistics & status from backend admin
app.get("/api/admin-sync/status", (req, res) => {
  res.json({
    success: true,
    data: {
      ...simulatedAdminData,
      lastSyncTime: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }
  });
});

// API: Handle booking consultation / site measurement
app.post("/api/consultation", (req, res) => {
  const { name, phone, projectType, area, city, notes } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: "姓名和联系电话为必填项" });
  }
  
  // Add to simulated log
  simulatedAdminData.recentSystemLogs.unshift({
    id: Date.now(),
    time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    action: `收到新官网预约: ${name} (${projectType || '综合工程'}, ${area || 0}㎡)`,
    location: city || '未填写城市'
  });

  return res.json({
    success: true,
    message: "预约成功！我们的资深工程总监与主案设计师将在 2 小时内为您提供一对一方案与预算测算。",
    leadId: `ZJ-${Math.floor(100000 + Math.random() * 900000)}`
  });
});

// API: AI Architectural & Decoration Budget Advisor Endpoint (Gemini-Powered)
app.post("/api/ai/calculate-budget", async (req, res) => {
  try {
    const { projectType, area, grade, style, location, specialRequirements } = req.body;
    
    const areaNum = parseFloat(area) || 100;
    
    // Base heuristic math to combine with AI insights
    let unitPrice = 1800; // base RMB per sqm
    if (projectType === 'commercial') unitPrice = 2800;
    if (projectType === 'office') unitPrice = 2200;
    if (projectType === 'villa') unitPrice = 4500;
    if (projectType === 'civil') unitPrice = 3200;
    
    if (grade === 'luxury') unitPrice *= 1.4;
    if (grade === 'ultra_luxury') unitPrice *= 2.0;

    const totalEstimate = Math.round(areaNum * unitPrice);
    
    const ai = getAiClient();
    let aiAdvice = "";

    if (ai) {
      try {
        const prompt = `你是一位拥有20年经验的国家一级注册建筑师兼高级装饰工程总监。
请根据以下客户需求，提供专业、高精度的工程与装饰造价分析建议：
- 项目类型：${projectType || '装饰设计与施工'}
- 建筑/套内面积：${areaNum} 平方米
- 装修/施工标准：${grade || '精装品质'}
- 风格/设计导向：${style || '现代极简'}
- 所在地区：${location || '全国重点城市'}
- 特殊需求：${specialRequirements || '无'}

请在150字以内给出：
1. 建议施工周期与BIM预估节点
2. 主材选型建议（如微水泥/石材/幕墙/暖通/智能控制）
3. 成本优化或施工风险防范提示。语言专业、客观、权威。`;

        const response = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: prompt
        });
        
        aiAdvice = response.text || "";
      } catch (err) {
        console.error("Gemini call error:", err);
      }
    }

    if (!aiAdvice) {
      aiAdvice = `建议分三期BIM节点施工：结构与隐蔽工程占比35%，主材与立面面层45%，软装与智能系统20%。推荐采用无缝微水泥与高耐候干挂石材，结合大金中央暖通与施耐德智能控制，可确保施工质量与环保达标。`;
    }

    res.json({
      success: true,
      totalEstimate,
      unitPrice: Math.round(unitPrice),
      breakdown: {
        civilStructure: Math.round(totalEstimate * 0.32),
        materialsDecoration: Math.round(totalEstimate * 0.40),
        mepSmartHome: Math.round(totalEstimate * 0.16),
        designManagement: Math.round(totalEstimate * 0.12)
      },
      estimatedDays: Math.round(Math.sqrt(areaNum) * 7 + (grade === 'ultra_luxury' ? 40 : 20)),
      aiAdvice
    });
  } catch (error) {
    console.error("Budget estimation error:", error);
    res.status(500).json({ error: "工程预算计算失败，请稍后重试" });
  }
});

// Vite middleware and static serving setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[筑景官网] Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
