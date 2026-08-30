import React, { useState } from 'react';
import { Send, X, CheckCircle2, Phone, Building, Mail, User, ShieldCheck } from 'lucide-react';

interface QuoteRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
}

export const QuoteRequestModal: React.FC<QuoteRequestModalProps> = ({
  isOpen,
  onClose,
  initialData,
}) => {
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    companyName: '',
    contactName: '',
    phone: '',
    email: '',
    industry: initialData?.industry || '数据中心',
    powerKw: initialData?.powerKw || '50',
    backupTime: initialData?.backupTime || '1小时',
    notes: initialData?.recommendedModel ? `参考需求型号: ${initialData.recommendedModel}` : '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-none max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
        
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-none text-slate-400 hover:text-slate-700 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <span className="text-xs text-amber-800 font-semibold uppercase tracking-wider block mb-1">直连山东新硕捷技术工程师</span>
              <h3 className="text-xl font-bold text-slate-900 font-display">获取方案图纸与品牌代采低价报价</h3>
              <p className="text-xs text-slate-500 mt-1">提交需求后，山东新硕捷技术专家将在 15 分钟内与您联系，提供多品牌比价与施工方案成本清单。</p>
            </div>

            <div className="space-y-3 pt-2 text-xs">
              <div>
                <label className="text-slate-700 font-semibold block mb-1">公司/单位名称 *</label>
                <input
                  required
                  type="text"
                  placeholder="例如：华为技术有限公司 / 四川大学华西医院"
                  value={formData.companyName}
                  onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                  className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded-none p-2.5 outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">联系人姓名 *</label>
                  <input
                    required
                    type="text"
                    placeholder="张经理"
                    value={formData.contactName}
                    onChange={(e) => setFormData({ ...formData, contactName: e.target.value })}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded-none p-2.5 outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">联系电话 *</label>
                  <input
                    required
                    type="tel"
                    placeholder="13800138000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded-none p-2.5 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-700 font-semibold block mb-1">大致负载功率 (kW)</label>
                  <input
                    type="text"
                    placeholder="例如：50 kW"
                    value={formData.powerKw}
                    onChange={(e) => setFormData({ ...formData, powerKw: e.target.value })}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded-none p-2.5 outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-slate-700 font-semibold block mb-1">续航时间需求</label>
                  <input
                    type="text"
                    placeholder="例如：2小时"
                    value={formData.backupTime}
                    onChange={(e) => setFormData({ ...formData, backupTime: e.target.value })}
                    className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded-none p-2.5 outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-700 font-semibold block mb-1">项目具体说明 / 特殊要求</label>
                <textarea
                  rows={3}
                  placeholder="可注明：环境防尘要求、是否需要防爆柜、包含安装施工、招投标预算等..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full bg-slate-50 text-slate-900 border border-slate-300 rounded-none p-2.5 outline-none focus:border-amber-500 resize-none"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-none font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 shadow-sm transition-all text-xs"
            >
              提交申请，获取专属报价及配电图纸
            </button>
          </form>
        ) : (
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-700 border border-emerald-300 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 font-display">询价与方案申请已成功提交！</h3>
            <p className="text-xs text-slate-600 leading-relaxed max-w-sm mx-auto">
              非常感谢！山东新硕捷技术工程师正在审核您的选型参数，将会在 <strong className="text-amber-800">15 分钟内</strong> 与您联系（{formData.phone}），并发送品牌比价方案至您的邮箱。
            </p>
            <div className="pt-2">
              <button
                onClick={() => { setSubmitted(false); onClose(); }}
                className="px-6 py-2.5 rounded-none text-xs font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 border border-slate-300"
              >
                返回网站首页
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
