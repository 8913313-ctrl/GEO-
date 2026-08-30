import React, { useState } from 'react';
import { AGENCY_BRANDS_DETAILS, COMPANY_INFO } from '../data/upsData';
import { AgencyBrandDetail } from '../types';
import {
  ShieldCheck,
  Award,
  CheckCircle2,
  ChevronRight,
  FileText,
  Sparkles,
  Zap,
  Building,
  HelpCircle,
  ExternalLink,
  ShieldAlert,
  Layers,
  Wrench,
  TrendingUp,
  Cpu
} from 'lucide-react';

interface AgencyBrandsSectionProps {
  onOpenQuoteModalWithData?: (data: any) => void;
  onOpenAiConsultantWithData?: (data: any) => void;
}

export const AgencyBrandsSection: React.FC<AgencyBrandsSectionProps> = ({
  onOpenQuoteModalWithData,
  onOpenAiConsultantWithData
}) => {
  const [selectedBrandId, setSelectedBrandId] = useState<string>('all');
  const [activeCertModal, setActiveCertModal] = useState<AgencyBrandDetail | null>(null);

  const filteredBrands = AGENCY_BRANDS_DETAILS.filter((item) => {
    if (selectedBrandId === 'all') return true;
    return item.id === selectedBrandId;
  });

  const currentBrandForDetail = AGENCY_BRANDS_DETAILS.find((item) => item.id === selectedBrandId) || AGENCY_BRANDS_DETAILS[0];

  return (
    <section id="agency-brands" className="py-16 bg-white text-slate-900 relative border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-16">

        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="h-[2px] w-10 bg-amber-500"></div>
            <span className="text-amber-800 text-xs font-bold uppercase tracking-[0.25em]">山特 • 硕天 • 华为 • 维谛 • 施耐德 等原厂代理直供</span>
            <div className="h-[2px] w-10 bg-amber-500"></div>
          </div>
          <h2 className="text-3xl sm:text-4xl font-light text-slate-900 tracking-tight font-display">
            山东新硕捷 <span className="font-black text-amber-600 uppercase">代理品牌实力与授权资质展示</span>
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
            严选国际与国内顶尖 UPS 及蓄电池品牌。山东新硕捷作为具备 14 项落地能力的工程服务商，提供 100% 原厂正品追溯、工厂代理低价代采与 7×24H 本地应急响应。
          </p>
        </div>

        {/* Brand Selection Tabs */}
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => setSelectedBrandId('all')}
            className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all rounded-none ${
              selectedBrandId === 'all'
                ? 'bg-amber-500 text-slate-950 shadow-md'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 border border-slate-300'
            }`}
          >
            全部代理品牌 (7大矩阵)
          </button>
          {AGENCY_BRANDS_DETAILS.map((brand) => (
            <button
              key={brand.id}
              onClick={() => setSelectedBrandId(brand.id)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all rounded-none border ${
                selectedBrandId === brand.id
                  ? 'bg-slate-900 text-amber-400 border-slate-800 shadow-md'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400 hover:text-slate-900'
              }`}
            >
              {brand.brandName} ({brand.brandEnName})
            </button>
          ))}
        </div>

        {/* Major Brand Cards List */}
        <div className="space-y-12">
          {filteredBrands.map((brand) => (
            <div
              key={brand.id}
              className="bg-slate-50 border border-slate-200 hover:border-amber-400 transition-all rounded-none shadow-xs p-6 sm:p-8 space-y-6"
            >
              {/* Top Header Row */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="bg-amber-500 text-slate-950 font-black text-xs px-2.5 py-0.5 uppercase tracking-widest font-mono">
                      {brand.logoTag}
                    </span>
                    <span className="bg-slate-900 text-amber-400 text-xs font-mono px-2.5 py-0.5 border border-slate-800">
                      授权编号: {brand.authCode}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">发证机构：{brand.authIssuer}</span>
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-slate-900 font-display uppercase tracking-tight mt-1">
                    {brand.brandName} <span className="text-amber-600 font-light font-mono">({brand.brandEnName})</span> 电源保障系统
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    📍 行业地位：{brand.marketPosition}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setActiveCertModal(brand)}
                    className="px-3.5 py-2 text-xs font-bold uppercase tracking-wider bg-white text-slate-800 hover:bg-slate-100 border border-slate-300 flex items-center gap-1.5"
                  >
                    <Award className="w-4 h-4 text-amber-600" />
                    <span>查看授权书说明</span>
                  </button>
                  <button
                    onClick={() => {
                      if (onOpenQuoteModalWithData) {
                        onOpenQuoteModalWithData({ prompt: `我想获取【${brand.brandName} (${brand.brandEnName})】原厂代理低价代采清单与施工配置预算` });
                      }
                    }}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-widest bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-sm"
                  >
                    索取此品牌代理底价
                  </button>
                </div>
              </div>

              {/* Grid 2 Cols: Left Info & Certs | Right Technical Advantages */}
              <div className="grid lg:grid-cols-12 gap-8 items-start">
                
                {/* Left 5 Cols: Core Series & Qualification badges */}
                <div className="lg:col-span-5 space-y-5">
                  {/* Brand Representative Image */}
                  <div className="relative h-44 overflow-hidden border border-slate-200">
                    <img
                      src={brand.image}
                      alt={brand.brandName}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3">
                      <span className="text-[10px] text-amber-400 font-mono font-bold uppercase block">代表推荐型号</span>
                      <p className="text-xs font-bold text-white uppercase">{brand.representativeModel}</p>
                    </div>
                  </div>

                  {/* Core Series */}
                  <div className="bg-white p-4 border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-widest font-mono block border-b border-slate-100 pb-1">
                      📦 代理主推产品系列:
                    </span>
                    <ul className="space-y-1.5 text-xs text-slate-700 font-mono">
                      {brand.coreSeries.map((seriesItem, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0" />
                          <span>{seriesItem}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Certifications badges */}
                  <div className="space-y-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-widest font-mono block">
                      🏅 原厂资质与合规认证:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {brand.certifications.map((cert, idx) => (
                        <span key={idx} className="bg-amber-50 text-amber-900 border border-amber-300 text-[11px] font-mono px-2.5 py-1 font-bold">
                          ✓ {cert}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Genuine Guarantee Statement */}
                  <div className="bg-emerald-50 border border-emerald-300 p-3.5 space-y-1 text-xs">
                    <span className="text-emerald-900 font-bold uppercase tracking-wider flex items-center gap-1.5 font-mono">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      100% 正品原装防护承诺:
                    </span>
                    <p className="text-emerald-950 leading-relaxed text-[11px]">
                      {brand.genuineGuarantee}
                    </p>
                  </div>
                </div>

                {/* Right 7 Cols: Technical Advantage Analysis */}
                <div className="lg:col-span-7 space-y-5">
                  <div className="bg-white p-5 border border-slate-200 space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2.5">
                      <Cpu className="w-5 h-5 text-amber-600" />
                      <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider font-display">
                        【{brand.brandName}】架构技术优势深度分析
                      </h4>
                    </div>

                    <div className="grid gap-3 text-xs">
                      {brand.technicalAdvantages.map((adv, idx) => (
                        <div key={idx} className="bg-slate-50 p-3 border border-slate-200 leading-relaxed text-slate-800">
                          {adv}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Suitable Scenarios */}
                  <div className="bg-slate-900 text-white p-4 border border-slate-800 space-y-2 text-xs">
                    <span className="text-amber-400 font-bold uppercase tracking-wider font-mono block">
                      🎯 最佳推荐部署场景:
                    </span>
                    <div className="grid sm:grid-cols-2 gap-2 text-slate-300 font-mono">
                      {brand.suitableScenarios.map((sc, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>{sc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ))}
        </div>

        {/* Why Choose Agency Products: Comparison Matrix */}
        <div id="agency-advantages" className="bg-white border border-slate-200 p-6 sm:p-8 space-y-8 shadow-xs">
          <div className="text-center max-w-3xl mx-auto space-y-2">
            <span className="text-amber-800 text-xs font-bold uppercase tracking-[0.25em] font-mono">WHY CHOOSE AUTHORIZED AGENCY</span>
            <h3 className="text-2xl sm:text-3xl font-light text-slate-900 font-display">
              为什么选择 <span className="font-black text-amber-600 uppercase">山东新硕捷代理原厂产品</span>？技术优势对比
            </h3>
            <p className="text-slate-600 text-xs sm:text-sm">
              相比非授权电商渠道或二手水货贩售商，山东新硕捷提供“原厂设备代采 + 14项落地施工 + 本地7×24H贴身维保”一体化全包服务。
            </p>
          </div>

          {/* Side by Side Comparison Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse border border-slate-300">
              <thead>
                <tr className="bg-slate-900 text-white font-mono">
                  <th className="p-3.5 border border-slate-700 w-1/5">对比核心维度</th>
                  <th className="p-3.5 border border-slate-700 w-2/5 text-amber-400 bg-slate-950/80 font-bold">
                    ✅ 山东新硕捷 原厂代理正品落地
                  </th>
                  <th className="p-3.5 border border-slate-700 w-2/5 text-slate-400 bg-slate-800">
                    ❌ 非授权渠道 / 二手水货贩售商
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-sans">
                
                <tr className="hover:bg-slate-50">
                  <td className="p-3.5 border border-slate-200 font-bold text-slate-900 bg-slate-50 font-mono">
                    1. 设备来源与防伪追溯
                  </td>
                  <td className="p-3.5 border border-slate-200 text-emerald-900 bg-emerald-50/40">
                    <strong>100% 原厂库房直发：</strong>附带有官方条码、SN 绑定一机一码防伪验证，可直接拨打山特/硕天/华为官方热线验真。
                  </td>
                  <td className="p-3.5 border border-slate-200 text-slate-600 bg-slate-50">
                    来源不明、SN 条码常被抹除抹掉；多为翻新机、水货或库存尾货，无法获得官方验真。
                  </td>
                </tr>

                <tr className="hover:bg-slate-50">
                  <td className="p-3.5 border border-slate-200 font-bold text-slate-900 bg-slate-50 font-mono">
                    2. 代采购成本与多品牌对比
                  </td>
                  <td className="p-3.5 border border-slate-200 text-emerald-900 bg-emerald-50/40">
                    <strong>工厂代理直供底价：</strong>无中间商加价。工程师根据预算客观对比山特、硕天、华为、科士达等，帮客户省钱 15%-30%。
                  </td>
                  <td className="p-3.5 border border-slate-200 text-slate-600 bg-slate-50">
                    单一品牌高价推销或开低价吸引，随后以“配件费”、“安装费”漫天要价加价。
                  </td>
                </tr>

                <tr className="hover:bg-slate-50">
                  <td className="p-3.5 border border-slate-200 font-bold text-slate-900 bg-slate-50 font-mono">
                    3. 现场工程施工与调测
                  </td>
                  <td className="p-3.5 border border-slate-200 text-emerald-900 bg-emerald-50/40">
                    <strong>14项全流程包干交付：</strong>包含现场勘察、配电线缆计算、防雷接地、零地电压调测及双路主备切电演练。
                  </td>
                  <td className="p-3.5 border border-slate-200 text-slate-600 bg-slate-50">
                    “只卖裸机硬件不管施工”；随意接线极易引发短路、零地电压过高导致服务器频繁死机。
                  </td>
                </tr>

                <tr className="hover:bg-slate-50">
                  <td className="p-3.5 border border-slate-200 font-bold text-slate-900 bg-slate-50 font-mono">
                    4. 7×24H 应急响应与备机
                  </td>
                  <td className="p-3.5 border border-slate-200 text-emerald-900 bg-emerald-50/40">
                    <strong>淄博及山东本地 2 小时响应：</strong>自有工程师团队现场故障排除，备有原厂模块与应急备用机，实现接管保障。
                  </td>
                  <td className="p-3.5 border border-slate-200 text-slate-600 bg-slate-50">
                    售后互相推诿，返厂维修耗时几周，期间机房完全处于无保护裸奔状态。
                  </td>
                </tr>

                <tr className="hover:bg-slate-50">
                  <td className="p-3.5 border border-slate-200 font-bold text-slate-900 bg-slate-50 font-mono">
                    5. 蓄电池安全与质量检测
                  </td>
                  <td className="p-3.5 border border-slate-200 text-emerald-900 bg-emerald-50/40">
                    <strong>原厂全新高倍率电池：</strong>圣阳/理士/汤浅直供，承诺假一赔百，携带内阻测试仪免费上门排查检修与环保替换。
                  </td>
                  <td className="p-3.5 border border-slate-200 text-slate-600 bg-slate-50">
                    充斥翻新电池、回收铅酸壳体二次封装，极其容易发生电池打火膨胀、酸液渗漏及火灾。
                  </td>
                </tr>

              </tbody>
            </table>
          </div>

          {/* 5 Technical Advantage Bullet Blocks */}
          <div className="grid md:grid-cols-3 gap-4 pt-4">
            <div className="bg-slate-50 p-4 border border-slate-200 space-y-2">
              <span className="text-amber-800 text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                正品授权防伪追溯
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                所有山特、硕天、华为等品牌设备均为原厂批号发货，享受厂家与新硕捷双重售后保障。
              </p>
            </div>

            <div className="bg-slate-50 p-4 border border-slate-200 space-y-2">
              <span className="text-amber-800 text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Wrench className="w-4 h-4 text-amber-600" />
                14项落地工程集成
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                不仅是设备销售，新硕捷团队负责缆线选型、防雷接地、柜体就位与断电切电调试包干交付。
              </p>
            </div>

            <div className="bg-slate-50 p-4 border border-slate-200 space-y-2">
              <span className="text-amber-800 text-xs font-bold uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Zap className="w-4 h-4 text-amber-600" />
                淄博及山东 7×24H 现场响应
              </span>
              <p className="text-xs text-slate-600 leading-relaxed">
                淄博大本营快速派工，提供 2 小时应急到场排除故障，备有原厂板卡与替换备机。
              </p>
            </div>
          </div>

        </div>

        {/* CTA Certificate Package Request */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 text-white p-8 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-amber-400 text-xs font-bold uppercase tracking-widest font-mono">
              OFFICIAL AUTHORIZATION PACK & CAD DRAWINGS
            </span>
            <h3 className="text-xl sm:text-2xl font-light font-display">
              需要获取 <span className="font-bold text-amber-400">山特 / 硕天 / 华为 / 维谛 官方授权代理资质证书包</span> 与施工图纸？
            </h3>
            <p className="text-xs text-slate-400">
              技术工程师 15 分钟内可为您提供品牌资质合规白皮书、CAD 施工图及工厂代采底价清单。
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                if (onOpenAiConsultantWithData) {
                  onOpenAiConsultantWithData({ prompt: '请帮我对比山特、硕天和华为在 20kVA 机房电源中的技术参数差异与报价' });
                }
              }}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase tracking-wider border border-slate-700 flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>AI 多品牌比价</span>
            </button>

            <button
              onClick={() => {
                if (onOpenQuoteModalWithData) {
                  onOpenQuoteModalWithData({ prompt: '我想申请获取山特/硕天/华为官方代理授权资质包及代采报价单' });
                }
              }}
              className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-widest shadow-md shadow-amber-500/20"
            >
              一键索取代理资质包
            </button>
          </div>
        </div>

      </div>

      {/* Certificate Modal */}
      {activeCertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white text-slate-900 border border-slate-300 rounded-none max-w-xl w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex justify-between items-start border-b border-slate-200 pb-3">
              <div>
                <span className="text-[10px] text-amber-800 font-bold uppercase tracking-widest font-mono">
                  {activeCertModal.logoTag}
                </span>
                <h3 className="text-xl font-bold text-slate-900 uppercase font-display">
                  {activeCertModal.brandName} ({activeCertModal.brandEnName}) 代理资质说明
                </h3>
              </div>
              <button
                onClick={() => setActiveCertModal(null)}
                className="text-slate-400 hover:text-slate-900 text-sm font-bold border border-slate-300 px-2 py-0.5"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="bg-slate-50 p-3 border border-slate-200 space-y-1">
                <p><strong className="text-slate-500">代理编号：</strong><span className="text-amber-800 font-bold">{activeCertModal.authCode}</span></p>
                <p><strong className="text-slate-500">授权发证主体：</strong>{activeCertModal.authIssuer}</p>
                <p><strong className="text-slate-500">质保模式：</strong>全国原厂联保 + 山东新硕捷本地 7×24H 施工保障</p>
              </div>

              <div className="bg-emerald-50 p-3 border border-emerald-200 space-y-1">
                <span className="text-emerald-900 font-bold uppercase block">防伪追溯提示:</span>
                <p className="text-emerald-950 text-[11px]">
                  {activeCertModal.genuineGuarantee}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => {
                  const bName = activeCertModal.brandName;
                  setActiveCertModal(null);
                  if (onOpenQuoteModalWithData) {
                    onOpenQuoteModalWithData({ prompt: `我想获取【${bName}】官方授权资质包与代采价格表` });
                  }
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold uppercase tracking-widest"
              >
                索取此品牌代理授权文件
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};
