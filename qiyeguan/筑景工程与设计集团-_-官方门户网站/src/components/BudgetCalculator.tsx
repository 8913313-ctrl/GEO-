import React, { useState } from 'react';
import { BudgetForm, BudgetResult } from '../types';
import { Calculator, ArrowRight, Sparkles, CheckCircle2, ShieldAlert, FileText, Download, Loader2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface BudgetCalculatorProps {
  onOpenBooking: () => void;
}

export const BudgetCalculator: React.FC<BudgetCalculatorProps> = ({ onOpenBooking }) => {
  const [form, setForm] = useState<BudgetForm>({
    projectType: 'commercial',
    area: 350,
    grade: 'luxury',
    style: '现代极简',
    location: '上海市',
    specialRequirements: ''
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BudgetResult | null>(null);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/ai/calculate-budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      const data = await response.json();
      if (data.success) {
        setResult(data);
      }
    } catch (err) {
      console.error('Calculation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const chartData = result ? [
    { name: '主体结构/基建', value: result.breakdown.civilStructure, color: '#1A1A1A' },
    { name: '饰面与主材', value: result.breakdown.materialsDecoration, color: '#C5A27D' },
    { name: '暖通五恒/智能机电', value: result.breakdown.mepSmartHome, color: '#777777' },
    { name: '设计与项目管理', value: result.breakdown.designManagement, color: '#A0A090' }
  ] : [];

  return (
    <section id="budget-calculator" className="py-24 bg-[#F9F9F8] border-t border-[#1A1A1A]/10 relative text-[#1A1A1A]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-xs uppercase tracking-[0.25em] text-[#C5A27D] font-semibold block font-sans">
            AI Budget Calculation / AI 智能造价测算
          </span>
          <h2 className="text-3xl sm:text-4xl font-light text-[#1A1A1A] font-serif tracking-tight">
            建筑工程与装饰造价 AI 测算系统
          </h2>
          <div className="w-12 h-[1px] bg-[#C5A27D] mx-auto my-3" />
          <p className="text-[#666666] text-sm sm:text-base leading-relaxed font-sans">
            基于筑景集团 500+ 项目工程数据库与 Gemini 智能演算，10秒生成造价拆解表与BIM工期预估。
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Input Form Column */}
          <div className="lg:col-span-5 bg-white border border-[#1A1A1A]/10 p-6 sm:p-8 space-y-6 shadow-xs">
            
            <div className="flex items-center justify-between pb-4 border-b border-[#1A1A1A]/10">
              <h3 className="text-lg font-light text-[#1A1A1A] font-serif flex items-center gap-2">
                <Calculator className="w-5 h-5 text-[#C5A27D]" />
                填写工程/装饰参数
              </h3>
              <span className="text-[10px] text-[#1A1A1A] bg-[#F4F4F0] px-2 py-0.5 border border-[#1A1A1A]/10 uppercase tracking-wider font-mono">
                商业与私宅
              </span>
            </div>

            <form onSubmit={handleCalculate} className="space-y-4">
              
              {/* Project Type */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#777777] uppercase tracking-wider">项目类型</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'commercial', label: '商业地标/综合体' },
                    { key: 'office', label: '办公总部大楼' },
                    { key: 'villa', label: '顶奢私宅/大平层' },
                    { key: 'renovation', label: '旧改与结构翻新' }
                  ].map(item => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => setForm({ ...form, projectType: item.key as any })}
                      className={`p-2.5 text-xs font-medium border text-left transition-all ${
                        form.projectType === item.key
                          ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white shadow-xs'
                          : 'bg-[#F4F4F0] border-[#1A1A1A]/10 text-[#555555] hover:border-[#1A1A1A]/30'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Area Input & Slider */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <label className="font-medium text-[#777777] uppercase tracking-wider">建筑/装饰面积 (㎡)</label>
                  <span className="text-[#1A1A1A] font-mono font-bold">{form.area} ㎡</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="5000"
                  step="10"
                  value={form.area}
                  onChange={(e) => setForm({ ...form, area: Number(e.target.value) })}
                  className="w-full accent-[#1A1A1A] bg-[#F4F4F0] h-1.5 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-[#777777] font-mono">
                  <span>50 ㎡</span>
                  <span>1000 ㎡</span>
                  <span>5000 ㎡</span>
                </div>
              </div>

              {/* Finishing Grade */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#777777] uppercase tracking-wider">施工与主材交验标准</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { key: 'standard', label: '标准工程' },
                    { key: 'luxury', label: '奢华精装' },
                    { key: 'ultra_luxury', label: '顶奢全案' }
                  ].map(item => (
                    <button
                      type="button"
                      key={item.key}
                      onClick={() => setForm({ ...form, grade: item.key as any })}
                      className={`py-2 px-3 text-xs font-medium border text-center transition-all ${
                        form.grade === item.key
                          ? 'bg-[#1A1A1A] border-[#1A1A1A] text-white font-bold'
                          : 'bg-[#F4F4F0] border-[#1A1A1A]/10 text-[#555555] hover:border-[#1A1A1A]/30'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Style Selection */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#777777] uppercase tracking-wider">首选设计风格</label>
                <select
                  value={form.style}
                  onChange={(e) => setForm({ ...form, style: e.target.value })}
                  className="w-full bg-[#F4F4F0] border border-[#1A1A1A]/10 p-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                >
                  <option value="现代极简">现代极简 (Modern Minimalist)</option>
                  <option value="工业与高科技钢构">工业与高科技钢构 (High-tech Steel)</option>
                  <option value="东方当代禅意">东方当代禅意 (Oriental Zen)</option>
                  <option value="欧式轻奢与微水泥">欧式轻奢与微水泥 (Micro-cement Luxury)</option>
                  <option value="绿色低碳双银幕墙">绿色低碳双银幕墙 (Green Low-E Glass)</option>
                </select>
              </div>

              {/* City Location */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#777777] uppercase tracking-wider">工程所在城市</label>
                <input
                  type="text"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="例如：上海市 / 杭州市 / 深圳市"
                  className="w-full bg-[#F4F4F0] border border-[#1A1A1A]/10 p-2.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#1A1A1A]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-[#1A1A1A] hover:bg-[#C5A27D] text-white font-medium text-xs sm:text-sm uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gemini AI 引擎精算中...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#C5A27D]" />
                    <span>生成专业工程预算拆解表</span>
                  </>
                )}
              </button>

            </form>

          </div>

          {/* Results Display Column */}
          <div className="lg:col-span-7 space-y-6">
            
            {result ? (
              <div className="bg-white border border-[#1A1A1A]/10 p-6 sm:p-8 space-y-6 shadow-xs animate-fadeIn text-[#1A1A1A]">
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#1A1A1A]/10">
                  <div>
                    <span className="text-xs font-mono text-[#C5A27D] uppercase tracking-widest">
                      ZHUJING AI COST ESTIMATE REPORT
                    </span>
                    <h3 className="text-xl font-light text-[#1A1A1A] font-serif mt-1">
                      工程造价预算拆解分析
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="text-xs text-[#777777] block uppercase tracking-wider">预估总造价 (含税含交验)</span>
                    <span className="text-2xl sm:text-3xl font-light text-[#1A1A1A] font-serif">
                      ¥ {(result.totalEstimate / 10000).toFixed(2)} <span className="text-sm font-sans">万元</span>
                    </span>
                  </div>
                </div>

                {/* Key Summary Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-[#F9F9F8] p-4 border border-[#1A1A1A]/10 text-xs font-sans">
                  <div>
                    <span className="text-[#777777] block uppercase tracking-wider">单方综合造价</span>
                    <span className="text-[#1A1A1A] font-bold font-mono">¥ {result.unitPrice} / ㎡</span>
                  </div>
                  <div>
                    <span className="text-[#777777] block uppercase tracking-wider">BIM 估算工期</span>
                    <span className="text-emerald-700 font-bold font-mono">{result.estimatedDays} 天</span>
                  </div>
                  <div>
                    <span className="text-[#777777] block uppercase tracking-wider">质量交验承诺</span>
                    <span className="text-[#C5A27D] font-bold">闭水48h / 0隐患</span>
                  </div>
                </div>

                {/* Recharts Pie Breakdown */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-wider">
                    四大工程组成造价占比拆解:
                  </h4>
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value: any) => [`¥ ${Number(value).toLocaleString()} 元`, '费用']}
                          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#1a1a1a1a', color: '#1a1a1a' }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Gemini AI Optimization Advice Box */}
                <div className="p-4 bg-[#F4F4F0] border border-[#1A1A1A]/10 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#1A1A1A]">
                    <Sparkles className="w-4 h-4 text-[#C5A27D]" />
                    <span>Gemini AI 资深造价师意见与风控提示:</span>
                  </div>
                  <p className="text-xs text-[#555555] leading-relaxed font-sans">
                    {result.aiAdvice}
                  </p>
                </div>

                {/* Action buttons */}
                <div className="pt-2 flex flex-wrap gap-3">
                  <button
                    onClick={onOpenBooking}
                    className="flex-1 py-3.5 bg-[#1A1A1A] hover:bg-[#C5A27D] text-white font-medium text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>预约造价工程师免费勘测与精算</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>

              </div>
            ) : (
              <div className="bg-white border border-[#1A1A1A]/10 p-10 text-center space-y-4 flex flex-col items-center justify-center min-h-[420px]">
                <div className="w-16 h-16 bg-[#F4F4F0] border border-[#1A1A1A]/10 flex items-center justify-center text-[#1A1A1A]">
                  <Calculator className="w-8 h-8 stroke-[1.5]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-light text-[#1A1A1A] font-serif">请在左侧选择或设置项目参数</h3>
                  <p className="text-xs text-[#666666] max-w-sm font-sans">
                    AI 系统将立即根据您的项目类型、面积与交付标准进行 BIM 级工程算价与明细分配。
                  </p>
                </div>
              </div>
            )}

          </div>

        </div>

      </div>
    </section>
  );
};
