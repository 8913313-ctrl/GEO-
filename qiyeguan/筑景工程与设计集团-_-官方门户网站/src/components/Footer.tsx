import React from 'react';
import { Building2, Phone, Mail, MapPin, ShieldCheck, Award, ArrowUp, QrCode } from 'lucide-react';

interface FooterProps {
  onOpenCalculator: () => void;
  onOpenBooking: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenCalculator,
  onOpenBooking
}) => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-[#1A1A1A] text-[#888888] border-t border-[#1A1A1A] pt-16 pb-12 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        
        {/* Top Footer Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8">
          
          {/* Brand & Mission */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-[#C5A27D] flex items-center justify-center text-white shadow-xs">
                <Building2 className="w-6 h-6 stroke-[2]" />
              </div>
              <div>
                <span className="text-xl font-light text-white font-serif tracking-tight">筑景工程与装饰集团</span>
                <p className="text-[10px] tracking-widest text-[#AAAAAA] uppercase font-mono">ZHUJING ARCHITECTURE & INTERIOR</p>
              </div>
            </div>
            
            <p className="text-xs text-[#999999] leading-relaxed max-w-sm font-sans">
              具备国家建筑工程施工总承包一级与建筑装饰工程设计专项甲级资质。致力于将德国精工施工标准与国际顶级室内建筑美学完美相融。
            </p>

            <div className="flex items-center gap-2 pt-2 text-xs text-[#C5A27D] font-mono uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-[#C5A27D]" />
              <span>特级/甲级资质认证 · 闭水48h零渗漏承诺</span>
            </div>
          </div>

          {/* Core Services */}
          <div className="space-y-3 text-xs">
            <h4 className="text-sm font-light text-white font-serif uppercase tracking-wider">工程与设计服务</h4>
            <ul className="space-y-2">
              <li><a href="#business-sectors" className="hover:text-[#C5A27D] transition-colors">建筑工程施工总承包</a></li>
              <li><a href="#business-sectors" className="hover:text-[#C5A27D] transition-colors">商业与总部大楼装饰</a></li>
              <li><a href="#business-sectors" className="hover:text-[#C5A27D] transition-colors">顶奢私宅与豪宅全案定制</a></li>
              <li><a href="#business-sectors" className="hover:text-[#C5A27D] transition-colors">城市更新与旧建改造</a></li>
              <li><a href="#craft-showcase" className="hover:text-[#C5A27D] transition-colors">BIM 5D 数字化三维建模</a></li>
            </ul>
          </div>

          {/* Quick Tools */}
          <div className="space-y-3 text-xs">
            <h4 className="text-sm font-light text-white font-serif uppercase tracking-wider">快捷系统与工具</h4>
            <ul className="space-y-2">
              <li>
                <button onClick={onOpenCalculator} className="hover:text-[#C5A27D] transition-colors text-left">
                  AI 智能造价预算测算
                </button>
              </li>
              <li>
                <button onClick={onOpenBooking} className="hover:text-[#C5A27D] transition-colors text-left">
                  预约免费上门量房勘测
                </button>
              </li>
              <li><a href="#floorplan-explorer" className="hover:text-[#C5A27D] transition-colors">3D 户型与材质在线展厅</a></li>
              <li><a href="#project-gallery" className="hover:text-[#C5A27D] transition-colors">鲁班奖案例作品库</a></li>
            </ul>
          </div>

          {/* Contact Information */}
          <div className="space-y-3 text-xs">
            <h4 className="text-sm font-light text-white font-serif uppercase tracking-wider">全国统一工程咨询热线</h4>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[#C5A27D] font-light text-lg font-serif tracking-tight">
                <Phone className="w-4 h-4" />
                <span>400-888-9999</span>
              </div>
              <p className="text-[11px] text-[#777777]">服务时间：周一至周日 08:30 - 21:00</p>
            </div>

            <div className="space-y-1.5 pt-2 text-[#888888]">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#888888] shrink-0 mt-0.5" />
                <span>总部大楼：上海市浦东新区陆家嘴金融中心筑景大厦 28F</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#888888] shrink-0" />
                <span>contact@zhujing-group.com</span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Rights & Legal Bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#777777]">
          <div>
            <p>© 2026 筑景工程与装饰集团有限公司 版权所有 | 沪ICP备 18099888号-1</p>
            <p className="text-[10px] text-[#666666] mt-0.5">建筑工程施工总承包一级 证书编号：D131098271 | 建筑装饰设计甲级 编号：A131098271</p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={scrollToTop}
              className="p-2.5 bg-white/10 border border-white/10 text-white hover:bg-[#C5A27D] transition-colors"
              title="返回顶部"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </footer>
  );
};
