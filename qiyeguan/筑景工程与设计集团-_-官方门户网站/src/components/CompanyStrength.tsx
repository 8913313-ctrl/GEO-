import React, { useState, useEffect } from 'react';
import { CLIENT_REVIEWS } from '../data/mockData';
import { ShieldCheck, Award, Building2, CheckCircle, Star, ChevronLeft, ChevronRight, ZoomIn, X, ExternalLink, Sparkles, Eye } from 'lucide-react';

interface CertificateItem {
  id: string;
  title: string;
  enTitle: string;
  issuer: string;
  issueYear: string;
  certNo: string;
  badge: string;
  image: string;
  description: string;
  details: string[];
}

const CERTIFICATES: CertificateItem[] = [
  {
    id: 'c1',
    title: '建筑工程施工总承包一级资质',
    enTitle: 'Class-A General Construction License',
    issuer: '中华人民共和国住房和城乡建设部',
    issueYear: '2024 - 2029',
    certNo: 'D131098271-Z01',
    badge: '国家顶级资质',
    image: 'https://images.unsplash.com/photo-1541888946425-d0fbb186a5b7?auto=format&fit=crop&w=1000&q=80',
    description: '准许承担各类高度、大跨度的工业与民用建筑工程施工总承包，包含超高层钢结构及深基坑作业。',
    details: ['建筑工程施工总承包一级', '钢结构工程专业承包一级', '地基基础工程专业承包一级', '建筑幕墙工程专业承包一级']
  },
  {
    id: 'c2',
    title: '建筑装饰工程设计专项甲级证书',
    enTitle: 'Specialized Architectural Interior Design Class-A',
    issuer: '国家住房和城乡建设部',
    issueYear: '2023 - 2028',
    certNo: 'A131098271-D02',
    badge: '设计专项甲级',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1000&q=80',
    description: '可承担建筑工程主体及室内装饰工程全套方案设计、灯光光学工程及声学环境一体化专项规划。',
    details: ['室内建筑全案设计甲级', '建筑外观与幕墙造型设计', '智能照明与声学工程专项设计', 'BIM 5D 虚拟建造仿真认证']
  },
  {
    id: 'c3',
    title: '中国建筑工程鲁班奖 (国家优质工程)',
    enTitle: 'China Construction Engineering Luban Prize',
    issuer: '中国建筑业协会 (CCEA)',
    issueYear: '2023 荣誉颁发',
    certNo: 'LB-2023-8891',
    badge: '中国建筑界最高奖',
    image: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=80',
    description: '凭“陆家嘴未来科技总部大楼”卓越建造品质与0缺陷交验，荣获中国建筑行业最高质量荣誉。',
    details: ['工程质量零缺陷交验', '高能效双银玻璃幕墙施工', '全过程绿色施工标杆项目', '结构终身质量安全保障']
  },
  {
    id: 'c4',
    title: 'Andrew Martin 国际室内设计大奖',
    enTitle: 'Andrew Martin International Interior Design Award',
    issuer: 'Andrew Martin International (UK)',
    issueYear: '2024 年度大奖',
    certNo: 'AMIDA-UK-2024-09',
    badge: '室内设计奥斯卡',
    image: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1000&q=80',
    description: '评委赞誉“佘山月华湾顶奢私宅”巧妙融合东方当代美学与极简主义，荣获全球设计杰出奖。',
    details: ['全球杰出设计师名录', '当代东方空间美学创新奖', '隐蔽式五恒环境集成设计', '意大利极简工艺极致表达']
  },
  {
    id: 'c5',
    title: 'ISO9001 质量与 ISO14001 环境双体系认证',
    enTitle: 'ISO 9001 & ISO 14001 Quality Management Certification',
    issuer: '中国质量认证中心 (CQC)',
    issueYear: '2022 - 2027',
    certNo: 'CQC-9001-2022-811',
    badge: '国际质量体系',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1000&q=80',
    description: '施工全程导入德国精工品质管控、BIM 5D 数据核验与零污染环保建材管理规范。',
    details: ['全流程 ISO9001 质量管控', 'ISO14001 绿色文明施工标准', 'ISO45001 职业健康安全体系', '数字化工地实时遥测监控']
  },
  {
    id: 'c6',
    title: '建筑幕墙工程专业承包一级',
    enTitle: 'Curtain Wall Engineering Class-A Certification',
    issuer: '上海市建设和管理委员会',
    issueYear: '2023 - 2028',
    certNo: 'MQ-10928-S06',
    badge: '专业幕墙顶级',
    image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1000&q=80',
    description: '专精双银Low-E玻璃幕墙、异形单元式幕墙与超高层耐侯密封结构施工技术。',
    details: ['单元式玻璃幕墙预制组装', '超高层风压与抗震性能测试', '耐侯硅酮胶无缝密封工艺', 'BIM 幕墙节点碰撞检测']
  }
];

export const CompanyStrength: React.FC = () => {
  const PARTNER_BRANDS = [
    '大金空调 (Daikin)',
    '施耐德电气 (Schneider)',
    '圣戈班 (Saint-Gobain)',
    'TOTO 卫浴',
    '立邦无氟防霉漆',
    '科勒 (Kohler)',
    '汉斯格雅 (Hansgrohe)',
    '威能暖通 (Vaillant)'
  ];

  // Carousel auto-rotate state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Zoom modal state
  const [activeCert, setActiveCert] = useState<CertificateItem | null>(null);
  const [modalZoom, setModalZoom] = useState(1);

  // Auto-play interval
  useEffect(() => {
    if (isPaused || activeCert) return;
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % CERTIFICATES.length);
    }, 3800);
    return () => clearInterval(timer);
  }, [isPaused, activeCert]);

  const handlePrev = () => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + CERTIFICATES.length) % CERTIFICATES.length);
  };

  const handleNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % CERTIFICATES.length);
  };

  // Visible certificates for multi-card slice display (3 visible on desktop)
  const getVisibleCertificates = () => {
    const list = [];
    for (let i = 0; i < 3; i++) {
      const idx = (currentIndex + i) % CERTIFICATES.length;
      list.push({ ...CERTIFICATES[idx], originalIndex: idx });
    }
    return list;
  };

  return (
    <section id="company-strength" className="py-24 bg-[#F9F9F8] border-t border-[#1A1A1A]/10 relative text-[#1A1A1A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-xs uppercase tracking-[0.25em] text-[#C5A27D] font-semibold block font-sans">
            Company Credentials & Reputation / 实力与资质
          </span>
          <h2 className="text-3xl sm:text-4xl font-light text-[#1A1A1A] font-serif tracking-tight">
            国家特级与双甲资质 · 大国工匠精神
          </h2>
          <div className="w-12 h-[1px] bg-[#C5A27D] mx-auto my-3" />
          <p className="text-[#666666] text-sm sm:text-base leading-relaxed font-sans">
            历经 20 余年发展，拥有建筑工程施工总承包一级、建筑装饰工程设计专项甲级等权威认证。
          </p>
        </div>

        {/* Qualifications Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <div className="bg-white border border-[#1A1A1A]/10 p-6 space-y-3 hover:border-[#C5A27D] transition-all shadow-xs">
            <div className="w-12 h-12 bg-[#F4F4F0] text-[#1A1A1A] border border-[#1A1A1A]/10 flex items-center justify-center font-bold">
              <Building2 className="w-6 h-6 text-[#C5A27D]" />
            </div>
            <h3 className="text-lg font-light text-[#1A1A1A] font-serif tracking-tight">建筑工程施工总承包一级</h3>
            <p className="text-xs text-[#555555] leading-relaxed font-sans">
              可承担各类高度、大跨度的工业与民用建筑工程施工总承包，具备超高层幕墙及深基坑专业施工实力。
            </p>
            <div className="pt-2 flex items-center gap-1.5 text-[11px] text-emerald-700 font-mono uppercase tracking-wider">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>国家住房和城乡建设部核准</span>
            </div>
          </div>

          <div className="bg-white border border-[#1A1A1A]/10 p-6 space-y-3 hover:border-[#C5A27D] transition-all shadow-xs">
            <div className="w-12 h-12 bg-[#F4F4F0] text-[#1A1A1A] border border-[#1A1A1A]/10 flex items-center justify-center font-bold">
              <Award className="w-6 h-6 text-[#C5A27D]" />
            </div>
            <h3 className="text-lg font-light text-[#1A1A1A] font-serif tracking-tight">建筑装饰工程设计专项甲级</h3>
            <p className="text-xs text-[#555555] leading-relaxed font-sans">
              拥有由国内外著名建筑师组成的甲级设计院，提供全案建筑外观、室内建筑、光学与景观一体化方案。
            </p>
            <div className="pt-2 flex items-center gap-1.5 text-[11px] text-emerald-700 font-mono uppercase tracking-wider">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>设计专项顶级资质</span>
            </div>
          </div>

          <div className="bg-white border border-[#1A1A1A]/10 p-6 space-y-3 hover:border-[#C5A27D] transition-all shadow-xs">
            <div className="w-12 h-12 bg-[#F4F4F0] text-[#1A1A1A] border border-[#1A1A1A]/10 flex items-center justify-center font-bold">
              <ShieldCheck className="w-6 h-6 text-[#C5A27D]" />
            </div>
            <h3 className="text-lg font-light text-[#1A1A1A] font-serif tracking-tight">鲁班奖与国际设计大奖荣誉</h3>
            <p className="text-xs text-[#555555] leading-relaxed font-sans">
              累计斩获中国建筑工程鲁班奖、国家优质工程奖、Andrew Martin 国际室内设计奖等 40 余项权威奖项。
            </p>
            <div className="pt-2 flex items-center gap-1.5 text-[11px] text-emerald-700 font-mono uppercase tracking-wider">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>质量奖项行业标杆</span>
            </div>
          </div>
        </div>

        {/* --- Auto-rotating Qualifications & Awards Gallery Carousel --- */}
        <div className="mb-20 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#1A1A1A]/10 pb-4">
            <div>
              <span className="text-xs uppercase tracking-[0.25em] text-[#C5A27D] font-mono font-semibold block">
                Official Certifications & Honor Roll / 权威资质证书与奖项画廊
              </span>
              <h3 className="text-2xl font-light text-[#1A1A1A] font-serif tracking-tight mt-1">
                国家级执业证书与国际工程大奖 (悬停可放大预览)
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrev}
                className="p-2.5 bg-white border border-[#1A1A1A]/10 text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors"
                title="上一页"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono text-[#777777]">
                <strong className="text-[#1A1A1A] font-bold">{currentIndex + 1}</strong> / {CERTIFICATES.length}
              </span>
              <button
                onClick={handleNext}
                className="p-2.5 bg-white border border-[#1A1A1A]/10 text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors"
                title="下一页"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Carousel View Container */}
          <div
            className="relative"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {getVisibleCertificates().map((cert, idx) => (
                <div
                  key={`${cert.id}-${idx}`}
                  onClick={() => {
                    setActiveCert(cert);
                    setModalZoom(1);
                  }}
                  className="group relative bg-white border border-[#1A1A1A]/10 hover:border-[#C5A27D] transition-all duration-300 shadow-xs cursor-pointer flex flex-col justify-between overflow-hidden"
                >
                  {/* Certificate Image Frame with Hover Zoom */}
                  <div className="relative aspect-[4/3] bg-[#F4F4F0] overflow-hidden">
                    <img
                      src={cert.image}
                      alt={cert.title}
                      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-110"
                      referrerPolicy="no-referrer"
                    />
                    
                    {/* Dark Vignette Overlay on Hover */}
                    <div className="absolute inset-0 bg-[#1A1A1A]/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center text-white gap-2 p-4">
                      <div className="p-3 rounded-full bg-white/20 backdrop-blur-xs border border-white/40 group-hover:scale-110 transition-transform">
                        <ZoomIn className="w-6 h-6 text-white" />
                      </div>
                      <span className="text-xs font-mono uppercase tracking-widest text-white/90">
                        点击全屏高清放大预览
                      </span>
                    </div>

                    {/* Top Qualification Badge */}
                    <div className="absolute top-3 left-3 bg-[#1A1A1A] text-white text-[10px] font-mono px-2.5 py-1 uppercase tracking-wider border border-white/20">
                      {cert.badge}
                    </div>

                    {/* Bottom Floating Bar */}
                    <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-xs text-[#1A1A1A] text-[10px] font-mono px-2 py-0.5 border border-[#1A1A1A]/10">
                      编号: {cert.certNo}
                    </div>
                  </div>

                  {/* Card Info Body */}
                  <div className="p-6 space-y-3 bg-white border-t border-[#1A1A1A]/10">
                    <div className="flex items-center justify-between text-[11px] text-[#777777] font-sans">
                      <span className="truncate max-w-[180px] font-medium text-[#C5A27D]">
                        {cert.issuer}
                      </span>
                      <span className="font-mono text-[10px] bg-[#F4F4F0] px-1.5 py-0.5 border border-[#1A1A1A]/5">
                        {cert.issueYear}
                      </span>
                    </div>

                    <div>
                      <h4 className="text-base font-serif font-light text-[#1A1A1A] group-hover:text-[#C5A27D] transition-colors leading-snug">
                        {cert.title}
                      </h4>
                      <p className="text-[11px] font-mono text-[#777777] mt-0.5">
                        {cert.enTitle}
                      </p>
                    </div>

                    <p className="text-xs text-[#555555] leading-relaxed font-sans line-clamp-2">
                      {cert.description}
                    </p>

                    <div className="pt-2 flex items-center justify-between text-xs text-[#1A1A1A] font-medium group-hover:text-[#C5A27D]">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        查看核验条目与准许范围
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Carousel Navigation Indicators */}
            <div className="flex justify-center items-center gap-2 mt-6">
              {CERTIFICATES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentIndex(i)}
                  className={`h-1.5 transition-all duration-300 ${
                    currentIndex === i ? 'w-8 bg-[#1A1A1A]' : 'w-2 bg-[#1A1A1A]/20 hover:bg-[#1A1A1A]/40'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Client Reviews Section */}
        <div className="space-y-6 mb-16">
          <h3 className="text-xl font-light text-[#1A1A1A] font-serif text-center tracking-tight">客户与业主真实评价</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {CLIENT_REVIEWS.map(rev => (
              <div key={rev.id} className="bg-white border border-[#1A1A1A]/10 p-6 space-y-4 shadow-xs">
                <div className="flex items-center gap-1 text-[#C5A27D]">
                  {[...Array(rev.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-[#C5A27D]" />
                  ))}
                </div>
                <p className="text-xs text-[#555555] italic leading-relaxed font-sans">
                  "{rev.content}"
                </p>
                <div className="flex items-center gap-3 pt-2 border-t border-[#1A1A1A]/10">
                  <img src={rev.avatar} alt={rev.name} className="w-10 h-10 object-cover border border-[#1A1A1A]/10" referrerPolicy="no-referrer" />
                  <div>
                    <h4 className="text-xs font-semibold text-[#1A1A1A]">{rev.name}</h4>
                    <p className="text-[10px] text-[#C5A27D] font-mono">{rev.project}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Global Supplier Material Partners Carousel */}
        <div className="bg-white border border-[#1A1A1A]/10 p-8 space-y-4 text-center shadow-xs">
          <span className="text-xs text-[#C5A27D] uppercase tracking-widest font-mono font-semibold">
            GLOBAL MATERIAL & MEP BRAND PARTNERS
          </span>
          <h4 className="text-lg font-light text-[#1A1A1A] font-serif tracking-tight">全球原产地直供主材与机电设备供应链</h4>
          
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {PARTNER_BRANDS.map((brand, i) => (
              <span key={i} className="px-4 py-2 bg-[#F4F4F0] border border-[#1A1A1A]/10 text-[#333333] text-xs font-medium uppercase tracking-wider hover:border-[#1A1A1A]/30 transition-colors">
                {brand}
              </span>
            ))}
          </div>
        </div>

      </div>

      {/* High-Res Certificate Interactive Zoom Modal */}
      {activeCert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/85 backdrop-blur-md animate-fadeIn">
          <div className="relative bg-white border border-[#1A1A1A]/20 max-w-4xl w-full p-6 sm:p-8 space-y-6 shadow-2xl max-h-[92vh] overflow-y-auto text-[#1A1A1A]">
            
            {/* Modal Top Bar */}
            <div className="flex items-start justify-between border-b border-[#1A1A1A]/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-[#1A1A1A] text-white text-[10px] font-mono uppercase tracking-widest">
                    {activeCert.badge}
                  </span>
                  <span className="text-xs text-[#C5A27D] font-mono">
                    证书核验编码: {activeCert.certNo}
                  </span>
                </div>
                <h3 className="text-2xl font-serif font-light text-[#1A1A1A] mt-2 tracking-tight">
                  {activeCert.title}
                </h3>
                <p className="text-xs text-[#777777] font-mono">{activeCert.enTitle}</p>
              </div>

              <div className="flex items-center gap-2">
                {/* Zoom Controls */}
                <button
                  onClick={() => setModalZoom(prev => Math.min(prev + 0.25, 2.5))}
                  className="px-2.5 py-1 bg-[#F4F4F0] border border-[#1A1A1A]/10 text-xs font-mono hover:bg-[#1A1A1A] hover:text-white transition-colors"
                  title="放大预览"
                >
                  放大 +
                </button>
                <button
                  onClick={() => setModalZoom(prev => Math.max(prev - 0.25, 0.75))}
                  className="px-2.5 py-1 bg-[#F4F4F0] border border-[#1A1A1A]/10 text-xs font-mono hover:bg-[#1A1A1A] hover:text-white transition-colors"
                  title="缩小预览"
                >
                  缩小 -
                </button>
                <button
                  onClick={() => setModalZoom(1)}
                  className="px-2.5 py-1 bg-[#F4F4F0] border border-[#1A1A1A]/10 text-xs font-mono hover:bg-[#1A1A1A] hover:text-white transition-colors"
                  title="重置"
                >
                  100%
                </button>
                <button
                  onClick={() => setActiveCert(null)}
                  className="p-1.5 text-[#777777] hover:text-[#1A1A1A] transition-colors ml-2"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* High-Res Certificate Zoom Canvas */}
            <div className="relative aspect-[16/10] overflow-hidden bg-[#F4F4F0] border border-[#1A1A1A]/15 flex items-center justify-center shadow-inner">
              <img
                src={activeCert.image}
                alt={activeCert.title}
                style={{ transform: `scale(${modalZoom})` }}
                className="w-full h-full object-cover transition-transform duration-300 ease-out cursor-grab active:cursor-grabbing"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-xs px-3 py-1 text-[11px] font-mono text-[#1A1A1A] border border-[#1A1A1A]/10 shadow-xs flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#C5A27D]" />
                国家建设部原件备案认证
              </div>
            </div>

            {/* Certificate Meta Info & Permitted Scope */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-[#F9F9F8] p-5 border border-[#1A1A1A]/10 text-xs">
              <div className="space-y-2">
                <span className="text-[#777777] uppercase tracking-wider font-mono text-[10px] block">颁发发证机关:</span>
                <p className="text-sm font-serif font-medium text-[#1A1A1A]">{activeCert.issuer}</p>
                
                <span className="text-[#777777] uppercase tracking-wider font-mono text-[10px] block pt-2">资质有效周期:</span>
                <p className="text-xs font-mono text-[#1A1A1A]">{activeCert.issueYear}</p>
              </div>

              <div className="space-y-2">
                <span className="text-[#777777] uppercase tracking-wider font-mono text-[10px] block">核准与承包许可范围:</span>
                <div className="space-y-1">
                  {activeCert.details.map((item, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[#333333]">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#1A1A1A]/10">
              <p className="text-[11px] text-[#777777]">
                声明：所有资质证书均已通过国家建设工程监管监管平台在线核验，具备法律约束效力。
              </p>
              <button
                onClick={() => setActiveCert(null)}
                className="px-6 py-2.5 bg-[#1A1A1A] text-white font-medium text-xs uppercase tracking-widest hover:bg-[#C5A27D] transition-colors"
              >
                关闭窗口
              </button>
            </div>

          </div>
        </div>
      )}

    </section>
  );
};

