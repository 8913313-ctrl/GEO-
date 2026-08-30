import React, { useState } from 'react';
import { CRAFT_STANDARDS, CRAFT_IMAGE } from '../data/mockData';
import { ShieldCheck, Zap, Box, Wind, CheckCircle, Video, Eye, Cpu, Activity, AlertTriangle, Layers } from 'lucide-react';

interface CraftShowcaseProps {
  onOpenBooking: () => void;
}

export const CraftShowcase: React.FC<CraftShowcaseProps> = ({ onOpenBooking }) => {
  const [selectedCraftIndex, setSelectedCraftIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<'craft' | 'bim' | 'live'>('craft');

  const selectedCraft = CRAFT_STANDARDS[selectedCraftIndex];

  return (
    <section id="craft-showcase" className="py-24 bg-[#F9F9F8] border-t border-b border-[#1A1A1A]/10 relative text-[#1A1A1A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-xs uppercase tracking-[0.25em] text-[#C5A27D] font-semibold block font-sans">
            Craftsmanship & Technology / 精工工艺与BIM
          </span>
          <h2 className="text-3xl sm:text-4xl font-light text-[#1A1A1A] font-serif tracking-tight">
            毫米级工艺细节与 BIM 5D 数字化施工
          </h2>
          <div className="w-12 h-[1px] bg-[#C5A27D] mx-auto my-3" />
          <p className="text-[#666666] text-sm sm:text-base leading-relaxed font-sans">
            隐蔽工程绝不掉以轻心。施工全过程数字化管控，水压打压24小时零下降，墙面冲筋打底确保垂直误差控制在2mm以内。
          </p>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex p-1 bg-[#F4F4F0] border border-[#1A1A1A]/10 gap-1">
            <button
              onClick={() => setActiveTab('craft')}
              className={`px-5 py-2.5 text-xs font-medium uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'craft'
                  ? 'bg-[#1A1A1A] text-white shadow-xs'
                  : 'text-[#666666] hover:text-[#1A1A1A]'
              }`}
            >
              <ShieldCheck className="w-4 h-4 text-[#C5A27D]" />
              <span>德系 108 项隐蔽工艺</span>
            </button>
            <button
              onClick={() => setActiveTab('bim')}
              className={`px-5 py-2.5 text-xs font-medium uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'bim'
                  ? 'bg-[#1A1A1A] text-white shadow-xs'
                  : 'text-[#666666] hover:text-[#1A1A1A]'
              }`}
            >
              <Box className="w-4 h-4 text-[#C5A27D]" />
              <span>BIM 5D 虚拟建造</span>
            </button>
            <button
              onClick={() => setActiveTab('live')}
              className={`px-5 py-2.5 text-xs font-medium uppercase tracking-wider transition-all flex items-center gap-2 ${
                activeTab === 'live'
                  ? 'bg-[#1A1A1A] text-white shadow-xs'
                  : 'text-[#666666] hover:text-[#1A1A1A]'
              }`}
            >
              <Video className="w-4 h-4 text-emerald-600" />
              <span>工地透明云监工</span>
            </button>
          </div>
        </div>

        {/* Tab 1: German Craft Standards */}
        {activeTab === 'craft' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Craft List */}
            <div className="lg:col-span-5 space-y-3">
              {CRAFT_STANDARDS.map((craft, idx) => {
                const isSelected = idx === selectedCraftIndex;
                return (
                  <div
                    key={craft.id}
                    onClick={() => setSelectedCraftIndex(idx)}
                    className={`p-4 cursor-pointer border transition-all duration-300 ${
                      isSelected
                        ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white shadow-md'
                        : 'bg-white border-[#1A1A1A]/10 text-[#555555] hover:border-[#1A1A1A]/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-mono font-bold ${isSelected ? 'text-[#C5A27D]' : 'text-[#777777]'}`}>
                        {craft.category}
                      </span>
                      <span className={`text-[10px] px-2 py-0.5 border uppercase tracking-wider ${isSelected ? 'bg-white/10 text-white border-white/20' : 'bg-[#F4F4F0] text-[#1A1A1A] border-[#1A1A1A]/10'}`}>
                        {craft.tag}
                      </span>
                    </div>
                    <h3 className={`text-sm font-medium font-serif ${isSelected ? 'text-white' : 'text-[#1A1A1A]'}`}>{craft.title}</h3>
                    <p className={`text-xs line-clamp-1 mt-1 font-sans ${isSelected ? 'text-white/70' : 'text-[#777777]'}`}>{craft.description}</p>
                  </div>
                );
              })}
            </div>

            {/* Selected Craft Details Display */}
            <div className="lg:col-span-7 bg-white border border-[#1A1A1A]/10 p-6 sm:p-8 space-y-6 shadow-xs text-[#1A1A1A]">
              
              <div className="flex items-center justify-between pb-4 border-b border-[#1A1A1A]/10">
                <div>
                  <span className="text-xs text-[#C5A27D] font-mono uppercase tracking-widest">{selectedCraft.category}</span>
                  <h3 className="text-xl font-light text-[#1A1A1A] font-serif tracking-tight">{selectedCraft.title}</h3>
                </div>
                <div className="p-3 bg-[#F4F4F0] text-[#1A1A1A] border border-[#1A1A1A]/10">
                  <ShieldCheck className="w-6 h-6 text-[#C5A27D]" />
                </div>
              </div>

              <p className="text-xs text-[#555555] leading-relaxed font-sans">
                {selectedCraft.description}
              </p>

              {/* Strict Acceptance Standards */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-700" />
                  国家级与德系严选验收标准:
                </h4>
                <div className="space-y-2">
                  {selectedCraft.standards.map((std, i) => (
                    <div key={i} className="flex items-start gap-2.5 bg-[#F9F9F8] p-3 border border-[#1A1A1A]/10 text-xs text-[#333333]">
                      <span className="w-5 h-5 bg-[#1A1A1A] text-white font-mono flex items-center justify-center shrink-0 text-[10px]">
                        {i + 1}
                      </span>
                      <span>{std}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quality Checkpoints */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-[#777777] uppercase tracking-wider">质检人员必查节点:</h4>
                <div className="flex flex-wrap gap-2">
                  {selectedCraft.qcCheckpoints.map((qc, i) => (
                    <span key={i} className="px-3 py-1 bg-[#F4F4F0] border border-[#1A1A1A]/10 text-[#1A1A1A] text-xs flex items-center gap-1.5 font-sans">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C5A27D]"></span>
                      {qc}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  onClick={onOpenBooking}
                  className="w-full py-3.5 bg-[#1A1A1A] text-white font-medium text-xs uppercase tracking-widest hover:bg-[#C5A27D] transition-colors"
                >
                  预约看工地实地体验德系工艺
                </button>
              </div>

            </div>

          </div>
        )}

        {/* Tab 2: BIM 5D Virtual Construction */}
        {activeTab === 'bim' && (
          <div className="bg-white border border-[#1A1A1A]/10 p-6 sm:p-10 shadow-xs space-y-8 animate-fadeIn text-[#1A1A1A]">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              
              <div className="lg:col-span-6 space-y-4">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#F4F4F0] text-[#1A1A1A] text-xs border border-[#1A1A1A]/10 uppercase tracking-wider font-mono">
                  <Cpu className="w-3.5 h-3.5 text-[#C5A27D]" />
                  <span>5D BIM Building Information Modeling</span>
                </div>
                <h3 className="text-2xl font-light text-[#1A1A1A] font-serif tracking-tight">
                  开工前预判拆改风险 · 100% 数字化模型交底
                </h3>
                <p className="text-xs text-[#555555] leading-relaxed font-sans">
                  筑景工程采用国际标准的 BIM 5D 虚拟建造系统，将建筑结构、水电管路线路、暖通风管及装配式预制件统一在 3D 数字空间中建模。
                </p>

                <div className="space-y-3 pt-2">
                  <div className="p-4 bg-[#F9F9F8] border border-[#1A1A1A]/10 flex items-start gap-3 text-xs">
                    <Layers className="w-5 h-5 text-[#C5A27D] shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-[#1A1A1A]">碰撞检测零容忍</h4>
                      <p className="text-[#666666] text-[11px] mt-1">提前发现风管与钢梁冲突、下水管道与吊顶避让，施工现场零返工。</p>
                    </div>
                  </div>
                  <div className="p-4 bg-[#F9F9F8] border border-[#1A1A1A]/10 flex items-start gap-3 text-xs">
                    <Box className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-[#1A1A1A]">工厂高精度快装</h4>
                      <p className="text-[#666666] text-[11px] mt-1">根据 BIM 数据直接向工厂下单预制护墙板与钢管件，现场无尘拼装。</p>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={onOpenBooking}
                    className="px-6 py-3 bg-[#1A1A1A] text-white font-medium text-xs uppercase tracking-widest hover:bg-[#C5A27D] transition-colors"
                  >
                    申请体验 BIM 模型交底 demo
                  </button>
                </div>
              </div>

              <div className="lg:col-span-6 relative overflow-hidden border border-[#1A1A1A]/15 shadow-sm">
                <img
                  src={CRAFT_IMAGE}
                  alt="BIM model analysis"
                  className="w-full h-80 object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A]/80 via-transparent to-transparent opacity-80" />
                <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1.5 border border-[#1A1A1A]/10 text-[11px] text-[#1A1A1A] font-mono uppercase tracking-wider">
                  BIM Level 3 实时碰撞分析中
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tab 3: Live Inspection Simulator (云监工) */}
        {activeTab === 'live' && (
          <div className="bg-white border border-[#1A1A1A]/10 p-6 sm:p-8 shadow-xs space-y-6 animate-fadeIn text-[#1A1A1A]">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#1A1A1A]/10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 bg-emerald-600 animate-ping"></span>
                  <h3 className="text-lg font-light text-[#1A1A1A] font-serif">筑景云监工 · 在建工地实时监控中心</h3>
                </div>
                <p className="text-xs text-[#666666] mt-1 font-sans">业主可通过手机App与官网随时查看在建工程实况与环境安全数据。</p>
              </div>

              <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-3 py-1 border border-emerald-200 uppercase tracking-wider">
                系统状态: 38个工地监控信号正常
              </span>
            </div>

            {/* Simulated Live Camera Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              <div className="bg-[#F9F9F8] border border-[#1A1A1A]/10 p-3 space-y-2">
                <div className="relative aspect-video bg-[#1A1A1A] overflow-hidden border border-[#1A1A1A]/10">
                  <img src={CRAFT_IMAGE} alt="cam1" className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
                  <div className="absolute top-2 left-2 bg-white/90 px-2 py-0.5 text-[10px] text-[#1A1A1A] font-mono uppercase">
                    CAM-01 · 陆家嘴 22F 幕墙组装
                  </div>
                  <div className="absolute bottom-2 right-2 bg-red-600 px-2 py-0.5 text-[10px] text-white font-bold uppercase tracking-widest">
                    LIVE
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#444444]">
                  <span>项目: 华瑞科技总部</span>
                  <span className="text-[#C5A27D] font-mono font-medium">进度: 78%</span>
                </div>
              </div>

              <div className="bg-[#F9F9F8] border border-[#1A1A1A]/10 p-3 space-y-2">
                <div className="relative aspect-video bg-[#1A1A1A] overflow-hidden border border-[#1A1A1A]/10">
                  <img src="https://images.unsplash.com/photo-1541888946425-d0fbb186a5b3?auto=format&fit=crop&w=600&q=80" alt="cam2" className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
                  <div className="absolute top-2 left-2 bg-white/90 px-2 py-0.5 text-[10px] text-[#1A1A1A] font-mono uppercase">
                    CAM-02 · 滨江一号 水电验收
                  </div>
                  <div className="absolute bottom-2 right-2 bg-red-600 px-2 py-0.5 text-[10px] text-white font-bold uppercase tracking-widest">
                    LIVE
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#444444]">
                  <span>项目: 滨江顶奢私宅</span>
                  <span className="text-emerald-700 font-mono font-medium">水压: 0.85MPa</span>
                </div>
              </div>

              <div className="bg-[#F9F9F8] border border-[#1A1A1A]/10 p-3 space-y-2">
                <div className="relative aspect-video bg-[#1A1A1A] overflow-hidden border border-[#1A1A1A]/10">
                  <img src="https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=600&q=80" alt="cam3" className="w-full h-full object-cover opacity-80" referrerPolicy="no-referrer" />
                  <div className="absolute top-2 left-2 bg-white/90 px-2 py-0.5 text-[10px] text-[#1A1A1A] font-mono uppercase">
                    CAM-03 · 云谷隔音工程
                  </div>
                  <div className="absolute bottom-2 right-2 bg-red-600 px-2 py-0.5 text-[10px] text-white font-bold uppercase tracking-widest">
                    LIVE
                  </div>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[#444444]">
                  <span>项目: 深圳云谷展厅</span>
                  <span className="text-[#C5A27D] font-mono font-medium">无尘预装</span>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </section>
  );
};
