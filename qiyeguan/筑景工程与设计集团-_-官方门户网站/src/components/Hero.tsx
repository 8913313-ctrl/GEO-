import React, { useState, useEffect, useRef } from 'react';
import { HERO_IMAGE, COMMERCIAL_IMAGE, VILLA_IMAGE, CRAFT_IMAGE } from '../data/mockData';
import { Calculator, ArrowRight, ShieldCheck, Award, Layers, Play, CheckCircle2 } from 'lucide-react';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';

interface HeroProps {
  onOpenCalculator: () => void;
  onOpenBooking: () => void;
  onSelectProject: (id: string) => void;
}

const SLIDES = [
  {
    image: HERO_IMAGE,
    tag: '建筑工程总承包 / 地标幕墙',
    title: '重塑城市天际线 · 筑就地标级建筑品质',
    subtitle: '具备国家建筑工程施工总承包一级与幕墙甲级资质，全过程 BIM 5D 数智化精准建造。'
  },
  {
    image: COMMERCIAL_IMAGE,
    tag: '商业与总部大楼装饰',
    title: '企业总部与商业空间室内建筑美学',
    subtitle: '融合声光影一体化与国际化施工工艺，为世界500强与地标商业打造最具前瞻性的办公环境。'
  },
  {
    image: VILLA_IMAGE,
    tag: '顶奢私宅与全案定制',
    title: '隐匿的奢华 · 世代传承的居住艺术',
    subtitle: '德系 108 项隐蔽工程精工标准，全屋五恒智能环境与全套大理石奢石精密交验。'
  }
];

export const Hero: React.FC<HeroProps> = ({
  onOpenCalculator,
  onOpenBooking,
  onSelectProject
}) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  // Scroll Parallax logic
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start']
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 90, damping: 25 });

  const bgY = useTransform(smoothProgress, [0, 1], [0, 120]);
  const textY = useTransform(smoothProgress, [0, 1], [0, 40]);
  const imageStageY = useTransform(smoothProgress, [0, 1], [0, -35]);
  const heroOpacity = useTransform(smoothProgress, [0, 0.85], [1, 0.4]);
  const innerImgY = useTransform(smoothProgress, [0, 1], ['0%', '-8%']);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  return (
    <section
      ref={sectionRef}
      id="hero-section"
      className="relative min-h-[90vh] flex items-center pt-28 pb-16 overflow-hidden bg-[#F9F9F8] text-[#1A1A1A]"
    >
      {/* Background Subtle Grid - Parallax shift */}
      <motion.div
        style={{ y: bgY }}
        className="absolute inset-0 bg-[linear-gradient(to_right,rgba(26,26,26,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(26,26,26,0.03)_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none"
      />

      {/* Decorative Architectural Accent Lines */}
      <motion.div
        style={{ y: textY }}
        className="absolute top-1/4 -right-12 w-64 h-64 border border-[#1A1A1A]/5 rounded-full pointer-events-none hidden lg:block"
      />

      {/* Hero Content Grid */}
      <motion.div
        style={{ opacity: heroOpacity }}
        className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 z-10 w-full"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          
          <motion.div style={{ y: textY }} className="lg:col-span-7 space-y-6">
            
            {/* Eyebrow Label & Badges */}
            <div className="space-y-3">
              <span className="text-xs uppercase tracking-[0.3em] text-[#C5A27D] font-semibold block font-sans">
                Est. 2004 / 筑景工程与装饰集团
              </span>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="px-3 py-1 bg-white text-[#1A1A1A] border border-[#1A1A1A]/15 text-[11px] uppercase tracking-wider font-medium flex items-center gap-1.5 shadow-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#C5A27D]" />
                  建筑工程总承包一级
                </span>
                <span className="px-3 py-1 bg-white text-[#1A1A1A] border border-[#1A1A1A]/15 text-[11px] uppercase tracking-wider font-medium flex items-center gap-1.5 shadow-xs">
                  <Award className="w-3.5 h-3.5 text-[#C5A27D]" />
                  装饰设计专项甲级
                </span>
                <span className="px-3 py-1 bg-white text-[#1A1A1A] border border-[#1A1A1A]/15 text-[11px] uppercase tracking-wider font-medium flex items-center gap-1.5 shadow-xs">
                  <Layers className="w-3.5 h-3.5 text-emerald-600" />
                  BIM 5D 数字化建模
                </span>
              </div>
            </div>

            {/* Slide Category Tag */}
            <div className="inline-block text-xs font-mono font-medium text-[#777777] uppercase tracking-widest border-l-2 border-[#C5A27D] pl-3">
              {SLIDES[currentSlide].tag}
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-light text-[#1A1A1A] leading-[1.12] font-serif tracking-tight">
              精致建筑 <br /> 与 <span className="italic font-serif text-[#C5A27D]">空间美学工程</span>
            </h1>

            {/* Subtitle */}
            <p className="text-base sm:text-lg text-[#555555] max-w-2xl leading-relaxed font-sans">
              {SLIDES[currentSlide].subtitle}
            </p>

            {/* Key Assurance Checks */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
              <div className="flex items-center gap-2 text-xs text-[#444444]">
                <CheckCircle2 className="w-4 h-4 text-[#C5A27D] shrink-0" />
                <span>德系 108 项严选工程标准</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#444444]">
                <CheckCircle2 className="w-4 h-4 text-[#C5A27D] shrink-0" />
                <span>工厂化装配式高精度交付</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#444444]">
                <CheckCircle2 className="w-4 h-4 text-[#C5A27D] shrink-0" />
                <span>透明云监工与闭水48h验收</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <button
                id="hero-ai-calc-btn"
                onClick={onOpenCalculator}
                className="px-7 py-3.5 border border-[#1A1A1A] bg-[#1A1A1A] text-white font-medium text-xs uppercase tracking-widest hover:bg-[#C5A27D] hover:border-[#C5A27D] transition-colors flex items-center gap-2.5 shadow-sm"
              >
                <Calculator className="w-4 h-4 text-white" />
                <span>AI 估算工程造价</span>
                <ArrowRight className="w-4 h-4 text-white" />
              </button>

              <button
                id="hero-booking-btn"
                onClick={onOpenBooking}
                className="px-6 py-3.5 border border-[#1A1A1A]/30 bg-white text-[#1A1A1A] font-medium text-xs uppercase tracking-widest hover:bg-[#1A1A1A] hover:text-white transition-colors shadow-xs"
              >
                <span>预约专家勘测与设计</span>
              </button>

              <button
                onClick={() => setVideoModalOpen(true)}
                className="px-4 py-3.5 border border-[#1A1A1A]/10 bg-[#F3F3EF] hover:bg-white text-[#444444] font-medium text-xs uppercase tracking-widest flex items-center gap-2 transition-colors"
              >
                <div className="w-5 h-5 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center">
                  <Play className="w-2.5 h-2.5 fill-white ml-0.5" />
                </div>
                <span>精工宣传片</span>
              </button>
            </div>

            {/* Slider Navigation Dots */}
            <div className="flex items-center gap-3 pt-6">
              {SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-1 transition-all duration-300 ${
                    idx === currentSlide ? 'w-12 bg-[#1A1A1A]' : 'w-4 bg-[#1A1A1A]/20 hover:bg-[#1A1A1A]/50'
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          </motion.div>

          {/* Clean Minimal Image Stage & Highlight Column with Parallax depth */}
          <motion.div style={{ y: imageStageY }} className="lg:col-span-5 space-y-6">
            
            {/* Visual Hero Image Container with Fine Border Overlay & Parallax Image Shift */}
            <div className="relative aspect-[4/3] w-full rounded-none overflow-hidden border border-[#1A1A1A]/15 bg-[#E5E5E0] shadow-md group">
              <motion.img
                style={{ y: innerImgY, scale: 1.08 }}
                src={SLIDES[currentSlide].image}
                alt={SLIDES[currentSlide].title}
                className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A]/80 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-6 left-6 right-6 text-white pointer-events-none">
                <span className="text-[10px] uppercase tracking-[0.25em] text-[#C5A27D] block mb-1 font-mono">
                  Featured Project Highlight
                </span>
                <h3 className="text-xl font-serif font-light tracking-tight">
                  {SLIDES[currentSlide].title}
                </h3>
              </div>
            </div>

            {/* Minimal Stat Box */}
            <div className="bg-white border border-[#1A1A1A]/10 p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#1A1A1A]/10">
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#C5A27D]">
                  ENGINEERING METRICS
                </span>
                <span className="text-[10px] bg-[#1A1A1A] text-white px-2 py-0.5 uppercase tracking-widest font-mono">
                  LIVE SYNC
                </span>
              </div>
              
              <div className="grid grid-cols-4 gap-2 text-center">
                <div>
                  <div className="text-2xl font-serif text-[#1A1A1A]">20<span className="text-[#C5A27D] text-sm">+</span></div>
                  <div className="text-[10px] text-[#777777] uppercase tracking-wider">深耕年限</div>
                </div>
                <div>
                  <div className="text-2xl font-serif text-[#1A1A1A]">500<span className="text-[#C5A27D] text-sm">+</span></div>
                  <div className="text-[10px] text-[#777777] uppercase tracking-wider">地标案例</div>
                </div>
                <div>
                  <div className="text-2xl font-serif text-emerald-700">99.8<span className="text-xs">%</span></div>
                  <div className="text-[10px] text-[#777777] uppercase tracking-wider">合格率</div>
                </div>
                <div>
                  <div className="text-2xl font-serif text-[#C5A27D]">38<span className="text-xs">个</span></div>
                  <div className="text-[10px] text-[#777777] uppercase tracking-wider">云监工</div>
                </div>
              </div>
            </div>

          </motion.div>

        </div>
      </motion.div>

      {/* Corporate Video Modal */}
      {videoModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/80 backdrop-blur-md animate-fadeIn">
          <div className="relative bg-white border border-[#1A1A1A]/20 rounded-none max-w-3xl w-full p-8 space-y-6 shadow-2xl text-[#1A1A1A]">
            <div className="flex items-center justify-between pb-4 border-b border-[#1A1A1A]/10">
              <h3 className="text-lg font-serif font-medium tracking-tight">筑景工程与装饰设计 · 企业工程宣传片</h3>
              <button
                onClick={() => setVideoModalOpen(false)}
                className="p-1 text-[#777777] hover:text-[#1A1A1A] text-sm"
              >
                ✕
              </button>
            </div>
            <div className="aspect-video bg-[#F3F3EF] rounded-none overflow-hidden relative flex items-center justify-center border border-[#1A1A1A]/10">
              <img
                src={CRAFT_IMAGE}
                alt="Construction video preview"
                className="w-full h-full object-cover opacity-70"
                referrerPolicy="no-referrer"
              />
              <div className="absolute text-center p-6 bg-white/95 backdrop-blur-md max-w-md border border-[#1A1A1A]/20 shadow-lg">
                <Play className="w-10 h-10 text-[#C5A27D] mx-auto mb-2" />
                <h4 className="text-[#1A1A1A] font-serif font-bold text-sm">德系108项精工与BIM数智施工实录</h4>
                <p className="text-xs text-[#666666] mt-2 leading-relaxed">包含隐蔽工程水压打压测试、大理石干挂精密对纹及BIM三维碰撞交底实拍。</p>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setVideoModalOpen(false)}
                className="px-6 py-2.5 bg-[#1A1A1A] text-white font-medium text-xs uppercase tracking-widest hover:bg-[#C5A27D] transition-colors"
              >
                关闭预览
              </button>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};
