import React, { useState } from 'react';
import { Calendar, Phone, User, Building, MapPin, CheckCircle, X, Loader2, ShieldCheck } from 'lucide-react';
import { submitPublicLead } from '../api/leadClient';

interface ConsultationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ConsultationModal: React.FC<ConsultationModalProps> = ({ isOpen, onClose }) => {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    projectType: '商业与总部装修',
    area: '',
    city: '上海市',
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [submittedResult, setSubmittedResult] = useState<{ leadId: string; message: string } | null>(null);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;
    setLoading(true);
    setError('');

    try {
      const data = await submitPublicLead({
        name: formData.name,
        phone: formData.phone,
        company: '',
        service: formData.projectType,
        website: window.location.href,
        message: `面积：${formData.area || '未提供'}；城市/地址：${formData.city}；备注：${formData.notes}`,
        source_url: window.location.href
      });
      setSubmittedResult({ leadId: data.id || data.leadId || '已受理', message: data.message || '提交成功，项目顾问会尽快与您联系。' });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : '提交失败，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSubmittedResult(null);
    setFormData({
      name: '',
      phone: '',
      projectType: '商业与总部装修',
      area: '',
      city: '上海市',
      notes: ''
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#1A1A1A]/60 backdrop-blur-xs animate-fadeIn">
      <div className="relative bg-white border border-[#1A1A1A]/20 max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl text-[#1A1A1A]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1A1A1A]/10">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F4F4F0] text-[#1A1A1A] border border-[#1A1A1A]/10">
              <Calendar className="w-5 h-5 text-[#C5A27D]" />
            </div>
            <div>
              <h3 className="text-lg font-light text-[#1A1A1A] font-serif tracking-tight">
                预约资深工程专家与主案设计勘测
              </h3>
              <p className="text-xs text-[#777777] font-sans">免费量房 / 方案立项 / 造价测算 (2小时内响应)</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-[#777777] hover:text-[#1A1A1A] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {submittedResult ? (
          <div className="text-center py-6 space-y-4 animate-fadeIn">
            <div className="w-16 h-16 bg-[#F4F4F0] border border-[#1A1A1A]/10 text-emerald-700 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xl font-light text-[#1A1A1A] font-serif">预约申请提交成功！</h4>
              <p className="text-xs text-[#555555] leading-relaxed max-w-sm mx-auto font-sans">
                {submittedResult.message}
              </p>
            </div>

            <div className="p-3 bg-[#F4F4F0] border border-[#1A1A1A]/10 text-xs font-mono text-[#1A1A1A]">
              工单编号: {submittedResult.leadId}
            </div>

            <button
              onClick={handleReset}
              className="px-6 py-2.5 bg-[#1A1A1A] hover:bg-[#C5A27D] text-white font-medium text-xs uppercase tracking-widest transition-colors"
            >
              完成并返回
            </button>
            {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 font-sans">
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#777777] uppercase tracking-wider">您的姓名 *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#777777] absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="如：李经理 / 张先生"
                    className="w-full bg-[#F4F4F0] border border-[#1A1A1A]/10 py-2.5 pl-9 pr-3 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#777777] uppercase tracking-wider">联系电话 *</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-[#777777] absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="如：138 0000 0000"
                    className="w-full bg-[#F4F4F0] border border-[#1A1A1A]/10 py-2.5 pl-9 pr-3 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-medium text-[#777777] uppercase tracking-wider">需求工程类型</label>
                <select
                  value={formData.projectType}
                  onChange={(e) => setFormData({ ...formData, projectType: e.target.value })}
                  className="w-full bg-[#F4F4F0] border border-[#1A1A1A]/10 p-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                >
                  <option value="商业与总部装修">商业与总部大楼装饰</option>
                  <option value="建筑工程总承包">建筑工程总承包/幕墙</option>
                  <option value="顶奢豪宅全案">顶奢豪宅私宅全案</option>
                  <option value="城市更新与旧改">城市更新与旧改改造</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-[#777777] uppercase tracking-wider">预估面积 (㎡)</label>
                <input
                  type="number"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                  placeholder="如：500"
                  className="w-full bg-[#F4F4F0] border border-[#1A1A1A]/10 p-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#777777] uppercase tracking-wider">项目所在城市 / 具体地址</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="如：上海浦东新区陆家嘴"
                className="w-full bg-[#F4F4F0] border border-[#1A1A1A]/10 p-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#777777] uppercase tracking-wider">具体诉求 / 备注说明 (选填)</label>
              <textarea
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="请输入您的具体施工期、预算范围或现场特殊交验要求..."
                className="w-full bg-[#F4F4F0] border border-[#1A1A1A]/10 p-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
              />
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[#777777]">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>筑景集团严格保护您的隐私，绝不泄露个人与企业商业信息。</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#1A1A1A] hover:bg-[#C5A27D] text-white font-medium text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>提交预约中...</span>
                </>
              ) : (
                <span>提交并预约免费专家上门量房与初步方案</span>
              )}
            </button>

          </form>
        )}

      </div>
    </div>
  );
};
