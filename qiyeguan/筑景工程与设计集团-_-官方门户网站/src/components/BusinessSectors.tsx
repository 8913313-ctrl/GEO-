import React, { useState } from 'react';
import { BUSINESS_SECTORS } from '../data/mockData';
import { Building, Home, Building2, RefreshCw, CheckCircle2, Shield, ArrowRight } from 'lucide-react';

interface BusinessSectorsProps {
  onOpenBooking: () => void;
}

export const BusinessSectors: React.FC<BusinessSectorsProps> = ({ onOpenBooking }) => {
  const [activeTab, setActiveTab] = useState(0);

  const getIcon = (id: string) => {
    switch (id) {
      case 'general-construction': return <Building className="w-5 h-5" />;
      case 'commercial-interior': return <Building2 className="w-5 h-5" />;
      case 'luxury-residential': return <Home className="w-5 h-5" />;
      case 'urban-regeneration': return <RefreshCw className="w-5 h-5" />;
      default: return <Building className="w-5 h-5" />;
    }
  };

  const sector = BUSINESS_SECTORS[activeTab];

  return (
    <section id="business-sectors" className="py-24 bg-[#F9F9F8] border-t border-b border-[#1A1A1A]/10 relative text-[#1A1A1A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-xs uppercase tracking-[0.25em] text-[#C5A27D] font-semibold block font-sans">
            Business Sectors / 四大全案工程领域
          </span>
          <h2 className="text-3xl sm:text-4xl font-light text-[#1A1A1A] font-serif tracking-tight">
            全产业链建造与装饰一体化解决方案
          </h2>
          <div className="w-12 h-[1px] bg-[#C5A27D] mx-auto my-3" />
          <p className="text-[#666666] text-sm sm:text-base leading-relaxed font-sans">
            筑景集团依托特级/一级建筑工程与甲级设计资质，贯穿“规划-建筑总包-室内设计-精工施工-软装机电”全生命周期。
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {BUSINESS_SECTORS.map((sec, idx) => {
            const isActive = idx === activeTab;
            return (
              <button
                key={sec.id}
                onClick={() => setActiveTab(idx)}
                className={`p-5 text-left transition-all duration-300 border flex flex-col justify-between ${
                  isActive
                    ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white shadow-md'
                    : 'bg-white border-[#1A1A1A]/15 text-[#555555] hover:border-[#1A1A1A]/40 hover:text-[#1A1A1A]'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2.5 ${isActive ? 'bg-[#C5A27D] text-[#1A1A1A]' : 'bg-[#F4F4F0] text-[#1A1A1A]'}`}>
                    {getIcon(sec.id)}
                  </div>
                  <span className={`text-[10px] font-mono tracking-widest px-2 py-0.5 ${isActive ? 'bg-white/10 text-[#C5A27D]' : 'bg-[#F4F4F0] text-[#777777]'}`}>
                    0{idx + 1}
                  </span>
                </div>
                <div>
                  <h3 className={`font-medium text-sm sm:text-base font-serif ${isActive ? 'text-white' : 'text-[#1A1A1A]'}`}>
                    {sec.title}
                  </h3>
                  <p className={`text-[11px] line-clamp-1 mt-1 font-mono uppercase tracking-wider ${isActive ? 'text-white/70' : 'text-[#888888]'}`}>
                    {sec.enTitle}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Detailed Tab Content Display */}
        <div className="bg-white border border-[#1A1A1A]/10 p-8 sm:p-12 shadow-xs relative">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Column: Text & Qualifications */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="space-y-2">
                <span className="text-xs font-mono text-[#C5A27D] uppercase tracking-[0.2em] font-semibold">
                  {sector.enTitle}
                </span>
                <h3 className="text-2xl sm:text-3xl font-light text-[#1A1A1A] font-serif tracking-tight">
                  {sector.title}
                </h3>
                <p className="text-[#1A1A1A] text-sm font-medium border-l-2 border-[#C5A27D] pl-3 py-1 font-sans">
                  {sector.summary}
                </p>
              </div>

              <p className="text-[#555555] text-sm leading-relaxed font-sans">
                {sector.description}
              </p>

              {/* Technical Highlights */}
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider flex items-center gap-2">
                  <Shield className="w-4 h-4 text-[#C5A27D]" />
                  工程标准与交验要求:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sector.highlights.map((hl, i) => (
                    <div key={i} className="flex items-start gap-2 bg-[#F9F9F8] border border-[#1A1A1A]/10 p-3 text-xs text-[#333333]">
                      <CheckCircle2 className="w-4 h-4 text-[#C5A27D] shrink-0 mt-0.5" />
                      <span>{hl}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Corporate Qualification Badges */}
              <div className="pt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-[#777777] uppercase tracking-wider">核准资质:</span>
                {sector.qualifications.map((qual, i) => (
                  <span key={i} className="px-3 py-1 bg-[#F4F4F0] text-[#1A1A1A] text-[11px] border border-[#1A1A1A]/10 font-medium tracking-wide">
                    {qual}
                  </span>
                ))}
              </div>

              {/* Consultation Action Button */}
              <div className="pt-4">
                <button
                  onClick={onOpenBooking}
                  className="px-7 py-3.5 border border-[#1A1A1A] bg-[#1A1A1A] text-white hover:bg-[#C5A27D] hover:border-[#C5A27D] text-xs font-medium uppercase tracking-widest flex items-center gap-2.5 transition-colors shadow-xs"
                >
                  <span>获取{sector.title}方案与报价</span>
                  <ArrowRight className="w-4 h-4 text-white" />
                </button>
              </div>

            </div>

            {/* Right Column: Image & Overlay Spec Card */}
            <div className="lg:col-span-5 relative">
              <div className="relative overflow-hidden border border-[#1A1A1A]/15 shadow-sm group">
                <img
                  src={sector.image}
                  alt={sector.title}
                  className="w-full h-80 sm:h-96 object-cover group-hover:scale-105 transition-transform duration-700"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A]/80 via-transparent to-transparent opacity-80" />
                
                {/* Visual Badge overlay */}
                <div className="absolute bottom-4 left-4 right-4 bg-white/95 backdrop-blur-md border border-[#1A1A1A]/15 p-4 space-y-1 text-[#1A1A1A]">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-serif font-bold">{sector.title} · BIM 样板</span>
                    <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 border border-emerald-200 uppercase tracking-wider font-mono font-medium">
                      100% 验收合规
                    </span>
                  </div>
                  <p className="text-[11px] text-[#666666] leading-snug">
                    支持现场实勘、激光测距、方案预拆演演练与全案施工监控。
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </section>
  );
};
