import React, { useState, useEffect } from 'react';
import { Activity, Zap, ShieldAlert, CheckCircle2, Play, RefreshCw, Cpu, Radio, ShieldCheck, Power } from 'lucide-react';

export const VirtualMonitor: React.FC = () => {
  const [isPowerOutage, setIsPowerOutage] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState(98.5);
  const [dischargeSeconds, setDischargeSeconds] = useState(0);
  const [ecoMode, setEcoMode] = useState(false);
  const [simulatedLoadKw, setSimulatedLoadKw] = useState(128.4);

  // Handle battery discharge tick when outage is active
  useEffect(() => {
    let interval: any = null;
    if (isPowerOutage) {
      interval = setInterval(() => {
        setDischargeSeconds((prev) => prev + 1);
        setBatteryLevel((prev) => Math.max(10, prev - 0.05));
      }, 1000);
    } else {
      // Recharge battery when grid is back
      interval = setInterval(() => {
        setBatteryLevel((prev) => Math.min(100, prev + 0.1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPowerOutage]);

  const togglePowerOutage = () => {
    if (!isPowerOutage) {
      setIsPowerOutage(true);
      setDischargeSeconds(0);
    } else {
      setIsPowerOutage(false);
    }
  };

  const gridVoltage = isPowerOutage ? 0 : 380;
  const outputVoltage = 380;
  const transferTimeMs = 0.00;

  return (
    <section id="monitor" className="py-20 bg-slate-50 text-slate-900 relative border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-14">
          <div className="flex items-center justify-center gap-3">
            <div className="h-[2px] w-10 bg-amber-500"></div>
            <span className="text-amber-700 text-xs font-bold uppercase tracking-[0.3em]">云网管 & 断电毫秒级演练系统</span>
            <div className="h-[2px] w-10 bg-amber-500"></div>
          </div>
          <h2 className="text-3xl sm:text-4xl font-light text-slate-900 tracking-tight font-display">
            智能 <span className="font-black text-amber-600 uppercase">UPS 拓扑云监控</span> 与断电演练
          </h2>
          <p className="text-slate-600 text-xs sm:text-sm max-w-2xl mx-auto leading-relaxed">
            在线体验在线双变换（Double-Conversion）拓扑结构。点击下方“模拟市电中断”按键，演练 0ms 无缝切换至蓄电池逆变输出全过程。
          </p>
        </div>

        {/* Dashboard Box */}
        <div className="bg-slate-950 border border-slate-800 rounded-none p-6 sm:p-8 shadow-2xl space-y-8 relative overflow-hidden">
          
          {/* Top Control Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 ${isPowerOutage ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'}`} />
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                  {isPowerOutage ? '⚠️ 市电断开！电池逆变模式 (BATTERY INVERTER ACTIVE)' : '✅ 市电在线双变换模式 (MAIN ONLINE ACTIVE)'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isPowerOutage ? `已持续紧急供电 ${dischargeSeconds} 秒 | 0毫秒无感知无缝衔接` : '电网正常供电中，整流/逆变器高效运行，蓄电池浮充准备'}
                </p>
              </div>
            </div>

            {/* Simulated Outage Action Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={togglePowerOutage}
                className={`flex items-center gap-2 px-5 py-3 rounded-none text-xs font-bold uppercase tracking-widest transition-all shadow-lg ${
                  isPowerOutage
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-emerald-500/20'
                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                }`}
              >
                <Power className="w-4 h-4" />
                <span>{isPowerOutage ? '恢复市电输入 (RESTORE GRID)' : '模拟突发切断市电 (SIMULATE OUTAGE)'}</span>
              </button>

              <button
                onClick={() => setEcoMode(!ecoMode)}
                className={`px-3.5 py-3 rounded-none text-xs font-bold uppercase tracking-wider border transition-all ${
                  ecoMode ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'bg-slate-900 border-slate-800 text-slate-400'
                }`}
              >
                {ecoMode ? 'ECO模式开启 (99.1%效率)' : '开启高节能ECO'}
              </button>
            </div>
          </div>

          {/* Mimic Flow Architecture Chart */}
          <div className="grid md:grid-cols-5 gap-4 items-center text-center">
            
            {/* Node 1: Grid Input */}
            <div className={`p-4 rounded-none border transition-all ${
              gridVoltage > 0
                ? 'bg-slate-900 border-emerald-500/50 text-white'
                : 'bg-slate-900 border-rose-800/80 text-slate-500 opacity-60'
            }`}>
              <div className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mb-1">输入电网 (MAINS GRID)</div>
              <div className="text-xl font-bold font-mono my-1">
                {gridVoltage} <span className="text-xs">Vac</span>
              </div>
              <span className={`inline-block text-[10px] px-2 py-0.5 rounded-none font-mono ${
                gridVoltage > 0 ? 'bg-slate-950 text-emerald-400 border border-slate-800' : 'bg-slate-950 text-rose-400 border border-slate-800'
              }`}>
                {gridVoltage > 0 ? '50.0 Hz 正常' : 'NO INPUT'}
              </span>
            </div>

            {/* Connector Arrow 1 */}
            <div className="hidden md:flex flex-col items-center justify-center">
              <div className={`h-1 w-full transition-all ${
                gridVoltage > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-800'
              }`} />
              <span className="text-[10px] text-slate-500 mt-1 font-mono">整流变换 (RECTIFIER)</span>
            </div>

            {/* Node 2: UPS Core & Battery */}
            <div className="bg-slate-900 p-5 rounded-none border border-cyan-500/40 relative space-y-3">
              <span className="text-[11px] text-cyan-400 font-bold tracking-widest uppercase block font-mono">UPS 母线 & 电池组</span>
              
              <div className="flex items-center justify-between text-xs bg-slate-950 p-2.5 rounded-none border border-slate-800 font-mono">
                <span className="text-slate-400 text-[10px] uppercase">蓄电池容量 (SoC):</span>
                <span className="font-bold text-amber-400">{batteryLevel.toFixed(1)}%</span>
              </div>

              {/* Animated Battery Bar */}
              <div className="w-full h-2 bg-slate-950 overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 ${isPowerOutage ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  style={{ width: `${batteryLevel}%` }}
                />
              </div>

              <div className="text-[11px] font-mono text-cyan-300 flex justify-between">
                <span>延时: <strong className="text-emerald-400">0.00 ms</strong></span>
                <span>{isPowerOutage ? '紧急放电' : '浮充待命'}</span>
              </div>
            </div>

            {/* Connector Arrow 2 */}
            <div className="hidden md:flex flex-col items-center justify-center">
              <div className="h-1 w-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] text-slate-500 mt-1 font-mono">逆变输出 (INVERTER)</span>
            </div>

            {/* Node 3: Critical Load */}
            <div className="bg-slate-900 border border-emerald-500/50 p-4 rounded-none text-white">
              <div className="text-[10px] text-slate-400 font-mono uppercase tracking-widest mb-1">关键负载 (CRITICAL LOAD)</div>
              <div className="text-xl font-bold font-mono text-emerald-400 my-1">
                {outputVoltage} <span className="text-xs text-slate-300">Vac</span>
              </div>
              <span className="inline-block text-[10px] px-2 py-0.5 rounded-none font-mono bg-slate-950 text-emerald-400 border border-slate-800">
                负载功率: {simulatedLoadKw} kW
              </span>
            </div>

          </div>

          {/* Realtime Performance Data Grid */}
          <div className="grid md:grid-cols-3 gap-4 pt-2 font-mono">
            <div className="bg-slate-900 p-4 rounded-none border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">电压畸变率 (THDv)</span>
              <div className="text-base font-bold text-emerald-400">&lt; 1.5% (纯正弦波)</div>
              <p className="text-[10px] text-slate-500">毫秒级无畸变输出，保障精细芯片</p>
            </div>

            <div className="bg-slate-900 p-4 rounded-none border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">断电切换时间</span>
              <div className="text-base font-bold text-cyan-300">0.00 ms (TRUE ZERO)</div>
              <p className="text-[10px] text-slate-500">在线双变换物理结构无接触器过程</p>
            </div>

            <div className="bg-slate-900 p-4 rounded-none border border-slate-800 space-y-1">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">系统整机转换效率</span>
              <div className="text-base font-bold text-amber-400">
                {ecoMode ? '99.1% (ECO节能模式)' : '97.5% (三电平在线式)'}
              </div>
              <p className="text-[10px] text-slate-500">显著节省全生命周期散热电费开支</p>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
