import React, { useState, useRef } from 'react';
import { PROJECTS } from '../data/mockData';
import { Project, ProjectCategory } from '../types';
import { Filter, Eye, Award, Layers, MapPin, Calendar, ArrowRight, ShieldCheck, Box, X, Check } from 'lucide-react';
import { motion, useScroll, useTransform, useSpring } from 'motion/react';

interface ProjectGalleryProps {
  onOpenBooking: () => void;
  selectedProjectId?: string | null;
  onClearSelectedProject?: () => void;
}

const CATEGORIES: { key: ProjectCategory; label: string }[] = [
  { key: 'all', label: '全部作品案例' },
  { key: 'commercial', label: '商业地标' },
  { key: 'office', label: '办公总部' },
  { key: 'villa', label: '奢华私宅' },
  { key: 'renovation', label: '旧改更新' },
  { key: 'hospitality', label: '奢华酒店' },
  { key: 'public', label: '市政公建' }
];

export const ProjectGallery: React.FC<ProjectGalleryProps> = ({
  onOpenBooking,
  selectedProjectId,
  onClearSelectedProject
}) => {
  const [activeCategory, setActiveCategory] = useState<ProjectCategory>('all');
  const [activeModalProject, setActiveModalProject] = useState<Project | null>(() => {
    if (selectedProjectId) {
      return PROJECTS.find(p => p.id === selectedProjectId) || null;
    }
    return null;
  });

  const [activeGalleryIndex, setActiveGalleryIndex] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  // Parallax scroll logic
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'end start']
  });

  const smoothProgress = useSpring(scrollYProgress, { stiffness: 80, damping: 25 });

  const headerY = useTransform(smoothProgress, [0, 1], [-25, 25]);
  const bgAccentY = useTransform(smoothProgress, [0, 1], [-60, 60]);

  // Transform offsets for 3 columns to create depth
  const col1Y = useTransform(smoothProgress, [0, 1], [30, -30]);
  const col2Y = useTransform(smoothProgress, [0, 1], [-15, 15]);
  const col3Y = useTransform(smoothProgress, [0, 1], [40, -40]);

  const getColTransform = (index: number) => {
    const col = index % 3;
    if (col === 0) return col1Y;
    if (col === 1) return col2Y;
    return col3Y;
  };

  const filteredProjects = activeCategory === 'all'
    ? PROJECTS
    : PROJECTS.filter(p => p.category === activeCategory);

  const handleOpenModal = (project: Project) => {
    setActiveModalProject(project);
    setActiveGalleryIndex(0);
  };

  const handleCloseModal = () => {
    setActiveModalProject(null);
    if (onClearSelectedProject) onClearSelectedProject();
  };

  return (
    <section
      ref={sectionRef}
      id="project-gallery"
      className="py-24 bg-[#F9F9F8] border-t border-[#1A1A1A]/10 relative text-[#1A1A1A] overflow-hidden"
    >
      {/* Background Subtle Parallax Graphic */}
      <motion.div
        style={{ y: bgAccentY }}
        className="absolute top-1/3 left-[-5%] w-[400px] h-[400px] border border-[#1A1A1A]/5 rounded-full pointer-events-none"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        
        {/* Section Header with Parallax */}
        <motion.div
          style={{ y: headerY }}
          className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6"
        >
          <div className="space-y-3">
            <span className="text-xs uppercase tracking-[0.25em] text-[#C5A27D] font-semibold block font-sans">
              Portfolio & Landmarks / 经典案例作品集
            </span>
            <h2 className="text-3xl sm:text-4xl font-light text-[#1A1A1A] font-serif tracking-tight">
              地标级建筑工程与顶奢全案典范
            </h2>
            <p className="text-[#666666] text-sm max-w-2xl font-sans leading-relaxed">
              筑景工程累计完成 500+ 项目，全过程贯彻 ISO 9001 质量管理与 BIM 5D 三维碰撞验证。
            </p>
          </div>

          {/* Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 bg-[#F4F4F0] p-1.5 border border-[#1A1A1A]/10">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-3.5 py-1.5 text-xs font-medium uppercase tracking-wider transition-all ${
                  activeCategory === cat.key
                    ? 'bg-[#1A1A1A] text-white shadow-xs'
                    : 'text-[#666666] hover:text-[#1A1A1A] hover:bg-white'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Projects Grid with Multi-Depth Parallax */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project, index) => (
            <motion.div
              key={project.id}
              style={{ y: getColTransform(index) }}
              className="group bg-white border border-[#1A1A1A]/10 hover:border-[#C5A27D] transition-all duration-300 shadow-xs flex flex-col justify-between"
            >
              <div>
                {/* Image Cover */}
                <div className="relative aspect-[4/3] overflow-hidden cursor-pointer" onClick={() => handleOpenModal(project)}>
                  <img
                    src={project.coverImage}
                    alt={project.title}
                    className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1A1A1A]/70 via-transparent to-transparent opacity-80" />
                  
                  {/* Category & Award Pill */}
                  <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
                    <span className="px-2.5 py-1 bg-white/90 backdrop-blur-md text-[#1A1A1A] text-[10px] font-semibold border border-[#1A1A1A]/10 uppercase tracking-wider">
                      {project.categoryLabel}
                    </span>
                    {project.award && (
                      <span className="px-2.5 py-1 bg-[#1A1A1A] text-white text-[10px] font-medium tracking-wider flex items-center gap-1 uppercase">
                        <Award className="w-3 h-3 text-[#C5A27D]" />
                        {project.award.includes('鲁班奖') ? '鲁班奖' : '国际大奖'}
                      </span>
                    )}
                  </div>

                  {/* VR Available Badge */}
                  {project.vrAvailable && (
                    <div className="absolute top-3 right-3 bg-white/95 text-[#1A1A1A] border border-[#1A1A1A]/10 text-[10px] font-semibold px-2 py-0.5 tracking-wider uppercase flex items-center gap-1">
                      <Box className="w-3 h-3 text-[#C5A27D]" />
                      <span>3D VR</span>
                    </div>
                  )}

                  {/* Quick View Button on Hover */}
                  <div className="absolute inset-0 bg-[#1A1A1A]/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button className="px-5 py-2.5 bg-[#1A1A1A] text-white font-medium text-xs uppercase tracking-widest flex items-center gap-2 shadow-md hover:bg-[#C5A27D] transition-colors">
                      <Eye className="w-4 h-4 text-white" />
                      <span>全案详图与参数</span>
                    </button>
                  </div>
                </div>

                {/* Card Info */}
                <div className="p-6 space-y-3">
                  <div className="flex items-center justify-between text-xs text-[#777777] font-mono uppercase tracking-wider">
                    <span className="flex items-center gap-1 text-[#555555]">
                      <MapPin className="w-3.5 h-3.5 text-[#C5A27D]" />
                      {project.location}
                    </span>
                    <span>{project.area}</span>
                  </div>

                  <h3
                    className="text-lg font-light text-[#1A1A1A] font-serif hover:text-[#C5A27D] transition-colors cursor-pointer tracking-tight"
                    onClick={() => handleOpenModal(project)}
                  >
                    {project.title}
                  </h3>
                  
                  <p className="text-xs text-[#666666] line-clamp-2 leading-relaxed font-sans">
                    {project.subtitle} — {project.description}
                  </p>

                  {/* Craft Highlights */}
                  <div className="pt-2 flex flex-wrap gap-1.5">
                    {project.craftHighlights.slice(0, 3).map((hl, i) => (
                      <span key={i} className="text-[10px] px-2.5 py-1 bg-[#F4F4F0] text-[#444444] border border-[#1A1A1A]/10 font-sans">
                        {hl}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-6 pb-6 pt-3 border-t border-[#1A1A1A]/10 flex items-center justify-between text-xs text-[#777777]">
                <span className="text-[11px] font-sans">主设计师: {project.architect.split(' ')[0]}</span>
                <button
                  onClick={() => handleOpenModal(project)}
                  className="text-[#1A1A1A] font-medium uppercase tracking-wider text-xs hover:text-[#C5A27D] flex items-center gap-1 transition-colors"
                >
                  <span>查看全案档案</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

            </motion.div>
          ))}
        </div>

      </div>

      {/* Project Detail Modal */}
      {activeModalProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/80 backdrop-blur-md animate-fadeIn overflow-y-auto">
          <div className="relative bg-white border border-[#1A1A1A]/20 max-w-4xl w-full my-8 p-6 sm:p-10 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto text-[#1A1A1A]">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[#1A1A1A]/10 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-[#F4F4F0] text-[#1A1A1A] border border-[#1A1A1A]/10 text-xs font-semibold uppercase tracking-wider">
                    {activeModalProject.categoryLabel}
                  </span>
                  {activeModalProject.award && (
                    <span className="px-2.5 py-0.5 bg-[#1A1A1A] text-white text-xs font-medium uppercase tracking-wider">
                      {activeModalProject.award}
                    </span>
                  )}
                </div>
                <h3 className="text-2xl font-light text-[#1A1A1A] font-serif mt-2 tracking-tight">
                  {activeModalProject.title}
                </h3>
                <p className="text-xs text-[#666666] font-sans">{activeModalProject.subtitle}</p>
              </div>
              <button
                onClick={handleCloseModal}
                className="p-2 text-[#777777] hover:text-[#1A1A1A]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Gallery Image Previewer */}
            <div className="space-y-3">
              <div className="aspect-[16/9] overflow-hidden border border-[#1A1A1A]/15 bg-[#F4F4F0] relative">
                <img
                  src={activeModalProject.galleryImages[activeGalleryIndex] || activeModalProject.coverImage}
                  alt={activeModalProject.title}
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Gallery Thumbnails */}
              <div className="flex items-center gap-3 overflow-x-auto pb-1">
                {activeModalProject.galleryImages.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveGalleryIndex(idx)}
                    className={`w-24 h-16 overflow-hidden border shrink-0 transition-all ${
                      activeGalleryIndex === idx
                        ? 'border-[#1A1A1A] ring-1 ring-[#1A1A1A]'
                        : 'border-[#1A1A1A]/15 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={img} alt="thumb" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  </button>
                ))}
              </div>
            </div>

            {/* Parameters Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-[#F9F9F8] p-4 border border-[#1A1A1A]/10 text-xs">
              <div>
                <span className="text-[#777777] block uppercase tracking-wider">工程/设计面积</span>
                <span className="text-[#1A1A1A] font-medium">{activeModalProject.area}</span>
              </div>
              <div>
                <span className="text-[#777777] block uppercase tracking-wider">施工工期</span>
                <span className="text-[#1A1A1A] font-medium">{activeModalProject.duration}</span>
              </div>
              <div>
                <span className="text-[#777777] block uppercase tracking-wider">项目地理位置</span>
                <span className="text-[#1A1A1A] font-medium">{activeModalProject.location}</span>
              </div>
              <div>
                <span className="text-[#777777] block uppercase tracking-wider">BIM 等级</span>
                <span className="text-[#C5A27D] font-mono font-bold">{activeModalProject.bimLevel || 'BIM Level 3'}</span>
              </div>
            </div>

            {/* Detailed Description */}
            <div className="space-y-2">
              <h4 className="text-sm font-serif font-bold text-[#1A1A1A]">工程背景与设计规划</h4>
              <p className="text-xs text-[#555555] leading-relaxed font-sans">
                {activeModalProject.description}
              </p>
            </div>

            {/* Key Technical Craft Checklist */}
            <div className="space-y-2">
              <h4 className="text-sm font-serif font-bold text-[#1A1A1A]">核心交验与技术标准:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeModalProject.craftHighlights.map((hl, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[#333333] bg-[#F9F9F8] p-3 border border-[#1A1A1A]/10">
                    <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>{hl}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Bar */}
            <div className="pt-4 border-t border-[#1A1A1A]/10 flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-[#777777]">
                主案工程总监: <span className="text-[#1A1A1A] font-medium">{activeModalProject.architect}</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    handleCloseModal();
                    onOpenBooking();
                  }}
                  className="px-6 py-3 bg-[#1A1A1A] text-white font-medium text-xs uppercase tracking-widest hover:bg-[#C5A27D] transition-colors"
                >
                  预约同品质工程定盘与设计
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </section>
  );
};
