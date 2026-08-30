import React from 'react';
import { Zap, Phone, Mail, MapPin, ShieldCheck, ChevronRight, Building } from 'lucide-react';
import { COMPANY_INFO } from '../data/upsData';

interface FooterProps {
  setActiveSection: (section: string) => void;
  onOpenQuoteModal: () => void;
  onOpenCalculator: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  setActiveSection,
  onOpenQuoteModal,
  onOpenCalculator,
}) => {
  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="bg-slate-900 text-slate-300 text-xs border-t border-slate-800 font-sans">
      
      {/* Top CTA Banner */}
      <div className="bg-white border-b border-slate-200 py-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="text-amber-800 font-bold uppercase tracking-[0.2em] text-[10px] block mb-1 font-mono">山东省淄博市 • 代理直供与工厂落地</span>
            <h3 className="text-xl sm:text-2xl font-light text-slate-900 font-display">
              需要为您的机房、医院或车间挑选 <span className="font-bold text-amber-600 uppercase">品牌UPS与电池</span>？
            </h3>
            <p className="text-slate-600 text-xs mt-1">即刻联系山东新硕捷，获取山特/硕天/华为/维谛/科士达低价代采清单与施工接线图纸。</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenCalculator}
              className="px-4 py-3 rounded-none text-xs font-bold uppercase tracking-wider bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300"
            >
              容量与电池计算
            </button>
            <button
              onClick={onOpenQuoteModal}
              className="px-5 py-3 rounded-none text-xs font-bold uppercase tracking-widest text-slate-950 bg-amber-500 hover:bg-amber-400 shadow-md shadow-amber-500/20"
            >
              获取代理特惠底价
            </button>
          </div>
        </div>
      </div>

      {/* Main Footer Links */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-2 md:grid-cols-5 gap-8">
        
        {/* Col 1: Brand Info (2 cols wide) */}
        <div className="col-span-2 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-none bg-amber-500 text-slate-950 font-bold">
              <Zap className="w-5 h-5 fill-current" />
            </div>
            <span className="text-base font-bold text-white uppercase font-display tracking-wider">山东新硕捷电子科技有限公司</span>
          </div>

          <p className="text-slate-400 leading-relaxed max-w-sm text-xs">
            专注于IDC数据中心基础设施和电源保障系统的工厂落地服务商。代理山特、硕天、华为、维蒂、施耐德、科华、科士达、易事特、山顿UPS及圣阳、理士、汤浅电池。
          </p>

          <div className="space-y-1.5 text-slate-300 text-xs font-mono">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-amber-400 shrink-0" />
              <span>服务热线: <a href="tel:18678123345" className="text-white text-sm font-mono hover:text-amber-400">18678123345</a></span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-slate-400 shrink-0" />
              <span>电子邮箱: 70712289@qq.com</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
              <span>地址: {COMPANY_INFO.address}</span>
            </div>
          </div>
        </div>

        {/* Col 2: Brands & Products */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-widest font-mono">代理品牌中心</h4>
          <ul className="space-y-2 text-slate-400">
            <li><button onClick={() => scrollTo('agency-brands')} className="hover:text-amber-400 font-bold text-amber-400 transition-colors">★ 代理品牌实力与授权资质</button></li>
            <li><button onClick={() => scrollTo('products')} className="hover:text-amber-400 transition-colors">山特 (SANTAK) 在线式UPS</button></li>
            <li><button onClick={() => scrollTo('products')} className="hover:text-amber-400 transition-colors">硕天 (CyberPower) 专业电源</button></li>
            <li><button onClick={() => scrollTo('products')} className="hover:text-amber-400 transition-colors">华为 UPS5000 模块化机柜</button></li>
            <li><button onClick={() => scrollTo('products')} className="hover:text-amber-400 transition-colors">维谛 Liebert ITA2 架构</button></li>
            <li><button onClick={() => scrollTo('products')} className="hover:text-amber-400 transition-colors">圣阳/理士/汤浅 蓄电池组</button></li>
          </ul>
        </div>

        {/* Col 3: Services & Solutions */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-widest font-mono">工程落地服务</h4>
          <ul className="space-y-2 text-slate-400">
            <li><button onClick={() => scrollTo('services')} className="hover:text-amber-400 transition-colors">现场勘察与负载容积分析</button></li>
            <li><button onClick={() => scrollTo('services')} className="hover:text-amber-400 transition-colors">原厂正品低价代采购</button></li>
            <li><button onClick={() => scrollTo('services')} className="hover:text-amber-400 transition-colors">配电柜、缆线与主备施工</button></li>
            <li><button onClick={() => scrollTo('services')} className="hover:text-amber-400 transition-colors">老旧蓄电池检修与替代更换</button></li>
            <li><button onClick={() => scrollTo('services')} className="hover:text-amber-400 transition-colors">7×24H 淄博及省内现场响应</button></li>
          </ul>
        </div>

        {/* Col 4: Quick Links */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-white uppercase tracking-widest font-mono">关于与支持</h4>
          <ul className="space-y-2 text-slate-400">
            <li><button onClick={() => scrollTo('about')} className="hover:text-amber-400 transition-colors">关于新硕捷与经营理念</button></li>
            <li><button onClick={() => scrollTo('cases')} className="hover:text-amber-400 transition-colors">12大真实工程标杆案例</button></li>
            <li><button onClick={() => scrollTo('contact-support')} className="hover:text-amber-400 transition-colors">设备与维保档案查询</button></li>
            <li><button onClick={() => scrollTo('download-center')} className="hover:text-amber-400 transition-colors">代采手册与CAD图纸下载</button></li>
            <li><button onClick={() => scrollTo('faq')} className="hover:text-amber-400 transition-colors">选型与维保常见疑问解答</button></li>
          </ul>
        </div>

      </div>

      {/* Copyright Bar */}
      <div className="bg-slate-950 border-t border-slate-800 py-6 px-4 text-center text-slate-500 text-[11px] font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 山东新硕捷电子科技有限公司 保留所有权利。服务商基址：淄博市张店区世源大厦1210房</span>
          <div className="flex gap-4 text-slate-500 uppercase">
            <span>鲁ICP备2025098112号</span>
            <span>隐私政策</span>
            <span>服务协议</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
