import React, { useState } from 'react';
import { CERTIFICATES, FAQS, FACTORY_RD_IMAGE, COMPANY_INFO } from '../data/upsData';
import { ShieldCheck, Award, Building, CheckCircle, ChevronDown, ChevronUp, MapPin, Phone, Mail, Wrench, PackageCheck, Zap } from 'lucide-react';

export const AboutCertificates: React.FC = () => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <section id="about" className="py-16 bg-white text-slate-900 relative border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-16">
        
        {/* Company Profile */}
        <div className="grid lg:grid-cols-12 gap-10 items-center">
          
          <div className="lg:col-span-7 space-y-5">
            <div className="flex items-center gap-3">
              <div className="h-[2px] w-8 bg-amber-500"></div>
              <span className="text-amber-800 text-xs font-bold uppercase tracking-[0.25em]">关于山东新硕捷电子</span>
            </div>

            <h2 className="text-3xl sm:text-4xl font-light text-slate-900 tracking-tight font-display">
              专注于 <span className="font-black text-amber-600 uppercase">IDC数据中心基础设施 & 电源保障</span> 工厂落地服务
            </h2>

            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              山东新硕捷电子科技有限公司坐落于山东省淄博市张店区新村西路223号世源大厦1210房。我们是一家专注于IDC数据中心基础设施和电源保障系统的工厂落地服务商与品牌代理分销商。
            </p>
            <p className="text-slate-600 text-xs sm:text-sm leading-relaxed">
              公司主要代理和销售 <strong className="text-slate-900 font-bold">山特、硕天、华为、维蒂、施耐德、科华、科士达、易事特、山顿</strong> 等知名UPS电源，以及 <strong className="text-slate-900 font-bold">圣阳、理士、汤浅、西恩迪、童氏、风帆</strong> 等原厂蓄电池。我们围绕客户实际用电需求，为数据中心、通信机房、医院、银行、学校、工业企业、政府机关及公共事业单位提供一站式电源系统解决方案。
            </p>

            {/* Culture & Goal Box */}
            <div className="p-4 bg-amber-50 border border-amber-200 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-amber-900 font-bold">
                <Building className="w-4 h-4 text-amber-600" />
                <span>公司经营理念与宗旨:</span>
              </div>
              <p className="text-amber-950 font-mono font-bold">
                『 {COMPANY_INFO.philosophy} 』
              </p>
              <p className="text-amber-800">
                服务目标：{COMPANY_INFO.goal}。
              </p>
            </div>

            {/* Quick Stat Tiles */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono pt-1">
              <div className="bg-slate-50 p-3 rounded-none border border-slate-200">
                <span className="text-xl font-bold text-slate-900 font-mono block">淄博张店</span>
                <span className="text-slate-500 mt-0.5 block uppercase text-[10px]">世源大厦1210号基地</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-none border border-slate-200">
                <span className="text-xl font-bold text-amber-700 font-mono block">10+ 品牌</span>
                <span className="text-slate-500 mt-0.5 block uppercase text-[10px]">原厂授权与直供</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-none border border-slate-200">
                <span className="text-xl font-bold text-emerald-700 font-mono block">14 项</span>
                <span className="text-slate-500 mt-0.5 block uppercase text-[10px]">全流程施工与运维工程</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-none border border-slate-200">
                <span className="text-xl font-bold text-blue-700 font-mono block">7×24H</span>
                <span className="text-slate-500 mt-0.5 block uppercase text-[10px]">本地与全国应急响应</span>
              </div>
            </div>
          </div>

          {/* Right Image Display & Address Card */}
          <div className="lg:col-span-5 space-y-4">
            <div className="relative rounded-none overflow-hidden border border-slate-200 shadow-xl h-64 lg:h-[320px]">
              <img
                src={FACTORY_RD_IMAGE}
                alt="Shandong Xinshuojie Team"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="text-xs text-amber-400 font-bold uppercase tracking-widest block font-mono">工程现场图景</span>
                <p className="text-base font-bold text-white uppercase font-display mt-0.5">
                  严苛标准化施工、柜体接线与老旧电池检测替换现场
                </p>
              </div>
            </div>

            {/* Contact Details Card */}
            <div className="bg-slate-900 text-white p-4 border border-slate-800 space-y-2.5 text-xs font-mono">
              <div className="flex items-center gap-2 text-amber-400 font-bold border-b border-slate-800 pb-2">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>联系我们与办公驻地</span>
              </div>
              <div className="space-y-1.5 text-slate-300">
                <p><strong className="text-slate-400">公司全称：</strong>{COMPANY_INFO.name}</p>
                <p><strong className="text-slate-400">地址：</strong>{COMPANY_INFO.address}</p>
                <p><strong className="text-slate-400">服务热线：</strong><a href="tel:18678123345" className="text-amber-400 underline">{COMPANY_INFO.phone}</a></p>
                <p><strong className="text-slate-400">电子邮箱：</strong><a href="mailto:70712289@qq.com" className="text-slate-200 underline">{COMPANY_INFO.email}</a></p>
              </div>
            </div>
          </div>

        </div>

        {/* 14 Engineering Services Grid */}
        <div id="services" className="space-y-6 pt-6 border-t border-slate-200">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-[0.25em] block">服务商核心能力</span>
            <h3 className="text-2xl font-light text-slate-900 font-display">
              山东新硕捷 <span className="font-bold text-amber-600 uppercase">14步工程落地体系</span>
            </h3>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            {COMPANY_INFO.engineeringServices.map((service, idx) => (
              <div key={idx} className="bg-slate-50 p-3.5 border border-slate-200 flex items-start gap-2.5 hover:border-amber-400 transition-colors">
                <span className="w-5 h-5 bg-amber-500 text-slate-950 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                  {idx + 1}
                </span>
                <span className="font-medium text-slate-800">{service}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Certificates & Qualifications Grid */}
        <div className="space-y-6 pt-4 border-t border-slate-200">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-[0.25em] block">原厂授权与资质</span>
            <h3 className="text-2xl font-light text-slate-900 font-display">品牌代理授权与 <span className="font-bold text-amber-600 uppercase">工程资质</span></h3>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {CERTIFICATES.map((cert) => (
              <div
                key={cert.id}
                className="bg-slate-50 p-3.5 rounded-none border border-slate-200 text-center space-y-1.5 hover:border-amber-500 transition-all shadow-xs"
              >
                <div className="w-9 h-9 rounded-none bg-white text-amber-700 border border-slate-200 flex items-center justify-center mx-auto">
                  <Award className="w-4 h-4" />
                </div>
                <span className="text-[10px] text-slate-500 block uppercase font-mono">{cert.category}</span>
                <h4 className="text-xs font-bold text-slate-800 line-clamp-2 uppercase">{cert.title}</h4>
                <span className="text-[9px] text-amber-800 font-mono block font-medium">编号: {cert.code}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQs Section */}
        <div id="faq" className="space-y-6 pt-6 border-t border-slate-200">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-xs font-bold text-amber-800 uppercase tracking-[0.25em] block">常见疑问与解答</span>
            <h3 className="text-2xl font-light text-slate-900 font-display">合作解答与 <span className="font-bold text-amber-600 uppercase">技术咨询</span></h3>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {FAQS.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="bg-slate-50 border border-slate-200 rounded-none overflow-hidden transition-all shadow-xs"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full text-left p-4 flex items-center justify-between gap-4 font-bold text-xs uppercase tracking-wider text-slate-800 hover:text-amber-700"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-amber-600 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 text-xs text-slate-600 leading-relaxed border-t border-slate-200 pt-3 bg-white font-normal">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
};
