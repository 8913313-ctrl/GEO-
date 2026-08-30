import React from 'react';
import { HERO_IMAGE, COMPANY_INFO } from '../data/upsData';
import { ShieldCheck, Zap, Building, ChevronRight, Activity, Cpu, ArrowUpRight, Award, CheckCircle2, Wrench, PackageCheck } from 'lucide-react';

interface HeroSectionProps {
  onOpenCalculator: () => void;
  onOpenQuoteModal: () => void;
  onOpenAiConsultant: () => void;
  onNavigateToProducts: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onOpenCalculator,
  onOpenQuoteModal,
  onOpenAiConsultant,
  onNavigateToProducts,
}) => {
  return (
    <section id="hero" className="relative bg-gradient-to-b from-slate-100 via-white to-slate-50 text-slate-900 overflow-hidden pt-6 pb-16 border-b border-slate-200">
      {/* Background Image Overlay */}
      <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
        <img
          src={HERO_IMAGE}
          alt="Shandong Xinshuojie Engineering"
          className="w-full h-full object-cover object-center filter grayscale mix-blend-multiply"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-50 via-slate-50/90 to-transparent" />
      </div>

      {/* Grid Pattern */}
      <div 
        className="absolute inset-0 z-0 opacity-30 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.4) 1px, transparent 0)`,
          backgroundSize: '32px 32px'
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-10">
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          
          {/* Left Column: Headline & Value Proposition */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Top Badges */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-[2px] w-12 bg-amber-500"></div>
                <span className="text-amber-800 text-xs font-bold uppercase tracking-[0.25em]">
                  山东省淄博市 • 工厂落地服务商
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none text-[11px] font-bold uppercase tracking-wider bg-white text-slate-800 border border-slate-300 shadow-xs">
                  <Building className="w-3.5 h-3.5 text-amber-600" />
                  山东新硕捷电子科技有限公司
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-none text-[11px] font-bold uppercase tracking-wider bg-white text-emerald-800 border border-emerald-300 shadow-xs">
                  <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                  多品牌原厂代理直供
                </span>
              </div>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-light tracking-tight text-slate-900 leading-[1.15] font-display">
              IDC数据中心基础设施 <br />
              <span className="font-black text-amber-600 uppercase">
                电源保障系统
              </span> <br />
              工厂落地服务商
            </h1>

            {/* Description Subtitle */}
            <p className="text-slate-600 text-sm sm:text-base leading-relaxed max-w-xl">
              代理与供应 <strong className="text-slate-900 font-bold">山特、硕天、华为、维蒂、施耐德、科华、科士达、易事特、山顿</strong> 等UPS电源，及 <strong className="text-slate-900 font-bold">圣阳、理士、汤浅、西恩迪</strong> 等蓄电池。围绕项目提供勘察选型、设计代采、安装施工、电池维保与续保全套落地服务。
            </p>

            {/* Geometric Stat Grid Boxes */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div className="p-3.5 border border-slate-200 bg-white rounded-none hover:border-amber-400 shadow-xs transition-all">
                <div className="text-xl font-bold text-slate-900 font-mono">10+ 品牌</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">原厂授权与合作</div>
              </div>
              <div className="p-3.5 border border-slate-200 bg-white rounded-none hover:border-emerald-400 shadow-xs transition-all">
                <div className="text-xl font-bold text-emerald-600 font-mono">100% 正品</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">厂家直发 / 带增票</div>
              </div>
              <div className="p-3.5 border border-slate-200 bg-white rounded-none hover:border-amber-400 shadow-xs transition-all">
                <div className="text-xl font-bold text-amber-600 font-mono">12+ 行业</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">标杆工程落地</div>
              </div>
              <div className="p-3.5 border border-slate-200 bg-white rounded-none hover:border-blue-400 shadow-xs transition-all">
                <div className="text-xl font-bold text-blue-600 font-mono">24/7 现场</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">工程师应急派工</div>
              </div>
            </div>

            {/* Action CTAs */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={onOpenQuoteModal}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-none text-xs font-bold uppercase tracking-widest text-slate-950 bg-amber-500 hover:bg-amber-400 transition-all shadow-md shadow-amber-500/20"
              >
                <span>获取方案与代采报价</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={onOpenCalculator}
                className="inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-none text-xs font-bold uppercase tracking-widest text-slate-900 bg-white hover:bg-slate-50 border border-slate-300 hover:border-amber-500 shadow-sm transition-all"
              >
                <Cpu className="w-4 h-4 text-emerald-600" />
                <span>容量选型与电池计算</span>
              </button>

              <button
                onClick={onOpenAiConsultant}
                className="inline-flex items-center justify-center gap-2 px-4 py-3.5 rounded-none text-xs font-bold uppercase tracking-wider text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-all"
              >
                <Activity className="w-4 h-4 text-amber-600 animate-pulse" />
                <span>AI选型架构师</span>
              </button>
            </div>
          </div>

          {/* Right Column: Service Provider Interactive Card & Brand Matrix */}
          <div className="lg:col-span-5 space-y-4">
            {/* Dark Tech Box: Service Workflow Highlight */}
            <div className="bg-slate-950 text-white border border-slate-800 rounded-none p-5 shadow-xl relative overflow-hidden space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white tracking-widest uppercase">新硕捷落地服务全流程</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 bg-slate-900 px-2 py-0.5 border border-slate-800 uppercase">
                  工厂现场派工
                </span>
              </div>

              {/* Workflow Step Grid */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-900/90 p-2.5 border border-slate-800">
                  <span className="text-amber-400 font-bold block text-[11px]">01 需求沟通与勘察</span>
                  <p className="text-[10px] text-slate-400 mt-1">现场测算负载、进线容量与场地条件</p>
                </div>
                <div className="bg-slate-900/90 p-2.5 border border-slate-800">
                  <span className="text-amber-400 font-bold block text-[11px]">02 多品牌比价选型</span>
                  <p className="text-[10px] text-slate-400 mt-1">山特/硕天/华为按预算方案配选</p>
                </div>
                <div className="bg-slate-900/90 p-2.5 border border-slate-800">
                  <span className="text-amber-400 font-bold block text-[11px]">03 设备供应与接线</span>
                  <p className="text-[10px] text-slate-400 mt-1">原厂直供，配电柜及线路就位施工</p>
                </div>
                <div className="bg-slate-900/90 p-2.5 border border-slate-800">
                  <span className="text-amber-400 font-bold block text-[11px]">04 调试维保续保</span>
                  <p className="text-[10px] text-slate-400 mt-1">电池组检修更换与 7×24H 维保</p>
                </div>
              </div>

              {/* Location Tag */}
              <div className="p-2.5 bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 flex items-center justify-between">
                <span className="text-slate-400">公司基址:</span>
                <span className="text-amber-300 font-bold">淄博市张店区世源大厦1210房</span>
              </div>
            </div>

            {/* Brand Logo Showcase Box */}
            <div className="bg-white p-4 border border-slate-200 rounded-none space-y-2">
              <div className="flex justify-between items-center text-xs border-b border-slate-100 pb-2">
                <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" /> 合作代采购品牌矩阵
                </span>
                <span className="text-[10px] text-slate-500">100% 正品保障</span>
              </div>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5 pt-1 text-center font-mono">
                {COMPANY_INFO.upsBrands.slice(0, 9).map((b, idx) => (
                  <div key={idx} className="bg-slate-50 hover:bg-amber-50 border border-slate-200 p-1.5 transition-colors">
                    <div className="text-xs font-bold text-slate-900">{b.name}</div>
                    <div className="text-[9px] text-slate-400 uppercase tracking-tighter">{b.en}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
};
