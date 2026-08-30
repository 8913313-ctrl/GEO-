import React, { useState } from 'react';
import { Layers, Box, Eye, Check, Sparkles, MapPin, Sliders } from 'lucide-react';

const SCENES = [
  {
    id: 's1',
    title: '800㎡ 华瑞科技大楼中庭与总部空间',
    category: '商业/总部',
    image: '/src/assets/images/interior_commercial_1788069444221.jpg',
    hotspots: [
      { top: '35%', left: '42%', title: '意大利鱼谷白大理石对纹墙', desc: 'CNC挂件固定，拼缝≤0.5mm' },
      { top: '65%', left: '68%', title: '无缝隐形双曲面楼梯', desc: '钢桁架支撑与GRC曲面高粉包覆' },
      { top: '22%', left: '20%', title: '声学吸音悬浮天花', desc: '隐藏式无风感出风口与人感调光' }
    ]
  },
  {
    id: 's2',
    title: '450㎡ 滨江一号顶奢大平层全案',
    category: '豪宅私宅',
    image: '/src/assets/images/luxury_villa_interior_1788069457310.jpg',
    hotspots: [
      { top: '48%', left: '30%', title: '德系无缝微水泥地坪', desc: '九道防龟裂底漆，抗压易清洁' },
      { top: '25%', left: '75%', title: '270度落地Low-E中空幕墙', desc: '超大分块三玻两腔隔音防辐射' },
      { top: '70%', left: '50%', title: '烟熏天然橡木全屋定制木作', desc: 'E0级环保无甲醛防潮背板' }
    ]
  },
  {
    id: 's3',
    title: '1200㎡ 深圳云谷展示中心',
    category: '展厅/公建',
    image: '/src/assets/images/hero_architecture_1788069429117.jpg',
    hotspots: [
      { top: '50%', left: '50%', title: '镜面水景与沉降式会客区', desc: '自循环水过滤与水下防水工装' },
      { top: '30%', left: '35%', title: '全息数字沉浸式主显示墙', desc: '光纤独立供电与防静电保护' }
    ]
  }
];

const MATERIALS = [
  { name: '意大利奢石大理石', color: 'from-amber-200 to-amber-400', tag: '天然对纹' },
  { name: '德系微水泥无缝面', color: 'from-slate-400 to-slate-600', tag: '无缝防裂' },
  { name: '烟熏天然橡木面板', color: 'from-amber-800 to-amber-950', tag: 'E0级环保' },
  { name: '双银 Low-E 玻璃幕墙', color: 'from-sky-400 to-blue-600', tag: '高隔热' }
];

export const FloorPlanViewer3D: React.FC = () => {
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [activeMaterial, setActiveMaterial] = useState(0);
  const [hoveredHotspot, setHoveredHotspot] = useState<any>(null);

  const scene = SCENES[activeSceneIndex];

  return (
    <section id="floorplan-explorer" className="py-24 bg-[#F9F9F8] border-t border-[#1A1A1A]/10 relative text-[#1A1A1A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
          <span className="text-xs uppercase tracking-[0.25em] text-[#C5A27D] font-semibold block font-sans">
            3D Interactive & Materials / 3D 交互与材质推演
          </span>
          <h2 className="text-3xl sm:text-4xl font-light text-[#1A1A1A] font-serif tracking-tight">
            全景空间布局与材料搭配推演
          </h2>
          <div className="w-12 h-[1px] bg-[#C5A27D] mx-auto my-3" />
          <p className="text-[#666666] text-sm sm:text-base leading-relaxed font-sans">
            点击画面中热点即可查看工程工艺细节，切换下方主材色板体验不同饰面质感。
          </p>
        </div>

        {/* Scene Selector Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {SCENES.map((sc, idx) => (
            <button
              key={sc.id}
              onClick={() => {
                setActiveSceneIndex(idx);
                setHoveredHotspot(null);
              }}
              className={`px-4 py-2 text-xs font-medium uppercase tracking-wider transition-all border ${
                activeSceneIndex === idx
                  ? 'bg-[#1A1A1A] text-white border-[#1A1A1A] shadow-xs'
                  : 'bg-white text-[#555555] border-[#1A1A1A]/10 hover:border-[#1A1A1A]/30'
              }`}
            >
              {sc.title}
            </button>
          ))}
        </div>

        {/* Interactive Main Stage */}
        <div className="relative border border-[#1A1A1A]/10 bg-white shadow-xs">
          <div className="relative aspect-[16/9] w-full overflow-hidden">
            <img
              src={scene.image}
              alt={scene.title}
              className="w-full h-full object-cover transition-all duration-700"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-[#1A1A1A]/10" />

            {/* Interactive Hotspots */}
            {scene.hotspots.map((hs, i) => (
              <div
                key={i}
                style={{ top: hs.top, left: hs.left }}
                className="absolute z-20 transform -translate-x-1/2 -translate-y-1/2 cursor-pointer group"
                onMouseEnter={() => setHoveredHotspot(hs)}
                onClick={() => setHoveredHotspot(hs)}
              >
                <div className="relative flex items-center justify-center">
                  <span className="w-8 h-8 rounded-full bg-[#1A1A1A]/20 animate-ping absolute"></span>
                  <div className="w-7 h-7 bg-[#1A1A1A] text-white font-mono font-bold text-xs flex items-center justify-center shadow-lg group-hover:bg-[#C5A27D] transition-colors">
                    0{i + 1}
                  </div>
                </div>
              </div>
            ))}

            {/* Hotspot Card Overlay Popup */}
            {hoveredHotspot && (
              <div className="absolute bottom-6 left-6 max-w-sm bg-white/95 backdrop-blur-xl border border-[#1A1A1A]/20 p-4 shadow-2xl z-30 animate-fadeIn text-[#1A1A1A]">
                <div className="flex items-center justify-between pb-2 border-b border-[#1A1A1A]/10">
                  <span className="text-xs font-serif font-bold text-[#1A1A1A]">
                    {hoveredHotspot.title}
                  </span>
                  <button
                    onClick={() => setHoveredHotspot(null)}
                    className="text-[#777777] hover:text-[#1A1A1A] text-xs"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-[#555555] mt-2 leading-relaxed font-sans">
                  {hoveredHotspot.desc}
                </p>
                <span className="text-[10px] text-emerald-700 mt-2 block font-mono uppercase tracking-wider">
                  ✓ 筑景工程特级施工标准已核验
                </span>
              </div>
            )}
          </div>

          {/* Bottom Material Selector Bar */}
          <div className="p-4 bg-[#F9F9F8] border-t border-[#1A1A1A]/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-sans">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[#C5A27D]" />
              <span className="text-[#1A1A1A] font-medium uppercase tracking-wider">实时材质板替换演示:</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {MATERIALS.map((mat, i) => (
                <button
                  key={i}
                  onClick={() => setActiveMaterial(i)}
                  className={`px-3 py-1.5 border flex items-center gap-2 transition-all ${
                    activeMaterial === i
                      ? 'border-[#1A1A1A] bg-[#1A1A1A] text-white'
                      : 'border-[#1A1A1A]/10 bg-white text-[#555555] hover:text-[#1A1A1A]'
                  }`}
                >
                  <span className={`w-3 h-3 rounded-full bg-gradient-to-r ${mat.color}`} />
                  <span>{mat.name}</span>
                  <span className="text-[10px] opacity-75 font-mono">({mat.tag})</span>
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};
