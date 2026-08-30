import React, { useState } from 'react';
import { SUCCESS_CASES } from '../data/upsData';
import { SuccessCase } from '../types';
import { Award, Building2, MapPin, CheckCircle2, Quote, Eye, X, ChevronRight, ShieldAlert, Zap, TrendingUp, Wrench } from 'lucide-react';
import { CasesGridSkeleton } from './SkeletonLoader';

interface SuccessCasesSectionProps {
  onOpenQuoteModalWithData?: (data: any) => void;
}

export const SuccessCasesSection: React.FC<SuccessCasesSectionProps> = ({ onOpenQuoteModalWithData }) => {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedCase, setSelectedCase] = useState<SuccessCase | null>(null);
  const [isCaseLoading, setIsCaseLoading] = useState<boolean>(false);

  const handleTabChange = (tabId: string) => {
    if (tabId === activeTab) return;
    setIsCaseLoading(true);
    setActiveTab(tabId);
    setTimeout(() => {
      setIsCaseLoading(false);
    }, 280);
  };

  const tabs = [
    { id: 'all', label: '全部12大工程案例' },
    { id: 'healthcare', label: '医疗与重症监护' },
    { id: 'industrial', label: '纸业/造纸/铝业/工业' },
    { id: 'finance', label: '金融银行档案室' },
    { id: 'education', label: '学校与教育机房' },
    { id: 'outdoor', label: '环境监测与户外' },
  ];

  const filteredCases = SUCCESS_CASES.filter((item) => {
    if (activeTab === 'all') return true;
    return item.industry === activeTab;
  });

  return (
    <section id="cases" className="py-16 bg-slate-50 text-slate-900 relative border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3 mb-10">
          <div className="flex items-center justify-center gap-3">
            <div className="h-[2px] w-10 bg-amber-500"></div>
            <span className="text-amber-800 text-xs font-bold uppercase tracking-[0.25em]">真实工程现场 & 工厂服务案例</span>
            <div className="h-[2px] w-10 bg-amber-500"></div>
          </div>
          <h2 className="text-3xl sm:text-4xl font-light text-slate-900 tracking-tight font-display">
            山东新硕捷 <span className="font-black text-amber-600 uppercase">12项真实落地工程</span> 展示
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
            覆盖造纸厂、三甲及专科医院、山铝工业基地、银行档案室、重点中学、光纤生产线及野外监测站。山东新硕捷提供设备采购、现场安装接线与维保全流程。
          </p>
        </div>

        {/* Industry Filter Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-4 py-2 rounded-none text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md'
                  : 'bg-white text-slate-700 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Grid of cases */}
        {isCaseLoading ? (
          <CasesGridSkeleton count={filteredCases.length || 4} />
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {filteredCases.map((item) => (
            <div
              key={item.id}
              className="bg-white border border-slate-200 hover:border-amber-500 rounded-none overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 flex flex-col justify-between group"
            >
              {/* Image & Location Badge */}
              <div className="relative h-48 overflow-hidden bg-slate-100 border-b border-slate-200">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
                
                <span className="absolute top-3 right-3 bg-slate-950/90 text-amber-400 text-[10px] font-mono px-2.5 py-1 rounded-none border border-slate-800 flex items-center gap-1 uppercase">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  {item.location}
                </span>

                <div className="absolute bottom-3 left-4 right-4">
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-widest block font-mono">
                    {item.clientName} | {item.capacity}
                  </span>
                  <h3 className="text-base font-bold text-white uppercase font-display mt-0.5 line-clamp-1">
                    {item.title}
                  </h3>
                </div>
              </div>

              {/* Body Content */}
              <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {item.summary}
                  </p>

                  <div className="bg-slate-50 p-2.5 rounded-none border border-slate-200 space-y-1 text-xs">
                    <span className="text-rose-700 text-[10px] font-bold uppercase tracking-wider block font-mono flex items-center gap-1">
                      <ShieldAlert className="w-3 h-3 text-rose-600" />
                      现场挑战:
                    </span>
                    <p className="text-slate-600 text-[11px] line-clamp-2">
                      {item.problemAnalysis}
                    </p>
                  </div>

                  <div className="space-y-1 text-xs">
                    <span className="text-emerald-700 text-[10px] font-bold uppercase tracking-wider block font-mono flex items-center gap-1">
                      <Wrench className="w-3 h-3 text-emerald-600" />
                      新硕捷工程亮点:
                    </span>
                    {item.highlights.map((hl, idx) => (
                      <div key={idx} className="flex items-center gap-1.5 text-slate-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="text-xs">{hl}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Case Action Footer */}
                <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
                  <button
                    onClick={() => setSelectedCase(item)}
                    className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-amber-700 hover:text-amber-600 transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>查看落地方案</span>
                  </button>

                  <button
                    onClick={() => {
                      if (onOpenQuoteModalWithData) {
                        onOpenQuoteModalWithData({ prompt: `我想参考【${item.title}】的方案进行同款电力选型与施工预算` });
                      }
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-none text-[10px] font-bold uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-amber-400"
                  >
                    <span>同款方案询价</span>
                    <ChevronRight className="w-3 h-3 text-amber-400" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          </div>
        )}

      </div>

      {/* Case Detail Modal */}
      {selectedCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
          <div className="bg-white text-slate-900 border border-slate-300 rounded-none max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="flex justify-between items-start pb-4 border-b border-slate-200">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 uppercase tracking-widest font-mono">
                    {selectedCase.clientName}
                  </span>
                  <span className="text-slate-500 text-xs font-mono">| {selectedCase.capacity} | {selectedCase.location}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 uppercase font-display">
                  {selectedCase.title}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCase(null)}
                className="p-1.5 rounded-none text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Case Analysis Body Grid */}
            <div className="space-y-5">
              
              {/* Problem vs Solution Comparison Box */}
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-slate-50 p-4 border border-rose-200 space-y-2">
                  <span className="text-rose-700 text-xs font-bold uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-600" />
                    1. 项目用电痛点与环境
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {selectedCase.problemAnalysis}
                  </p>
                </div>

                <div className="bg-slate-50 p-4 border border-emerald-200 space-y-2">
                  <span className="text-emerald-700 text-xs font-bold uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-emerald-600" />
                    2. 山东新硕捷落地方案
                  </span>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {selectedCase.solutionProvided}
                  </p>
                </div>
              </div>

              {/* Quantified Benefits list */}
              <div className="bg-slate-50 p-4 border border-slate-200 space-y-3">
                <span className="text-amber-800 text-xs font-bold uppercase tracking-widest font-mono block">
                  3. 项目工程交付成果与客户收益
                </span>
                <div className="space-y-2">
                  {selectedCase.quantifiedBenefits.map((benefit, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-800">
                      <span className="w-5 h-5 bg-amber-500 text-slate-950 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                        0{idx + 1}
                      </span>
                      <span className="leading-relaxed">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Modal Action Footer */}
            <div className="pt-4 border-t border-slate-200 flex flex-wrap gap-3">
              <button
                onClick={() => {
                  const caseTitle = selectedCase.title;
                  setSelectedCase(null);
                  if (onOpenQuoteModalWithData) {
                    onOpenQuoteModalWithData({ prompt: `我想获取【${caseTitle}】同规格的现场勘察与代采方案报价` });
                  }
                }}
                className="flex-1 py-3 rounded-none text-xs font-bold uppercase tracking-widest text-slate-950 bg-amber-500 hover:bg-amber-400 text-center shadow-md shadow-amber-500/20"
              >
                索取此案例同款方案与技术采购清单
              </button>
            </div>

          </div>
        </div>
      )}

    </section>
  );
};
