import React, { useState } from 'react';
import { SOLUTIONS } from '../data/upsData';
import { Server, Activity, Factory, Train, ShieldCheck, ChevronRight, CheckCircle2, ArrowUpRight } from 'lucide-react';
import { SolutionDetailSkeleton } from './SkeletonLoader';

interface SolutionsSectionProps {
  onOpenQuoteModalWithData?: (data: any) => void;
}

export const SolutionsSection: React.FC<SolutionsSectionProps> = ({
  onOpenQuoteModalWithData,
}) => {
  const [activeSolutionId, setActiveSolutionId] = useState<string>('datacenter');
  const [isSolutionLoading, setIsSolutionLoading] = useState<boolean>(false);

  const handleTabChange = (solId: string) => {
    if (solId === activeSolutionId) return;
    setIsSolutionLoading(true);
    setActiveSolutionId(solId);
    setTimeout(() => {
      setIsSolutionLoading(false);
    }, 280);
  };

  const activeSolution = SOLUTIONS.find((s) => s.id === activeSolutionId) || SOLUTIONS[0];

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Server': return <Server className="w-5 h-5 text-cyan-400" />;
      case 'Activity': return <Activity className="w-5 h-5 text-emerald-400" />;
      case 'Factory': return <Factory className="w-5 h-5 text-amber-400" />;
      case 'Train': return <Train className="w-5 h-5 text-blue-400" />;
      default: return <ShieldCheck className="w-5 h-5 text-cyan-400" />;
    }
  };

  return (
    <section id="solutions" className="py-20 bg-white text-slate-900 relative border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="flex items-center justify-center gap-3">
            <div className="h-[2px] w-10 bg-amber-500"></div>
            <span className="text-amber-700 text-xs font-bold uppercase tracking-[0.3em]">全行业电力安全防护图谱</span>
            <div className="h-[2px] w-10 bg-amber-500"></div>
          </div>
          <h2 className="text-3xl sm:text-4xl font-light text-slate-900 tracking-tight font-display">
            行业场景化 <span className="font-black text-amber-600 uppercase">UPS 电源解决方案</span>
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
            结合各行业痛点环境，定制涵盖数据中心、医疗抢救、工业车间与户外交通的全方位高可靠供电方案。
          </p>
        </div>

        {/* Industry Selector Tabs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
          {SOLUTIONS.map((sol) => (
            <button
              key={sol.id}
              onClick={() => handleTabChange(sol.id)}
              className={`p-4 rounded-none border text-left transition-all duration-200 flex items-center gap-3 ${
                activeSolutionId === sol.id
                  ? 'bg-white border-amber-500 text-slate-900 shadow-md'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <div className="p-2.5 rounded-none bg-slate-100 border border-slate-200 shrink-0">
                {getIcon(sol.icon)}
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-mono">{sol.industry}</span>
                <span className="text-xs font-bold uppercase block">{sol.title.split('与')[0]}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Selected Solution Detail Card */}
        {isSolutionLoading ? (
          <SolutionDetailSkeleton />
        ) : (
          <div className="bg-white border border-slate-200 rounded-none overflow-hidden shadow-lg grid lg:grid-cols-12 gap-0 animate-in fade-in duration-300">
          
          {/* Left Visual & Summary Column (5 cols) */}
          <div className="lg:col-span-5 relative h-64 lg:h-auto min-h-[320px] overflow-hidden">
            <img
              src={activeSolution.bgImage}
              alt={activeSolution.title}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-transparent" />
            
            <div className="absolute bottom-6 left-6 right-6 space-y-3">
              <span className="bg-amber-500 text-slate-950 font-black text-[10px] px-2.5 py-1 rounded-none uppercase tracking-widest">
                {activeSolution.industry}
              </span>
              <h3 className="text-2xl font-bold text-white uppercase font-display">
                {activeSolution.title}
              </h3>
              <p className="text-slate-300 text-xs leading-relaxed">
                {activeSolution.summary}
              </p>
            </div>
          </div>

          {/* Right Detailed Specs (7 cols) */}
          <div className="lg:col-span-7 p-6 sm:p-8 space-y-6 flex flex-col justify-between bg-white text-slate-900">
            
            <div className="space-y-6">
              {/* Challenges vs Solution Highlights */}
              <div className="grid sm:grid-cols-2 gap-6">
                
                {/* Challenges */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-rose-700 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <span>⚠️ 行业环境核心挑战与痛点</span>
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-700">
                    {activeSolution.challenges.map((chal, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 bg-slate-50 p-2.5 rounded-none border border-slate-200">
                        <span className="text-rose-600 font-bold shrink-0">•</span>
                        <span>{chal}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Solution Highlights */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <span>✅ 山东新硕捷工程落地设计要点</span>
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-700">
                    {activeSolution.features.map((feat, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 bg-slate-50 p-2.5 rounded-none border border-slate-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

              </div>

              {/* Case Study Highlight Box */}
              <div className="bg-slate-50 p-4 rounded-none border border-slate-200 space-y-2">
                <span className="text-[10px] text-amber-700 font-bold uppercase tracking-widest font-mono">典型客户落地成果:</span>
                <p className="text-sm font-bold text-slate-900 uppercase">{activeSolution.caseStudy.client}</p>
                <p className="text-xs text-slate-600 leading-relaxed">{activeSolution.caseStudy.result}</p>
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-mono">推荐产品:</span>
                {activeSolution.recommendedProducts.map((p, idx) => (
                  <span key={idx} className="bg-slate-100 text-amber-800 text-xs px-2.5 py-1 rounded-none border border-slate-300 font-mono font-medium">
                    {p}
                  </span>
                ))}
              </div>

              <button
                onClick={() => {
                  if (onOpenQuoteModalWithData) {
                    onOpenQuoteModalWithData({
                      solutionTitle: activeSolution.title,
                      industry: activeSolution.industry,
                    });
                  }
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-none text-xs font-bold uppercase tracking-widest text-slate-950 bg-cyan-500 hover:bg-cyan-400 shadow-md shadow-cyan-500/20 transition-all"
              >
                <span>定制此行业方案</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

          </div>

        </div>
        )}

      </div>
    </section>
  );
};
