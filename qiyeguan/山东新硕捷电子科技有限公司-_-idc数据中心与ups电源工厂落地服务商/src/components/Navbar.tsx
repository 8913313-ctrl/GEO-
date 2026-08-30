import React, { useState, useEffect } from 'react';
import { Zap, Phone, Mail, Calculator, Bot, Search, Menu, X, ShieldCheck, ChevronRight } from 'lucide-react';

interface NavbarProps {
  onOpenCalculator: () => void;
  onOpenAiConsultant: () => void;
  onOpenQuoteModal: () => void;
  activeSection: string;
  setActiveSection: (section: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCalculator,
  onOpenAiConsultant,
  onOpenQuoteModal,
  activeSection,
  setActiveSection,
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { id: 'products', label: '代理产品中心' },
    { id: 'agency-brands', label: '代理品牌实力' },
    { id: 'services', label: '工程落地服务' },
    { id: 'calculator', label: '智能选型计算器' },
    { id: 'solutions', label: '行业解决方案' },
    { id: 'cases', label: '工程案例' },
    { id: 'contact-support', label: '联系与支持' },
    { id: 'about', label: '关于新硕捷' },
    { id: 'faq', label: '常见问题' },
  ];

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full font-sans transition-all duration-300">
      {/* Top Banner Bar */}
      <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-4 border-b border-slate-800">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" /> 山东新硕捷 | IDC数据中心与电源保障系统落地服务商
            </span>
            <span className="hidden md:inline-block text-slate-500">|</span>
            <span className="hidden md:inline-block text-slate-400">
              山特 / 硕天 / 华为 / 维蒂 / 施耐德 / 科士达 / 圣阳 / 理士 等原厂代理直供
            </span>
          </div>

          <div className="flex items-center gap-4 text-slate-300">
            <a href="tel:18678123345" className="flex items-center gap-1 hover:text-amber-400 transition-colors">
              <Phone className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold tracking-wider text-slate-100">18678123345</span>
            </a>
            <span className="text-slate-600">|</span>
            <a href="mailto:70712289@qq.com" className="hidden sm:flex items-center gap-1 hover:text-amber-400 transition-colors">
              <Mail className="w-3.5 h-3.5 text-slate-400" /> 70712289@qq.com
            </a>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <nav className={`w-full transition-all duration-300 ${
        isScrolled 
          ? 'bg-white/95 backdrop-blur-md shadow-md border-b border-slate-200 py-3' 
          : 'bg-white/90 backdrop-blur-md border-b border-slate-200 py-4'
      }`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          {/* Enterprise Logo */}
          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => scrollToSection('hero')}>
            <div className="w-9 h-9 bg-amber-500 flex items-center justify-center rounded-sm rotate-45 shadow-md shadow-amber-500/20 transition-transform group-hover:rotate-90 duration-300">
              <Zap className="w-5 h-5 -rotate-45 text-slate-950 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-black tracking-tight text-slate-900 uppercase font-display">
                  山东新硕捷 <span className="text-amber-600">XINSHUOJIE</span>
                </span>
                <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-bold px-1.5 py-0.5 rounded-none uppercase tracking-widest">
                  工厂落地服务商
                </span>
              </div>
              <p className="text-[10px] text-slate-500 tracking-widest uppercase font-mono">山特/硕天/华为/维蒂/科士达等 品牌代理服务商</p>
            </div>
          </div>

          {/* Desktop Nav Links */}
          <div className="hidden lg:flex items-center gap-1 text-xs font-bold uppercase tracking-wider">
            {navLinks.map((link) => {
              const isActive = activeSection === link.id;
              return (
                <button
                  key={link.id}
                  onClick={() => scrollToSection(link.id)}
                  className={`px-3 py-2 rounded-none transition-all duration-200 border-b-2 ${
                    isActive
                      ? 'text-amber-600 border-amber-600 bg-amber-50 font-bold'
                      : 'text-slate-700 border-transparent hover:text-amber-600 hover:border-amber-400'
                  }`}
                >
                  {link.label}
                </button>
              );
            })}
          </div>

          {/* Action CTAs */}
          <div className="hidden sm:flex items-center gap-2">
            {/* AI Assistant Button */}
            <button
              onClick={onOpenAiConsultant}
              className="flex items-center gap-1.5 px-3 py-2 rounded-none text-xs font-bold uppercase tracking-wider text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-all"
              title="咨询 AI 智能电源架构师"
            >
              <Bot className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span>AI电源专家</span>
            </button>

            {/* Smart Sizing Button */}
            <button
              onClick={onOpenCalculator}
              className="flex items-center gap-1.5 px-3 py-2 rounded-none text-xs font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 transition-all"
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-600" />
              <span>智能选型</span>
            </button>

            {/* Request Quote Button */}
            <button
              onClick={onOpenQuoteModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-none text-xs font-bold uppercase tracking-widest text-slate-950 bg-amber-500 hover:bg-amber-400 transition-all shadow-md shadow-amber-500/20"
            >
              <span>获取报价</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile menu trigger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-none border border-slate-300 text-slate-700 hover:text-slate-900 hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-4 space-y-3 animate-in slide-in-from-top duration-200 shadow-xl">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollToSection(link.id)}
                className={`w-full text-left px-4 py-2.5 rounded-none text-sm font-medium transition-colors ${
                  activeSection === link.id
                    ? 'text-amber-700 bg-amber-50 border border-amber-300 font-bold'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {link.label}
              </button>
            ))}

            <div className="pt-3 border-t border-slate-200 flex flex-col gap-2">
              <button
                onClick={() => { setMobileMenuOpen(false); onOpenAiConsultant(); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-none text-sm font-medium text-amber-800 bg-amber-50 border border-amber-300"
              >
                <Bot className="w-4 h-4 text-amber-600" />
                <span>咨询 AI 智能电源架构师</span>
              </button>

              <button
                onClick={() => { setMobileMenuOpen(false); onOpenCalculator(); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-none text-sm font-medium text-emerald-800 bg-emerald-50 border border-emerald-300"
              >
                <Calculator className="w-4 h-4 text-emerald-600" />
                <span>智能选型计算器</span>
              </button>

              <button
                onClick={() => { setMobileMenuOpen(false); onOpenQuoteModal(); }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-none text-sm font-semibold text-slate-950 bg-amber-500 hover:bg-amber-400"
              >
                <span>获取方案与专属折扣报价</span>
              </button>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
};

