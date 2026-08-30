import React, { useState } from 'react';
import { Product } from '../types';
import { PRODUCTS, COMPANY_INFO } from '../data/upsData';
import {
  Cpu,
  ShieldCheck,
  Zap,
  Download,
  ChevronRight,
  Filter,
  Eye,
  Layers,
  CheckCircle,
  ArrowRight,
  X,
  Building,
  CheckCircle2,
  HeartPulse,
  Server,
  Factory,
  Sparkles,
  RefreshCw,
  Award
} from 'lucide-react';
import { ProductGridSkeleton } from './SkeletonLoader';

interface ProductCatalogProps {
  onOpenQuoteModalWithData?: (data: any) => void;
  onOpenAiConsultantWithData?: (data: any) => void;
}

export type IndustryType = 'all' | 'medical' | 'datacenter' | 'industrial';

interface IndustryOption {
  id: IndustryType;
  label: string;
  name: string;
  badge: string;
  description: string;
  recommendedUps: string;
  recommendedBattery: string;
  keyFeatures: string[];
  quotePrompt: string;
}

export const ProductCatalog: React.FC<ProductCatalogProps> = ({
  onOpenQuoteModalWithData,
  onOpenAiConsultantWithData,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedBrand, setSelectedBrand] = useState<string>('all');
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryType>('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isCategoryLoading, setIsCategoryLoading] = useState<boolean>(false);

  const handleIndustrySelect = (ind: IndustryType) => {
    if (ind === selectedIndustry) return;
    setIsCategoryLoading(true);
    setSelectedIndustry(ind);
    setTimeout(() => {
      setIsCategoryLoading(false);
    }, 280);
  };

  const handleCategorySelect = (catId: string) => {
    if (catId === selectedCategory) return;
    setIsCategoryLoading(true);
    setSelectedCategory(catId);
    setTimeout(() => {
      setIsCategoryLoading(false);
    }, 280);
  };

  const handleBrandSelect = (brandName: string) => {
    if (brandName === selectedBrand) return;
    setIsCategoryLoading(true);
    setSelectedBrand(brandName);
    setTimeout(() => {
      setIsCategoryLoading(false);
    }, 280);
  };

  const resetAllFilters = () => {
    setIsCategoryLoading(true);
    setSelectedCategory('all');
    setSelectedBrand('all');
    setSelectedIndustry('all');
    setTimeout(() => {
      setIsCategoryLoading(false);
    }, 280);
  };

  const categories = [
    { id: 'all', label: '全部分类' },
    { id: 'ups', label: 'UPS不间断电源主组' },
    { id: 'battery', label: '阀控铅酸 & 锂电池组' },
    { id: 'eps-stabilizer', label: 'EPS应急电源 & 稳压器' },
    { id: 'idc-storage', label: '数据中心 & 储能柜' },
  ];

  const brands = [
    'all',
    '山特',
    '硕天',
    '华为',
    '维谛',
    '科士达',
    '圣阳',
    '理士',
    '汤浅',
    '新硕捷工程'
  ];

  const industryData: Record<Exclude<IndustryType, 'all'>, IndustryOption> = {
    medical: {
      id: 'medical',
      label: '🏥 医疗卫生行业',
      name: '医疗诊断、生化检验与手术重症保障',
      badge: '0ms无缝切换 • 高纯正弦波 • 零地电压<1V',
      description: '针对 ICU 重症监护室、生化分析仪、口腔 CBCT、CT 影像诊所及手术室，防范微浪涌与杂波干扰，零中断护航生命救治设备。',
      recommendedUps: '硕天 CyberPower OLS3000E 在线双变换 / 山特 C10KS 城堡系列 / 维谛 Liebert ITA2',
      recommendedBattery: '圣阳 / 理士 12V 100Ah/200Ah 阻燃密封铅酸高倍率电池柜 (备电 1-4 小时)',
      keyFeatures: [
        '⚡ 0ms 物理零切换：市电断电无缝交接，避免生化分析仪与监护仪数据丢失死机',
        '🩺 零地电压稳定 < 1V：消减电磁杂波干扰，保障高精度传感器生理电信号检测',
        '🔥 UL94-V0 阻燃电池柜配电：符合医院卫生与消防部门安规强制要求'
      ],
      quotePrompt: '我想获取【医疗卫生行业（ICU/诊断影像/检验科）】全套UPS及配套电池组工程代采报价单'
    },
    datacenter: {
      id: 'datacenter',
      label: '🖥️ 数据中心/机房',
      name: 'IDC 数据中心 & 企业云计算算力机房',
      badge: 'N+X热插拔 • 97.5%超高效率 • AI故障预警',
      description: '面向企业服务器集群、政务云数据中心及网络枢纽局，采用全模块化热插拔架构，极高功率密度，低 PUE 节能减排。',
      recommendedUps: '华为 HUAWEI UPS5000-E 模块化电源 / 科士达 YMK 模块化系列 / 维谛 Liebert ITA2 机架式',
      recommendedBattery: '华为 SmartLi 智能磷酸铁锂电池包 / 圣阳 12V 200Ah 长寿命高密电池柜 (备电 30-120 分钟)',
      keyFeatures: [
        '🔄 5分钟在线热插拔：单个功率模块故障在线在线拔插替换，无需停机维护',
        '🧠 iPower AI 故障预警：实时算法监测风扇寿命、母线电容及电池内阻劣化',
        '🌱 节能休眠低 PUE：轻载 20% 负荷下保持 96.5% 高效率，大幅降低空调冷却电费'
      ],
      quotePrompt: '我想获取【IDC数据中心与算力服务器机房】全模块化UPS与智能电池组落地施工报价单'
    },
    industrial: {
      id: 'industrial',
      label: '🏭 工业制造/工矿',
      name: '工业制造车间、PLC控制柜与复杂电网',
      badge: '加厚三防漆 • 隔离电机反电动势 • 工频防腐',
      description: '针对山铝/造纸/玻纤/芯片生产线与 PLC 自动化控制柜，配有加厚电路板三防漆与工频隔离变压器，抵御电焊机与重型电机冲击。',
      recommendedUps: '维谛 Liebert ITA2 (加厚三防漆工业版) / 科华/易事特 工频隔离型 UPS / 新硕捷全自动三相稳压器',
      recommendedBattery: '防爆抗震型 12V 100Ah/200Ah 工业胶体/铅酸密封电池柜 (备电 2-8 小时)',
      keyFeatures: [
        '🛡️ 加厚电路板三防漆涂层：严密隔绝工业油污、金属酸碱粉尘与高湿气体',
        '⚡ 阻断电机反电动势冲击：内置加厚工频隔离变压器，完全隔离大功率启停浪涌',
        '🏭 强悍电网抗骤降能力：兼容柴油发电机频率漂移与乡镇工业区频繁闪络'
      ],
      quotePrompt: '我想获取【工业制造车间/PLC自动化控制柜】防护型UPS及配电稳压全套方案报价'
    }
  };

  const filteredProducts = PRODUCTS.filter((p) => {
    const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
    const matchBrand = selectedBrand === 'all' || p.brand.includes(selectedBrand);
    const matchIndustry = selectedIndustry === 'all' || (p.industryTags && p.industryTags.includes(selectedIndustry));
    return matchCat && matchBrand && matchIndustry;
  });

  return (
    <section id="products" className="py-16 bg-slate-50 text-slate-900 relative border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-[2px] w-10 bg-amber-500"></div>
              <span className="text-amber-800 text-xs font-bold uppercase tracking-[0.25em]">品牌代理代采 & 落地安装库</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-light text-slate-900 tracking-tight font-display">
              多品牌代理 <span className="font-black text-amber-600 uppercase">UPS电源与电池</span> 展示中心
            </h2>
            <p className="text-slate-600 text-xs sm:text-sm mt-2 max-w-2xl leading-relaxed">
              山东新硕捷直供山特、硕天、华为、维谛、施耐德、科士达、圣阳、理士等原厂设备。全系正品保障，配有专业工程师提供现场勘察、线路安装调试与维保续保。
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                className={`px-3.5 py-2 rounded-none text-xs font-bold uppercase tracking-wider transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                    : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-300 shadow-xs'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* ========================================================= */}
        {/* INDUSTRY SOLUTION QUICK SWITCHER ('按行业选配方案'快速切换器) */}
        {/* ========================================================= */}
        <div className="bg-slate-900 text-white p-5 sm:p-7 border border-slate-800 shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="bg-amber-500 text-slate-950 p-2 font-mono font-black text-xs uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>行业选配</span>
              </div>
              <div>
                <h3 className="text-lg sm:text-xl font-bold uppercase font-display text-white tracking-wide flex items-center gap-2">
                  <span>按行业选配方案快速切换器</span>
                </h3>
                <p className="text-xs text-slate-400">
                  选择您的核心业务场景，系统自动匹配并推荐最优 UPS 选型及配套电池柜方案：
                </p>
              </div>
            </div>

            {selectedIndustry !== 'all' && (
              <button
                onClick={() => setSelectedIndustry('all')}
                className="text-xs text-amber-400 hover:text-amber-300 underline font-mono flex items-center gap-1 shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>恢复全部行业显示</span>
              </button>
            )}
          </div>

          {/* Industry Selection Buttons Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <button
              onClick={() => handleIndustrySelect('all')}
              className={`p-3.5 text-left border transition-all rounded-none flex items-center justify-between ${
                selectedIndustry === 'all'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md'
                  : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Layers className="w-4 h-4 shrink-0" />
                <div>
                  <div className="text-xs font-bold uppercase">🌐 全部行业标准库</div>
                  <div className="text-[10px] opacity-80 font-mono">通用多行业全系列</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 opacity-60" />
            </button>

            <button
              onClick={() => handleIndustrySelect('medical')}
              className={`p-3.5 text-left border transition-all rounded-none flex items-center justify-between ${
                selectedIndustry === 'medical'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md'
                  : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-amber-400/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <HeartPulse className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold uppercase">🏥 医疗卫生行业</div>
                  <div className="text-[10px] opacity-80 font-mono">ICU / CBCT / 生化仪</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 opacity-60" />
            </button>

            <button
              onClick={() => handleIndustrySelect('datacenter')}
              className={`p-3.5 text-left border transition-all rounded-none flex items-center justify-between ${
                selectedIndustry === 'datacenter'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md'
                  : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-amber-400/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Server className="w-4 h-4 text-blue-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold uppercase">🖥️ 数据中心/机房</div>
                  <div className="text-[10px] opacity-80 font-mono">IDC / 算力服务器</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 opacity-60" />
            </button>

            <button
              onClick={() => handleIndustrySelect('industrial')}
              className={`p-3.5 text-left border transition-all rounded-none flex items-center justify-between ${
                selectedIndustry === 'industrial'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md'
                  : 'bg-slate-950/80 text-slate-300 border-slate-800 hover:border-amber-400/60 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Factory className="w-4 h-4 text-amber-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold uppercase">🏭 工业制造/工矿</div>
                  <div className="text-[10px] opacity-80 font-mono">车间 / PLC / 山铝造纸</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 opacity-60" />
            </button>
          </div>

          {/* Active Industry Recommendation Detail Card */}
          {selectedIndustry !== 'all' && (
            <div className="bg-slate-950 border border-amber-500/50 p-5 sm:p-6 space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-3">
                <div>
                  <span className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-mono px-2 py-0.5 font-bold uppercase tracking-widest inline-block mb-1">
                    {industryData[selectedIndustry].badge}
                  </span>
                  <h4 className="text-lg font-bold text-white uppercase font-display flex items-center gap-2">
                    <span>【系统自动推荐】{industryData[selectedIndustry].name}专属配电方案</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    {industryData[selectedIndustry].description}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      if (onOpenQuoteModalWithData) {
                        onOpenQuoteModalWithData({ prompt: industryData[selectedIndustry].quotePrompt });
                      }
                    }}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black uppercase tracking-widest shadow-md"
                  >
                    一键索取该行业报价与工程图
                  </button>
                  <button
                    onClick={() => {
                      if (onOpenAiConsultantWithData) {
                        onOpenAiConsultantWithData({ prompt: `请问针对【${industryData[selectedIndustry].name}】，山东新硕捷在工程现场有什么具体的配电防雷和电池柜配平建议？` });
                      }
                    }}
                    className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold uppercase tracking-wider border border-slate-700"
                  >
                    AI 架构师解答
                  </button>
                </div>
              </div>

              {/* Recommended UPS & Battery Boxes */}
              <div className="grid md:grid-cols-2 gap-4 text-xs font-mono">
                <div className="bg-slate-900/90 p-3.5 border border-slate-800 space-y-1">
                  <span className="text-amber-400 font-bold uppercase tracking-wider block">
                    🔌 推荐匹配 UPS 系列:
                  </span>
                  <p className="text-slate-200 leading-relaxed font-sans">
                    {industryData[selectedIndustry].recommendedUps}
                  </p>
                </div>

                <div className="bg-slate-900/90 p-3.5 border border-slate-800 space-y-1">
                  <span className="text-emerald-400 font-bold uppercase tracking-wider block">
                    🔋 推荐配套蓄电池组方案:
                  </span>
                  <p className="text-slate-200 leading-relaxed font-sans">
                    {industryData[selectedIndustry].recommendedBattery}
                  </p>
                </div>
              </div>

              {/* 3 Key Features */}
              <div className="grid sm:grid-cols-3 gap-3 pt-1 text-xs">
                {industryData[selectedIndustry].keyFeatures.map((feat, idx) => (
                  <div key={idx} className="bg-slate-900/60 p-2.5 border border-slate-800 text-slate-300 leading-relaxed">
                    {feat}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Brand Selector Bar & Current Filter Tag Indicator */}
        <div className="p-3 bg-white border border-slate-200 rounded-none flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-slate-500 font-bold px-2 py-1 flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-amber-600" /> 按授权品牌筛选:
            </span>
            {brands.map((b) => (
              <button
                key={b}
                onClick={() => handleBrandSelect(b)}
                className={`px-3 py-1 font-mono text-xs font-bold transition-all ${
                  selectedBrand === b
                    ? 'bg-slate-900 text-amber-400 border border-slate-900'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {b === 'all' ? '全部品牌' : b}
              </button>
            ))}
          </div>

          {(selectedIndustry !== 'all' || selectedCategory !== 'all' || selectedBrand !== 'all') && (
            <div className="flex items-center gap-2 text-xs font-mono shrink-0">
              <span className="bg-amber-100 text-amber-900 px-2 py-1 font-bold border border-amber-300">
                已精选匹配 {filteredProducts.length} 款产品
              </span>
              <button
                onClick={resetAllFilters}
                className="text-slate-500 hover:text-slate-900 underline"
              >
                重置过滤器
              </button>
            </div>
          )}
        </div>

        {/* Flagship Product Spotlight Card */}
        {selectedIndustry === 'all' && selectedCategory === 'all' && selectedBrand === 'all' && (
          <div className="bg-white border-2 border-amber-500/60 p-6 sm:p-8 relative overflow-hidden shadow-lg">
            <div className="absolute top-0 right-0 bg-amber-500 text-slate-950 font-black text-[10px] px-3 py-1 uppercase tracking-widest font-mono shadow-sm">
              山东新硕捷 工程主推款
            </div>

            <div className="grid lg:grid-cols-12 gap-8 items-center">
              {/* Left Info */}
              <div className="lg:col-span-7 space-y-4">
                <div>
                  <span className="text-xs text-amber-700 font-mono font-bold uppercase tracking-widest block mb-1">
                    硕天 CyberPower 原厂授权直供 / 在线双变换
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 uppercase font-display tracking-tight">
                    硕天 OLS3000E 在线双变换 UPS (3000VA / 2700W)
                  </h3>
                  <p className="text-slate-600 text-xs sm:text-sm mt-2 leading-relaxed">
                    专为诊所医疗设备、企业服务器及监控室量身打造。新硕捷电子提供设备原厂正品代采购、淄博及周边现场搬运安装与后备电池组全套配平工程。
                  </p>
                </div>

                {/* 4 Core Advantages Grid */}
                <div className="grid sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-slate-50 p-3 border border-slate-200 space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-800 font-bold text-xs font-mono">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      1. 代理正品保障
                    </div>
                    <p className="text-[11px] text-slate-600">工厂原装全新直发，自带生产批号与二维码防伪验证</p>
                  </div>

                  <div className="bg-slate-50 p-3 border border-slate-200 space-y-1">
                    <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs font-mono">
                      <Zap className="w-4 h-4 text-emerald-600" />
                      2. 0ms 无缝断电保护
                    </div>
                    <p className="text-[11px] text-slate-600">市电断电瞬间零切换，保障医疗诊断与服务器不关机</p>
                  </div>

                  <div className="bg-slate-50 p-3 border border-slate-200 space-y-1">
                    <div className="flex items-center gap-1.5 text-blue-800 font-bold text-xs font-mono">
                      <Building className="w-4 h-4 text-blue-600" />
                      3. 本地化落地安装
                    </div>
                    <p className="text-[11px] text-slate-600">山东新硕捷工程队上门勘察接线、调测零地电压与防雷</p>
                  </div>

                  <div className="bg-slate-50 p-3 border border-slate-200 space-y-1">
                    <div className="flex items-center gap-1.5 text-purple-800 font-bold text-xs font-mono">
                      <CheckCircle2 className="w-4 h-4 text-purple-600" />
                      4. 后续续保与电池更换
                    </div>
                    <p className="text-[11px] text-slate-600">提供 7×24H 淄博及周边售后维修派工与老旧电池组检测</p>
                  </div>
                </div>

                {/* Action */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    onClick={() => setSelectedProduct(PRODUCTS[0])}
                    className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-widest flex items-center gap-2 transition-all shadow-md shadow-amber-500/20"
                  >
                    <Eye className="w-4 h-4" />
                    <span>查看 OLS3000E 详细工程参数</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onOpenQuoteModalWithData) {
                        onOpenQuoteModalWithData({ recommendedModel: '硕天 OLS3000E 在线双变换 UPS' });
                      }
                    }}
                    className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-amber-400 font-bold text-xs uppercase tracking-wider border border-slate-800 flex items-center gap-1.5 shadow-sm"
                  >
                    <span>索取代理特惠底价与配电方案</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Right Product Image Spotlight */}
              <div className="lg:col-span-5 relative h-64 lg:h-full min-h-[220px] bg-slate-900 border border-slate-800 overflow-hidden shadow-md">
                <img
                  src="https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=800&q=80"
                  alt="CyberPower OLS3000E UPS"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                
                <div className="absolute bottom-4 left-4 right-4 flex justify-between items-center bg-slate-950/90 p-3 border border-slate-800 text-xs font-mono text-white">
                  <div>
                    <span className="text-slate-400 text-[10px] block">授权代理品牌</span>
                    <span className="text-amber-400 font-bold">硕天 CyberPower 正品直发</span>
                  </div>
                  <div className="text-right">
                    <span className="text-slate-400 text-[10px] block">山东新硕捷服务</span>
                    <span className="text-emerald-400 font-bold">施工 + 调试 + 续保</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Product Cards Grid */}
        {isCategoryLoading ? (
          <ProductGridSkeleton count={filteredProducts.length || 6} />
        ) : filteredProducts.length === 0 ? (
          <div className="bg-white p-12 border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
              <Filter className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-800 font-display">当前选定组合下暂无对应分类产品</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              建议您重置筛选条件或直接联系新硕捷工程师帮您定制全系列配电清单。
            </p>
            <button
              onClick={resetAllFilters}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-widest"
            >
              一键重置所有过滤器
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
            {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-white border border-slate-200 hover:border-amber-500/60 rounded-none overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 group flex flex-col justify-between"
            >
              {/* Product Image & Badge */}
              <div className="relative h-48 bg-slate-100 overflow-hidden border-b border-slate-200">
                <img
                  src={product.image}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                
                {/* Brand Pill */}
                <span className="absolute top-3 right-3 bg-slate-900/90 text-amber-400 font-mono font-bold text-[10px] px-2 py-0.5 border border-slate-800 uppercase shadow-sm">
                  {product.brand}
                </span>

                {product.badge && (
                  <span className="absolute top-3 left-3 bg-amber-500 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-none uppercase tracking-widest shadow-md">
                    {product.badge}
                  </span>
                )}

                <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
                  <span className="bg-slate-900/90 text-amber-300 text-[11px] font-mono font-bold px-2 py-0.5 rounded-none border border-slate-800">
                    容量: {product.powerRange}
                  </span>
                  <span className="bg-slate-900/90 text-emerald-400 text-[11px] font-mono font-bold px-2 py-0.5 rounded-none border border-slate-800">
                    效率: {product.efficiency}
                  </span>
                </div>
              </div>

              {/* Body Details */}
              <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-amber-700 font-bold tracking-widest uppercase block mb-1 font-mono">
                    {product.series}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-amber-600 transition-colors uppercase">
                    {product.name}
                  </h3>
                  <p className="text-slate-600 text-xs line-clamp-2 mt-2 leading-relaxed">
                    {product.description}
                  </p>
                </div>

                {/* Key specs bullet list */}
                <div className="space-y-1.5 pt-3 border-t border-slate-200 text-xs text-slate-700 font-mono">
                  <div className="flex justify-between">
                    <span className="text-slate-500">拓扑类型:</span>
                    <span className="font-medium text-slate-800">{product.topology}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">落地服务:</span>
                    <span className="font-bold text-emerald-700">新硕捷负责勘察与配电</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">售后承诺:</span>
                    <span className="font-bold text-amber-700">7×24H 原厂续保</span>
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => setSelectedProduct(product)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-none text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-all"
                  >
                    <Eye className="w-3.5 h-3.5 text-amber-600" />
                    <span>查看参数</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onOpenQuoteModalWithData) {
                        onOpenQuoteModalWithData({ recommendedModel: product.name });
                      }
                    }}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-none text-xs font-bold uppercase tracking-wider text-slate-950 bg-amber-500 hover:bg-amber-400 transition-all shadow-xs"
                  >
                    <span>代采询价</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          </div>
        )}

      </div>

      {/* Product Spec Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white text-slate-900 border border-slate-300 rounded-none max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-200">
              <div>
                <span className="text-xs text-amber-700 font-bold uppercase tracking-widest font-mono">
                  【{selectedProduct.brand}】代理代采服务 / {selectedProduct.series}
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase font-display mt-0.5">
                  {selectedProduct.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 rounded-none text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Image & Key points */}
              <div className="space-y-4">
                <div className="h-48 rounded-none overflow-hidden bg-slate-100 border border-slate-200">
                  <img
                    src={selectedProduct.image}
                    alt={selectedProduct.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest mb-2 font-mono">新硕捷代理服务保障:</h4>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {selectedProduct.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-1.5">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Spec Table */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest font-mono">工程与电气指标:</h4>
                <div className="bg-slate-50 rounded-none p-4 border border-slate-200 text-xs space-y-2 font-mono">
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">代理品牌:</span>
                    <span className="text-amber-700 font-bold">{selectedProduct.brand} 原厂</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">输入电压:</span>
                    <span className="text-slate-800 text-right font-medium">{selectedProduct.specs.inputVoltage}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">输出稳压:</span>
                    <span className="text-slate-800 text-right font-medium">{selectedProduct.specs.outputVoltage}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">电池与母线:</span>
                    <span className="text-amber-700 font-medium">{selectedProduct.specs.batteryVoltage}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">外形尺寸:</span>
                    <span className="text-slate-800 font-medium">{selectedProduct.specs.dimensions}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">施工交付:</span>
                    <span className="text-emerald-700 font-bold">由山东新硕捷派员现场安装调试</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5 font-mono">推荐应用场景:</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedProduct.suitableFor.map((app, idx) => (
                      <span key={idx} className="bg-slate-100 text-slate-800 text-[10px] px-2 py-0.5 rounded-none border border-slate-300 font-mono">
                        {app}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer CTAs */}
            <div className="pt-4 border-t border-slate-200 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  if (onOpenQuoteModalWithData) {
                    onOpenQuoteModalWithData({ recommendedModel: selectedProduct.name });
                  }
                }}
                className="flex-1 py-3 rounded-none text-xs font-bold uppercase tracking-widest text-slate-950 bg-amber-500 hover:bg-amber-400 text-center shadow-md shadow-amber-500/20"
              >
                索取《{selectedProduct.name}》优惠代采底价
              </button>

              {onOpenAiConsultantWithData && (
                <button
                  onClick={() => {
                    const prodName = selectedProduct.name;
                    setSelectedProduct(null);
                    onOpenAiConsultantWithData({ prompt: `请问 ${prodName} 在我现场选型配置和电池柜接线有什么注意事项？` });
                  }}
                  className="px-4 py-3 rounded-none text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300"
                >
                  向 AI 工程师咨询此型号
                </button>
              )}
            </div>
          </div>
        </div>
      )}

    </section>
  );
};
