import React, { useState, useEffect } from 'react';
import { Building2, Phone, Calculator, Calendar, ChevronRight, Menu, X, ShieldCheck } from 'lucide-react';

interface NavbarProps {
  onOpenCalculator: () => void;
  onOpenBooking: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenCalculator,
  onOpenBooking
}) => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header
      id="main-navbar"
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#F9F9F8]/95 backdrop-blur-md shadow-sm border-b border-[#1A1A1A]/10 py-3.5'
          : 'bg-[#F9F9F8]/80 backdrop-blur-sm border-b border-[#1A1A1A]/5 py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          {/* Brand Logo */}
          <div
            id="brand-logo"
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <div className="w-9 h-9 bg-[#1A1A1A] flex items-center justify-center text-white transition-transform group-hover:bg-[#C5A27D]">
              <Building2 className="w-5 h-5 stroke-[1.8]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-light tracking-tight text-[#1A1A1A] font-serif uppercase">
                  ZHUJING <span className="italic font-serif text-[#C5A27D]">/ 筑景工程</span>
                </span>
                <span className="text-[10px] px-2 py-0.5 bg-[#C5A27D]/10 text-[#C5A27D] border border-[#C5A27D]/30 font-semibold tracking-wider uppercase">
                  特级/甲级
                </span>
              </div>
              <p className="text-[9px] tracking-[0.25em] text-[#777777] font-sans uppercase">
                ARCHITECTURE & INTERIOR DESIGN
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav id="desktop-nav" className="hidden lg:flex items-center gap-8 text-xs font-medium tracking-widest uppercase text-[#555555]">
            <button
              onClick={() => scrollToSection('business-sectors')}
              className="hover:text-[#1A1A1A] transition-colors"
            >
              业务领域
            </button>
            <button
              onClick={() => scrollToSection('project-gallery')}
              className="hover:text-[#1A1A1A] transition-colors"
            >
              精品案例
            </button>
            <button
              onClick={() => scrollToSection('craft-showcase')}
              className="hover:text-[#1A1A1A] transition-colors"
            >
              精工与BIM
            </button>
            <button
              onClick={() => scrollToSection('floorplan-explorer')}
              className="hover:text-[#1A1A1A] transition-colors flex items-center gap-1.5"
            >
              3D展厅
              <span className="w-1.5 h-1.5 rounded-full bg-[#C5A27D] animate-pulse"></span>
            </button>
            <button
              onClick={() => scrollToSection('company-strength')}
              className="hover:text-[#1A1A1A] transition-colors"
            >
              资质荣誉
            </button>
          </nav>

          {/* Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {/* AI Budget Calculator Trigger */}
            <button
              id="nav-calc-btn"
              onClick={onOpenCalculator}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#C5A27D]/10 hover:bg-[#C5A27D]/20 text-[#C5A27D] text-[11px] font-semibold tracking-wider uppercase border border-[#C5A27D]/40 transition-all"
            >
              <Calculator className="w-3.5 h-3.5 text-[#C5A27D]" />
              <span>AI 估算造价</span>
            </button>

            {/* Primary Consultation Booking */}
            <button
              id="nav-booking-btn"
              onClick={onOpenBooking}
              className="flex items-center gap-1.5 px-5 py-2 border border-[#1A1A1A] bg-[#1A1A1A] text-white hover:bg-[#C5A27D] hover:border-[#C5A27D] text-xs uppercase tracking-widest font-medium transition-colors"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>预约设计</span>
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <div className="lg:hidden flex items-center gap-2">
            <button
              onClick={onOpenCalculator}
              className="p-2 border border-[#1A1A1A] text-[#1A1A1A] text-xs"
            >
              <Calculator className="w-4 h-4" />
            </button>
            <button
              id="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 border border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-white transition-colors"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#F9F9F8] border-b border-[#1A1A1A]/10 px-6 pt-4 pb-6 space-y-3 mt-3 animate-fadeIn text-xs uppercase tracking-widest">
          <button
            onClick={() => scrollToSection('business-sectors')}
            className="block w-full text-left py-2 font-medium text-[#1A1A1A] border-b border-[#1A1A1A]/10"
          >
            业务领域 (工程与装饰)
          </button>
          <button
            onClick={() => scrollToSection('project-gallery')}
            className="block w-full text-left py-2 font-medium text-[#1A1A1A] border-b border-[#1A1A1A]/10"
          >
            精品案例中心
          </button>
          <button
            onClick={() => scrollToSection('craft-showcase')}
            className="block w-full text-left py-2 font-medium text-[#1A1A1A] border-b border-[#1A1A1A]/10"
          >
            施工工艺与BIM
          </button>
          <button
            onClick={() => scrollToSection('floorplan-explorer')}
            className="block w-full text-left py-2 font-medium text-[#1A1A1A] border-b border-[#1A1A1A]/10"
          >
            3D 空间展厅
          </button>
          <button
            onClick={() => scrollToSection('company-strength')}
            className="block w-full text-left py-2 font-medium text-[#1A1A1A] border-b border-[#1A1A1A]/10"
          >
            资质荣誉与品牌
          </button>

          <div className="pt-2 space-y-2">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenCalculator();
              }}
              className="w-full py-2.5 bg-[#C5A27D]/10 text-[#C5A27D] text-xs font-semibold flex items-center justify-center gap-2 border border-[#C5A27D]/30"
            >
              <Calculator className="w-4 h-4" />
              AI 智能算造价
            </button>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenBooking();
              }}
              className="w-full py-2.5 bg-[#1A1A1A] text-white text-xs font-medium flex items-center justify-center gap-2 uppercase tracking-widest"
            >
              <Calendar className="w-4 h-4" />
              免费预约测量 / 设计
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
