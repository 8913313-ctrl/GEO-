import React, { useState } from 'react';
import {
  Phone,
  Mail,
  MapPin,
  Bot,
  Headphones,
  ShieldCheck,
  Download,
  Search,
  CheckCircle2,
  FileText,
  Clock,
  Sparkles,
  ChevronRight,
  Building,
  HelpCircle,
  Loader2,
  Wrench
} from 'lucide-react';
import { COMPANY_INFO } from '../data/upsData';
import { WarrantyResultSkeleton } from './SkeletonLoader';

interface ContactSupportSectionProps {
  onOpenAiConsultant: () => void;
  onOpenQuoteModal: () => void;
}

export const ContactSupportSection: React.FC<ContactSupportSectionProps> = ({
  onOpenAiConsultant,
  onOpenQuoteModal
}) => {
  const [snQuery, setSnQuery] = useState('');
  const [snResult, setSnResult] = useState<any>(null);
  const [snError, setSnError] = useState('');
  const [isSnLoading, setIsSnLoading] = useState(false);
  const [downloadToast, setDownloadToast] = useState<string | null>(null);

  const handleSnSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSnError('');
    setSnResult(null);

    const query = snQuery.trim().toUpperCase();
    if (!query) {
      setSnError('请输入有效的设备序列号 (SN) 或发票合同号，例如：XSJ2025-889012');
      return;
    }

    setIsSnLoading(true);

    // Mock SN warranty lookup engine
    setTimeout(() => {
      setIsSnLoading(false);
      setSnResult({
        sn: query,
        model: '硕天 OLS3000E 在线双变换 UPS / 山特 C10KS 方案组',
        purchaseDate: '2025-03-15',
        warrantyYears: '山东新硕捷原厂维保与定期免费电池巡检',
        expiryDate: '2028-03-14',
        status: '质保与续保服务生效中',
        serviceLevel: '淄博及山东本地 2小时应急响应 24小时现场施工',
        batteryHealth: '98% (根据工程检测报告，电池组状态极佳)'
      });
    }, 550);
  };

  const downloads = [
    {
      id: 'dl-1',
      title: '山东新硕捷 2026 品牌代采与配电选型综合手册',
      category: '代理手册',
      format: 'PDF',
      size: '22.5 MB',
      updated: '2026-08'
    },
    {
      id: 'dl-2',
      title: '山特 / 硕天 / 华为 / 维谛 / 科士达 机房配电 CAD 施工图集',
      category: 'CAD 图纸',
      format: 'DWG / PDF',
      size: '41.2 MB',
      updated: '2026-07'
    },
    {
      id: 'dl-3',
      title: '圣阳 / 理士 / 汤浅 铅酸蓄电池与锂电组容量测算表',
      category: '工具表单',
      format: 'XLSX / PDF',
      size: '6.8 MB',
      updated: '2026-08'
    },
    {
      id: 'dl-4',
      title: '造纸/医疗/数据中心 UPS 现场接线与防雷施工规范白皮书',
      category: '施工规范',
      format: 'PDF',
      size: '8.4 MB',
      updated: '2026-06'
    },
    {
      id: 'dl-5',
      title: '山东新硕捷电子科技有限公司 法人营业执照与授权资质包',
      category: '合规资质',
      format: 'ZIP',
      size: '12.1 MB',
      updated: '2026-05'
    }
  ];

  const triggerDownload = (title: string) => {
    setDownloadToast(`正在启动《${title}》安全下载...`);
    setTimeout(() => {
      setDownloadToast(null);
    }, 3500);
  };

  return (
    <section id="contact-support" className="py-16 bg-slate-50 text-slate-900 relative border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-16">

        {/* Header */}
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="flex items-center justify-center gap-3">
            <div className="h-[2px] w-10 bg-amber-500"></div>
            <span className="text-amber-800 text-xs font-bold uppercase tracking-[0.25em]">山东淄博总部 • 7×24H 派工服务网络</span>
            <div className="h-[2px] w-10 bg-amber-500"></div>
          </div>
          <h2 className="text-3xl sm:text-4xl font-light text-slate-900 tracking-tight font-display">
            联系新硕捷与 <span className="font-black text-amber-600 uppercase">工程技术支持中心</span>
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
            提供直拨服务热线 18678123345、工程维保状态查询、AI选型架构师咨询及品牌代理资质与配电CAD图纸下载。
          </p>
        </div>

        {/* Section 1: Contact Cards Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          
          {/* Card 1: 24/7 Hotline */}
          <div className="bg-white border border-slate-200 p-6 space-y-4 hover:border-amber-500 transition-all shadow-xs">
            <div className="w-10 h-10 bg-amber-100 border border-amber-300 flex items-center justify-center">
              <Headphones className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <span className="text-[10px] text-amber-800 font-bold uppercase tracking-widest font-mono">工程师直拨与紧急派工电话</span>
              <h3 className="text-xl font-black text-slate-900 font-mono tracking-wider mt-1">
                <a href="tel:18678123345" className="hover:text-amber-600 transition-colors">18678123345</a>
              </h3>
              <p className="text-xs text-slate-600 mt-1">工程师接听，现场问题随时沟通与预约勘察</p>
            </div>
            <div className="pt-3 border-t border-slate-200 text-xs space-y-1.5 font-mono text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">淄博及省内派工:</span>
                <span className="text-slate-900 font-medium">18678123345</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">服务响应时效:</span>
                <span className="text-emerald-700 font-bold">7×24小时 值守</span>
              </div>
            </div>
          </div>

          {/* Card 2: Email & Business Channel */}
          <div className="bg-white border border-slate-200 p-6 space-y-4 hover:border-amber-500 transition-all shadow-xs">
            <div className="w-10 h-10 bg-amber-100 border border-amber-300 flex items-center justify-center">
              <Mail className="w-5 h-5 text-amber-800" />
            </div>
            <div>
              <span className="text-[10px] text-amber-800 font-bold uppercase tracking-widest font-mono">官方邮箱与方案接洽</span>
              <h3 className="text-sm font-bold text-slate-900 font-mono mt-1">70712289@qq.com</h3>
              <p className="text-xs text-slate-600 mt-1">发图纸、索取代采清单与公对公合同对接</p>
            </div>
            <div className="pt-3 border-t border-slate-200 text-xs space-y-1.5 font-mono text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">图纸标书投递:</span>
                <span className="text-slate-900 font-medium">70712289@qq.com</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">开票与合规采购:</span>
                <span className="text-slate-900 font-medium">山东新硕捷财务部</span>
              </div>
            </div>
          </div>

          {/* Card 3: Online AI Consultant Entry */}
          <div className="bg-gradient-to-br from-white via-amber-50/50 to-amber-100/60 border border-amber-300 p-6 space-y-4 flex flex-col justify-between shadow-xs">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Bot className="w-6 h-6" />
                </div>
                <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] font-bold px-2 py-0.5 uppercase tracking-widest font-mono">
                  ● 实时选型服务中
                </span>
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900 uppercase font-display">
                  AI 电源选型与品牌对比架构师
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  快速对比山特、硕天、华为、维谛、科士达等型号差异，自动测算后备电池需求。
                </p>
              </div>
            </div>

            <button
              onClick={onOpenAiConsultant}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-md shadow-amber-500/20"
            >
              <Sparkles className="w-4 h-4" />
              <span>对话 AI 电源选型架构师</span>
            </button>
          </div>

        </div>

        {/* Base Address Box */}
        <div className="bg-white border border-slate-200 p-6 sm:p-8 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
            <Building className="w-5 h-5 text-amber-600" />
            <h3 className="text-lg font-bold text-slate-900 uppercase font-display">
              公司实体驻地与售后大本营
            </h3>
          </div>

          <div className="grid md:grid-cols-2 gap-6 text-xs text-slate-700 font-mono">
            <div className="space-y-2 bg-slate-50 p-4 border border-slate-200">
              <span className="text-amber-800 font-bold uppercase tracking-wider block">🏢 山东新硕捷办公总部:</span>
              <p className="text-slate-800"><strong className="text-slate-500">地址：</strong>{COMPANY_INFO.address}</p>
              <p className="text-slate-600"><strong className="text-slate-500">业务范围：</strong>UPS电源/蓄电池推广销售、选型设计、低价代采与技术咨询</p>
            </div>

            <div className="space-y-2 bg-slate-50 p-4 border border-slate-200">
              <span className="text-amber-800 font-bold uppercase tracking-wider block">🔧 施工工程与售后巡检部:</span>
              <p className="text-slate-800"><strong className="text-slate-500">工程服务：</strong>现场勘察、线路连接、系统调试、电池组检测及更换</p>
              <p className="text-slate-600"><strong className="text-slate-500">服务承诺：</strong>淄博及山东省内快速现场到场派工响应</p>
            </div>
          </div>
        </div>

        {/* Section 2: Warranty & SN Lookup */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Warranty Policy */}
          <div className="lg:col-span-7 bg-white border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
            <div>
              <span className="text-amber-800 text-xs font-bold uppercase tracking-widest font-mono">XINSHUOJIE GUARANTEE</span>
              <h3 className="text-2xl font-bold text-slate-900 uppercase font-display mt-1">
                山东新硕捷 工厂落地服务承诺
              </h3>
            </div>

            <div className="grid sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-4 border border-slate-200 space-y-1">
                <span className="text-emerald-800 font-bold font-mono">100% 正品保障与厂家质保</span>
                <p className="text-slate-600">所有山特、硕天、华为、圣阳、理士等设备均系原厂正品直发，带防伪验证。</p>
              </div>

              <div className="bg-slate-50 p-4 border border-slate-200 space-y-1">
                <span className="text-amber-800 font-bold font-mono">现场施工与零地电压调测</span>
                <p className="text-slate-600">由经验丰富的技术人员负责施工铺线、电池架组装及全套系统联动测试。</p>
              </div>

              <div className="bg-slate-50 p-4 border border-slate-200 space-y-1">
                <span className="text-amber-800 font-bold font-mono">蓄电池组检测与现场更换</span>
                <p className="text-slate-600">针对容量衰减旧电池，携带专业内阻仪现场排查，支持不停机规范更换。</p>
              </div>

              <div className="bg-slate-50 p-4 border border-slate-200 space-y-1">
                <span className="text-purple-800 font-bold font-mono">7×24H 值守与后续续保</span>
                <p className="text-slate-600">提供长期的系统续保、定期巡检与突发发电机/电网闪络应急排除服务。</p>
              </div>
            </div>
          </div>

          {/* SN Lookup Tool */}
          <div className="lg:col-span-5 bg-white border border-amber-300 p-6 sm:p-8 space-y-6 shadow-xs">
            <div>
              <span className="text-amber-800 text-xs font-bold uppercase tracking-widest font-mono">EQUIPMENT WARRANTY CHECKER</span>
              <h3 className="text-xl font-bold text-slate-900 uppercase font-display mt-1">
                工程设备与维保档案查询
              </h3>
              <p className="text-xs text-slate-600 mt-1">
                请输入您的设备 SN 码或合同号，查询新硕捷落地方案的质保状态。
              </p>
            </div>

            <form onSubmit={handleSnSearch} className="space-y-3">
              <div className="relative">
                <input
                  type="text"
                  value={snQuery}
                  onChange={(e) => setSnQuery(e.target.value)}
                  placeholder="例如: XSJ2025-889012"
                  className="w-full bg-slate-50 border border-slate-300 focus:border-amber-500 text-slate-900 text-xs p-3 font-mono rounded-none outline-none"
                />
                <button
                  type="submit"
                  disabled={isSnLoading}
                  className="absolute right-1 top-1 bottom-1 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider flex items-center gap-1 disabled:opacity-70"
                >
                  {isSnLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>{isSnLoading ? '检索中' : '查询'}</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-500 font-mono">
                💡 示例编码：<span className="text-amber-700 cursor-pointer underline" onClick={() => setSnQuery('XSJ2025-889012')}>XSJ2025-889012</span>（点击填入测试）
              </p>
            </form>

            {snError && (
              <p className="text-xs text-rose-700 font-mono bg-rose-50 p-2.5 border border-rose-200">
                {snError}
              </p>
            )}

            {isSnLoading ? (
              <WarrantyResultSkeleton />
            ) : (
              snResult && (
                <div className="bg-slate-50 p-4 border border-amber-300 space-y-2 text-xs font-mono animate-in fade-in duration-200">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-slate-500">维保编号:</span>
                    <span className="text-amber-800 font-bold">{snResult.sn}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">工程型号:</span>
                    <span className="text-slate-800 text-right font-medium">{snResult.model}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">交付日期:</span>
                    <span className="text-slate-700">{snResult.purchaseDate}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">质保到期日:</span>
                    <span className="text-emerald-700 font-bold">{snResult.expiryDate}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-slate-500">服务状态:</span>
                    <span className="text-emerald-800 font-bold bg-emerald-100 px-2 py-0.5 border border-emerald-300">
                      {snResult.status}
                    </span>
                  </div>
                  <div className="pt-1 text-[11px] text-slate-600">
                    派工级别：{snResult.serviceLevel}
                  </div>
                </div>
              )
            )}
          </div>

        </div>

        {/* Download Center */}
        <div id="download-center" className="bg-white border border-slate-200 p-6 sm:p-8 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <span className="text-amber-800 text-xs font-bold uppercase tracking-widest font-mono">RESOURCE DOWNLOAD CENTER</span>
              <h3 className="text-2xl font-bold text-slate-900 uppercase font-display mt-1">
                资料与下载中心 (代采手册、CAD图纸、电池容量表)
              </h3>
            </div>
            <p className="text-xs text-slate-600 max-w-md">
              官方提供最新选型手册、数据中心图纸及新硕捷工程资质文件下载。
            </p>
          </div>

          {/* Download Toast */}
          {downloadToast && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 px-4 py-3 text-xs font-mono flex items-center justify-between animate-in slide-in-from-top duration-200">
              <span className="flex items-center gap-2">
                <Download className="w-4 h-4 text-amber-600 animate-bounce" />
                {downloadToast}
              </span>
              <span className="text-[10px] text-amber-700 uppercase font-bold">请检查浏览器下载任务</span>
            </div>
          )}

          {/* Download Table */}
          <div className="divide-y divide-slate-200 border border-slate-200 bg-white">
            {downloads.map((item) => (
              <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-4 h-4 text-amber-800" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-bold font-mono px-1.5 py-0.5">
                        {item.category}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">格式: {item.format} | 大小: {item.size}</span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-800 mt-1 uppercase">
                      {item.title}
                    </h4>
                  </div>
                </div>

                <button
                  onClick={() => triggerDownload(item.title)}
                  className="px-4 py-2 bg-slate-100 hover:bg-amber-500 hover:text-slate-950 text-slate-800 font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 border border-slate-300 transition-all shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>立即下载</span>
                </button>
              </div>
            ))}
          </div>

        </div>

      </div>
    </section>
  );
};
