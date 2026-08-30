import React, { useState, useMemo } from 'react';
import { CalculatorState, CalculationResult } from '../types';
import { PRODUCTS } from '../data/upsData';
import { Calculator, Cpu, Battery, ShieldCheck, Download, Bot, RefreshCw, ChevronRight, CheckCircle2, Sparkles, Layers, Sliders, Loader2 } from 'lucide-react';
import { CalculatorMatrixSkeleton } from './SkeletonLoader';

interface CalculatorSectionProps {
  onOpenAiConsultantWithData?: (data: any) => void;
  onOpenQuoteModalWithData?: (data: any) => void;
}

export const CalculatorSection: React.FC<CalculatorSectionProps> = ({
  onOpenAiConsultantWithData,
  onOpenQuoteModalWithData,
}) => {
  const [calcState, setCalcState] = useState<CalculatorState>({
    powerKw: 50,
    powerFactor: 0.9,
    backupTimeMinutes: 60,
    batteryType: 'lifepo4',
    redundancy: 'N+1',
    environment: 'datacenter',
  });
  const [isRecalculating, setIsRecalculating] = useState<boolean>(false);

  const updateCalcState = (newPartial: Partial<CalculatorState>) => {
    setIsRecalculating(true);
    setCalcState(prev => ({ ...prev, ...newPartial }));
    setTimeout(() => {
      setIsRecalculating(false);
    }, 220);
  };

  // Perform engineering calculations
  const result: CalculationResult = useMemo(() => {
    const { powerKw, powerFactor, backupTimeMinutes, batteryType, redundancy, environment } = calcState;

    // 1. Calculate required kVA
    const rawKva = powerFactor > 0 ? powerKw / powerFactor : powerKw;
    // Apply 25% safety margin for optimal efficiency and lifetime
    const minKvaWithMargin = rawKva * 1.25;

    // Determine standard rating
    let recommendedKva = 10;
    if (minKvaWithMargin <= 10) recommendedKva = 10;
    else if (minKvaWithMargin <= 20) recommendedKva = 20;
    else if (minKvaWithMargin <= 30) recommendedKva = 30;
    else if (minKvaWithMargin <= 60) recommendedKva = 60;
    else if (minKvaWithMargin <= 100) recommendedKva = 100;
    else if (minKvaWithMargin <= 200) recommendedKva = 200;
    else if (minKvaWithMargin <= 300) recommendedKva = 300;
    else if (minKvaWithMargin <= 500) recommendedKva = 500;
    else recommendedKva = Math.ceil(minKvaWithMargin / 100) * 100;

    // Redundancy multiplier
    const totalKvaSystem = redundancy === '2N' ? recommendedKva * 2 : (redundancy === 'N+1' ? recommendedKva + 25 : recommendedKva);

    // Recommend Model Series
    let recommendedCategory: 'high-freq' | 'modular' | 'industrial' | 'outdoor-storage' = 'high-freq';
    let modelSeries = 'AN-HF 智能在线式系列';
    let recommendedModel = `AN-HF ${recommendedKva}kVA 智能在线式UPS`;

    if (environment === 'industrial') {
      recommendedCategory = 'industrial';
      modelSeries = 'AN-IND 重工业防尘抗冲系列';
      recommendedModel = `AN-IND ${recommendedKva}kVA 工业工频隔离变压器UPS`;
    } else if (environment === 'outdoor') {
      recommendedCategory = 'outdoor-storage';
      modelSeries = 'AN-ESS 锂电户外一体化系列';
      recommendedModel = `AN-ESS ${powerKw}kW 户外防护柜一体机`;
    } else if (recommendedKva >= 50 || environment === 'datacenter') {
      recommendedCategory = 'modular';
      modelSeries = 'AN-MOD 超高效模块化系列';
      recommendedModel = `AN-MOD ${recommendedKva}kVA 模块化数据中心UPS (N+X冗余)`;
    }

    // 2. Calculate Battery Ah
    // Inverter efficiency ~ 0.95
    const inverterEfficiency = 0.95;
    // DC Bus voltage depending on scale
    let dcBusVoltage = 384; // standard 32 x 12V
    if (recommendedKva <= 20) dcBusVoltage = 192; // 16 x 12V
    if (recommendedKva >= 200) dcBusVoltage = 480; // 40 x 12V

    const hours = backupTimeMinutes / 60;
    // Discharge depth coefficient (Lead acid ~ 0.8, LiFePO4 ~ 0.92)
    const dodCoeff = batteryType === 'lifepo4' ? 0.92 : 0.80;

    const requiredEnergyWh = (powerKw * 1000 * hours) / (inverterEfficiency * dodCoeff);
    const rawBatteryAh = requiredEnergyWh / dcBusVoltage;

    // Standard Ah rounding
    let batteryCapacityAh = 100;
    if (rawBatteryAh <= 38) batteryCapacityAh = 38;
    else if (rawBatteryAh <= 65) batteryCapacityAh = 65;
    else if (rawBatteryAh <= 100) batteryCapacityAh = 100;
    else if (rawBatteryAh <= 150) batteryCapacityAh = 150;
    else if (rawBatteryAh <= 200) batteryCapacityAh = 200;
    else batteryCapacityAh = Math.ceil(rawBatteryAh / 50) * 50;

    // Battery count calculation
    let singleUnitVoltage = batteryType === 'lifepo4' ? 51.2 : 12;
    let unitsPerString = Math.round(dcBusVoltage / singleUnitVoltage);
    let parallelStrings = Math.max(1, Math.round(rawBatteryAh / batteryCapacityAh));
    let totalBatteryCount = unitsPerString * parallelStrings;

    // Heat & Space
    const heatDissipationBtu = Math.round(powerKw * 3412.14 * (1 - 0.96));
    const estimatedSpaceU = recommendedKva > 100 ? 42 : (recommendedKva > 30 ? 24 : 12);
    const efficiencyPercent = batteryType === 'lifepo4' ? 97.5 : 96.0;

    const notes = [
      `建议保留 20%~25% 系统功率裕度，以便后续扩容及降低器件应力。`,
      `按 ${backupTimeMinutes} 分钟满载放电计算，DC 母线电压设定为 ${dcBusVoltage}V。`,
      batteryType === 'lifepo4' 
        ? `使用磷酸铁锂电池（LFP），循环寿命达 6000+ 次，重量仅为同等铅酸电池的 1/3，节省空间 50%。`
        : `使用阀控密封式免维护铅酸蓄电池，设计寿命 8-10 年，成本亲民，成熟可靠。`,
      redundancy === 'N+1' 
        ? `已配置 N+1 功率模块冗余，单个模块故障时无缝接管，业务不受任何影响。`
        : redundancy === '2N' 
          ? `已配置 2N 架构（双独立A/B回路），提供最高金融级安全保障。`
          : `单机 N 模式，性价比极高，推荐用于标准办公或单点备份。`
    ];

    return {
      powerKva: Math.round(rawKva * 10) / 10,
      recommendedModel,
      modelSeries,
      recommendedCategory,
      batteryCapacityAh,
      batteryVoltageV: dcBusVoltage,
      batteryStrings: parallelStrings,
      totalBatteryCount,
      estimatedSpaceU,
      heatDissipationBtu,
      efficiencyPercent,
      notes,
    };
  }, [calcState]);

  // Download PDF summary report
  const handleDownloadReport = () => {
    const reportText = `
=== 山东新硕捷电子科技有限公司 UPS选型与电池容量计算报告 ===
生成时间: ${new Date().toLocaleString('zh-CN')}

一、项目选型需求:
- 实际负载功率: ${calcState.powerKw} kW
- 功率因数 (PF): ${calcState.powerFactor}
- 视在功率: ${result.powerKva} kVA
- 期望后备续航: ${calcState.backupTimeMinutes} 分钟
- 电池类型: ${calcState.batteryType === 'lifepo4' ? '高能磷酸铁锂 (LFP)' : '阀控密封铅酸 (AGM/GEL)'}
- 冗余构架: ${calcState.redundancy}
- 应用场景: ${calcState.environment === 'datacenter' ? '数据中心机房' : calcState.environment === 'industrial' ? '工业车间防尘' : calcState.environment === 'outdoor' ? '户外一体化' : '标准办公环境'}

二、系统推荐方案:
- 推荐匹配型号与代采品牌: ${result.recommendedModel}
- 直流母线电压: ${result.batteryVoltageV} Vdc
- 电池组配置: ${result.batteryCapacityAh}Ah × ${result.totalBatteryCount} 节 (${result.batteryStrings} 组并联)
- 系统整机效率: ${result.efficiencyPercent}%
- 机柜高度预估: ${result.estimatedSpaceU} U
- 散热发热量预估: ${result.heatDissipationBtu} BTU/hr

三、架构说明与工程建议:
${result.notes.map(n => `- ${n}`).join('\n')}

服务商: 山东新硕捷电子科技有限公司
地址: 山东省淄博市张店区新村西路223号世源大厦1210房
工程与报价直拨热线: 18678123345
邮箱: 70712289@qq.com
`;

    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `山东新硕捷_UPS选型计算报告_${calcState.powerKw}kW.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section id="calculator" className="py-20 bg-slate-50 text-slate-900 relative border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Section Title */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
          <div className="flex items-center justify-center gap-3">
            <div className="h-[2px] w-10 bg-amber-500"></div>
            <span className="text-amber-700 text-xs font-bold uppercase tracking-[0.3em]">工程级选型与电池计算引擎</span>
            <div className="h-[2px] w-10 bg-amber-500"></div>
          </div>
          <h2 className="text-3xl sm:text-4xl font-light text-slate-900 tracking-tight font-display">
            智能 <span className="font-black text-amber-600 uppercase">UPS 选型与电池容量</span> 计算器
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
            输入您的设备负载功率与期望续航时间，实时精确计算视在功率（kVA）、推荐UPS系列型号、电池串并联数量及散热空间需求。
          </p>
        </div>

        {/* Main Grid: Inputs vs Realtime Results */}
        <div className="grid lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Interactive Inputs (7 cols) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-none p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Sliders className="w-4 h-4 text-amber-600" />
                <span>1. 输入供电需求参数</span>
              </h3>
              <button
                onClick={() => updateCalcState({
                  powerKw: 50,
                  powerFactor: 0.9,
                  backupTimeMinutes: 60,
                  batteryType: 'lifepo4',
                  redundancy: 'N+1',
                  environment: 'datacenter',
                })}
                className="text-[11px] text-slate-500 hover:text-amber-600 font-mono uppercase tracking-wider flex items-center gap-1 transition-colors"
              >
                <RefreshCw className="w-3 h-3" /> 重置参数
              </button>
            </div>

            {/* Load Power Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <label className="font-bold text-slate-800 uppercase tracking-wider">实际设备总功率 (kW)</label>
                <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1 rounded-none border border-slate-300">
                  <input
                    type="number"
                    min="1"
                    max="800"
                    value={calcState.powerKw}
                    onChange={(e) => updateCalcState({ powerKw: Math.max(1, Number(e.target.value)) })}
                    className="w-16 bg-transparent text-right font-mono font-bold text-amber-700 outline-none"
                  />
                  <span className="text-xs text-slate-500 font-mono">kW</span>
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="500"
                step="1"
                value={calcState.powerKw}
                onChange={(e) => updateCalcState({ powerKw: Number(e.target.value) })}
                className="w-full accent-amber-500 h-2 bg-slate-200 cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>1 kW (微机房)</span>
                <span>50 kW (中型数据中心)</span>
                <span>200 kW (核心机房)</span>
                <span>500 kW (算力中心)</span>
              </div>
            </div>

            {/* Power Factor & Backup Time */}
            <div className="grid sm:grid-cols-2 gap-5">
              {/* Power Factor */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">设备功率因数 (PF)</label>
                <select
                  value={calcState.powerFactor}
                  onChange={(e) => updateCalcState({ powerFactor: Number(e.target.value) })}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-none px-3.5 py-2.5 text-xs focus:border-amber-500 outline-none font-mono"
                >
                  <option value={1.0}>PF = 1.0 (现代IT服务器/新型数据中心)</option>
                  <option value={0.9}>PF = 0.9 (通用网络设备/混合IT负载)</option>
                  <option value={0.8}>PF = 0.8 (传统电机/工业感性负载)</option>
                </select>
              </div>

              {/* Backup Duration */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">期望断电续航时间</label>
                <select
                  value={calcState.backupTimeMinutes}
                  onChange={(e) => updateCalcState({ backupTimeMinutes: Number(e.target.value) })}
                  className="w-full bg-slate-50 text-slate-800 border border-slate-300 rounded-none px-3.5 py-2.5 text-xs focus:border-amber-500 outline-none font-mono"
                >
                  <option value={15}>15 分钟 (等待发电机启动)</option>
                  <option value={30}>30 分钟 (标准机房缓冲)</option>
                  <option value={60}>1 小时 (标准充分保障时间)</option>
                  <option value={120}>2 小时 (高重要度关键业务保障)</option>
                  <option value={240}>4 小时 (长延时独立续航)</option>
                  <option value={480}>8 小时 (无人值守极限制)</option>
                </select>
              </div>
            </div>

            {/* Battery Type & Redundancy Selection */}
            <div className="grid sm:grid-cols-2 gap-5">
              {/* Battery Type */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">储能电池类型</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => updateCalcState({ batteryType: 'lifepo4' })}
                    className={`px-3 py-2.5 rounded-none text-xs font-bold uppercase tracking-wider border transition-all text-center ${
                      calcState.batteryType === 'lifepo4'
                        ? 'bg-amber-100 border-amber-500 text-amber-900'
                        : 'bg-slate-50 border-slate-300 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    磷酸铁锂 (LFP)
                    <span className="block text-[10px] text-emerald-700 font-normal mt-0.5">寿命长/占地小</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => updateCalcState({ batteryType: 'lead-acid' })}
                    className={`px-3 py-2.5 rounded-none text-xs font-bold uppercase tracking-wider border transition-all text-center ${
                      calcState.batteryType === 'lead-acid'
                        ? 'bg-amber-100 border-amber-500 text-amber-900'
                        : 'bg-slate-50 border-slate-300 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    密封铅酸 (AGM/GEL)
                    <span className="block text-[10px] font-normal mt-0.5 text-slate-500">成熟低成本</span>
                  </button>
                </div>
              </div>

              {/* Redundancy */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">系统冗余备份模式</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'N', label: '单机 N', sub: '性价比' },
                    { id: 'N+1', label: 'N + 1', sub: '模块冗余' },
                    { id: '2N', label: '2N 双路', sub: '金融A/B' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => updateCalcState({ redundancy: item.id as any })}
                      className={`px-2 py-2.5 rounded-none text-xs font-bold uppercase tracking-wider border transition-all text-center ${
                        calcState.redundancy === item.id
                          ? 'bg-amber-500 border-amber-500 text-slate-950 font-black'
                          : 'bg-slate-50 border-slate-300 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {item.label}
                      <span className="block text-[10px] text-slate-500 font-normal mt-0.5">{item.sub}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Operating Environment */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-slate-700 block uppercase tracking-wider">部署使用环境</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'datacenter', label: '标准数据中心' },
                  { id: 'industrial', label: '重工业/粉尘车间' },
                  { id: 'office', label: '办公弱电间' },
                  { id: 'outdoor', label: '户外基站卡口' },
                ].map((env) => (
                  <button
                    key={env.id}
                    type="button"
                    onClick={() => updateCalcState({ environment: env.id as any })}
                    className={`p-2.5 rounded-none text-xs font-bold uppercase tracking-wider border text-center transition-all ${
                      calcState.environment === env.id
                        ? 'bg-amber-500 border-amber-500 text-slate-950 font-black'
                        : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {env.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Right Column: Calculated Results & Proposal Card (5 cols) */}
          <div className="lg:col-span-5 bg-slate-900 text-white border border-slate-800 rounded-none p-6 sm:p-8 space-y-6 shadow-xl relative overflow-hidden">

            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">2. 计算生成的推荐方案</h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-none uppercase flex items-center gap-1.5">
                {isRecalculating && <Loader2 className="w-3 h-3 animate-spin text-amber-400" />}
                {isRecalculating ? 'CALCULATING...' : 'REALTIME RESULT'}
              </span>
            </div>

            {isRecalculating ? (
              <CalculatorMatrixSkeleton />
            ) : (
              <>
                {/* Recommended Model Highlight Box */}
                <div className="bg-slate-950 p-4 rounded-none border border-amber-500/50 space-y-2 animate-in fade-in duration-200">
              <span className="text-[10px] text-amber-400 font-mono uppercase tracking-widest block">系统匹配标配型号:</span>
              <div className="text-xl font-black text-white uppercase font-display">
                {result.recommendedModel}
              </div>
              <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-mono">
                <span className="bg-slate-900 text-slate-300 px-2 py-0.5 border border-slate-800">
                  视在功率: <strong className="text-white">{result.powerKva} kVA</strong>
                </span>
                <span className="bg-slate-900 text-slate-300 px-2 py-0.5 border border-slate-800">
                  整机效率: <strong className="text-emerald-400">{result.efficiencyPercent}%</strong>
                </span>
                <span className="bg-slate-900 text-slate-300 px-2 py-0.5 border border-slate-800">
                  冗余: <strong className="text-amber-400">{calcState.redundancy}</strong>
                </span>
              </div>
            </div>

            {/* Battery Spec Details */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 font-mono">
                <Battery className="w-4 h-4 text-amber-400" /> 储能蓄电池组配置明细
              </h4>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="bg-slate-950 p-3 rounded-none border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">直流母线电压</span>
                  <span className="text-sm font-bold text-white">{result.batteryVoltageV} Vdc</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-none border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">建议电池容量</span>
                  <span className="text-sm font-bold text-amber-400">{result.batteryCapacityAh} Ah</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-none border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">电池配置数量</span>
                  <span className="text-sm font-bold text-white">{result.totalBatteryCount} 节 ({result.batteryStrings}组)</span>
                </div>

                <div className="bg-slate-950 p-3 rounded-none border border-slate-800">
                  <span className="text-slate-400 block text-[10px] uppercase">预估占地/高度</span>
                  <span className="text-sm font-bold text-amber-300">约 {result.estimatedSpaceU} U 机柜</span>
                </div>
              </div>
            </div>

            {/* Engineering Notes */}
            <div className="bg-slate-950 p-4 rounded-none border border-slate-800 space-y-2 text-xs font-mono">
              <span className="font-bold text-amber-400 block flex items-center gap-1 uppercase tracking-wider">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> 工程师选型建议:
              </span>
              <ul className="space-y-1 text-slate-300 list-disc list-inside leading-relaxed text-[11px]">
                {result.notes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>

            {/* Actions Buttons */}
            <div className="space-y-2 pt-2">
              <button
                onClick={handleDownloadReport}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-none text-xs font-bold uppercase tracking-wider text-slate-100 bg-slate-950 hover:bg-slate-800 border border-slate-800 transition-all"
              >
                <Download className="w-4 h-4 text-amber-400" />
                <span>导出选型计算报告 (.txt)</span>
              </button>

              {onOpenAiConsultantWithData && (
                <button
                  onClick={() => onOpenAiConsultantWithData({
                    powerKw: calcState.powerKw,
                    powerKva: result.powerKva,
                    powerFactor: calcState.powerFactor,
                    backupTime: `${calcState.backupTimeMinutes}分钟`,
                    redundancy: calcState.redundancy,
                    environment: calcState.environment,
                    recommendedModel: result.recommendedModel
                  })}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-none text-xs font-bold uppercase tracking-wider text-amber-300 bg-slate-950 border border-amber-500/40 hover:bg-slate-800 transition-all"
                >
                  <Bot className="w-4 h-4 text-amber-400" />
                  <span>提交给 AI 工程师二次评估</span>
                </button>
              )}

              {onOpenQuoteModalWithData && (
                <button
                  onClick={() => onOpenQuoteModalWithData({
                    powerKw: calcState.powerKw,
                    powerKva: result.powerKva,
                    backupTime: `${calcState.backupTimeMinutes}分钟`,
                    recommendedModel: result.recommendedModel,
                    batteryType: calcState.batteryType,
                  })}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-none text-xs font-bold uppercase tracking-widest text-slate-950 bg-amber-500 hover:bg-amber-400 transition-all shadow-md shadow-amber-500/20"
                >
                  <span>索取官方报价与图纸</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
              </>
            )}

          </div>

        </div>

      </div>
    </section>
  );
};
