import React from 'react';
import { Zap, ShieldCheck, Cpu } from 'lucide-react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200 bg-[length:200%_100%] animate-pulse ${className}`}
    />
  );
};

// Skeleton for Product Catalog Grid
export const ProductGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white border border-slate-200 rounded-none overflow-hidden shadow-xs p-0 flex flex-col justify-between"
        >
          {/* Top Image Placeholder */}
          <div className="h-52 bg-slate-100 p-4 relative flex flex-col justify-between">
            <Skeleton className="w-24 h-6 rounded-none" />
            <div className="flex justify-between items-end">
              <Skeleton className="w-28 h-5 rounded-none" />
              <Skeleton className="w-20 h-5 rounded-none" />
            </div>
          </div>

          {/* Details Placeholder */}
          <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-2">
              <Skeleton className="w-20 h-3 rounded-none" />
              <Skeleton className="w-3/4 h-6 rounded-none" />
              <Skeleton className="w-full h-4 rounded-none" />
              <Skeleton className="w-5/6 h-4 rounded-none" />
            </div>

            {/* Spec lines */}
            <div className="space-y-2 pt-3 border-t border-slate-200">
              <div className="flex justify-between">
                <Skeleton className="w-16 h-3" />
                <Skeleton className="w-24 h-3" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="w-16 h-3" />
                <Skeleton className="w-20 h-3" />
              </div>
              <div className="flex justify-between">
                <Skeleton className="w-16 h-3" />
                <Skeleton className="w-16 h-3" />
              </div>
            </div>

            {/* Buttons */}
            <div className="pt-3 flex gap-2">
              <Skeleton className="flex-1 h-9 rounded-none" />
              <Skeleton className="flex-1 h-9 rounded-none" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Skeleton for Industry Solution Detail Card
export const SolutionDetailSkeleton: React.FC = () => {
  return (
    <div className="bg-white border border-slate-200 rounded-none overflow-hidden shadow-md grid lg:grid-cols-12 gap-0 animate-in fade-in duration-300">
      <div className="lg:col-span-5 h-72 lg:h-auto min-h-[320px] bg-slate-200 p-6 flex flex-col justify-end space-y-3">
        <Skeleton className="w-20 h-5 bg-slate-300" />
        <Skeleton className="w-3/4 h-8 bg-slate-300" />
        <Skeleton className="w-full h-4 bg-slate-300" />
        <Skeleton className="w-2/3 h-4 bg-slate-300" />
      </div>

      <div className="lg:col-span-7 p-6 sm:p-8 space-y-6 bg-white">
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="space-y-3">
            <Skeleton className="w-32 h-4" />
            <Skeleton className="w-full h-10" />
            <Skeleton className="w-full h-10" />
            <Skeleton className="w-full h-10" />
          </div>
          <div className="space-y-3">
            <Skeleton className="w-32 h-4" />
            <Skeleton className="w-full h-10" />
            <Skeleton className="w-full h-10" />
            <Skeleton className="w-full h-10" />
          </div>
        </div>

        <div className="bg-slate-50 p-4 border border-slate-200 space-y-2">
          <Skeleton className="w-28 h-3" />
          <Skeleton className="w-1/2 h-5" />
          <Skeleton className="w-full h-4" />
        </div>

        <div className="pt-4 border-t border-slate-200 flex justify-between items-center">
          <Skeleton className="w-40 h-6" />
          <Skeleton className="w-32 h-9" />
        </div>
      </div>
    </div>
  );
};

// Skeleton for Success Cases Grid
export const CasesGridSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="grid md:grid-cols-3 gap-6 animate-in fade-in duration-300">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="bg-white border border-slate-200 p-0 rounded-none overflow-hidden space-y-4">
          <div className="h-52 bg-slate-200 relative p-4 flex justify-between items-end">
            <Skeleton className="w-20 h-5" />
            <Skeleton className="w-24 h-5" />
          </div>
          <div className="p-6 space-y-4">
            <Skeleton className="w-3/4 h-6" />
            <Skeleton className="w-full h-4" />
            <Skeleton className="w-5/6 h-4" />
            <div className="bg-slate-50 p-3 border border-slate-200 space-y-2">
              <Skeleton className="w-20 h-3" />
              <Skeleton className="w-full h-4" />
            </div>
            <div className="pt-4 border-t border-slate-200 flex justify-between">
              <Skeleton className="w-28 h-4" />
              <Skeleton className="w-24 h-4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

// Skeleton for Warranty Search Result
export const WarrantyResultSkeleton: React.FC = () => {
  return (
    <div className="bg-slate-50 p-4 border border-amber-300 space-y-3 font-mono animate-in fade-in duration-200">
      <div className="flex justify-between items-center border-b border-slate-200 pb-2">
        <Skeleton className="w-16 h-3" />
        <Skeleton className="w-28 h-4" />
      </div>
      <div className="flex justify-between border-b border-slate-200 pb-1.5">
        <Skeleton className="w-20 h-3" />
        <Skeleton className="w-48 h-3" />
      </div>
      <div className="flex justify-between border-b border-slate-200 pb-1.5">
        <Skeleton className="w-24 h-3" />
        <Skeleton className="w-20 h-3" />
      </div>
      <div className="flex justify-between border-b border-slate-200 pb-1.5">
        <Skeleton className="w-20 h-3" />
        <Skeleton className="w-24 h-3" />
      </div>
      <div className="flex justify-between border-b border-slate-200 pb-1.5">
        <Skeleton className="w-16 h-3" />
        <Skeleton className="w-20 h-5" />
      </div>
    </div>
  );
};

// Skeleton for Calculator Recalculation
export const CalculatorMatrixSkeleton: React.FC = () => {
  return (
    <div className="space-y-4 animate-in fade-in duration-200">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-100 p-4 border border-slate-200 space-y-2">
          <Skeleton className="w-20 h-3" />
          <Skeleton className="w-24 h-7" />
        </div>
        <div className="bg-slate-100 p-4 border border-slate-200 space-y-2">
          <Skeleton className="w-20 h-3" />
          <Skeleton className="w-24 h-7" />
        </div>
      </div>
      <div className="bg-slate-100 p-4 border border-slate-200 space-y-2">
        <Skeleton className="w-28 h-3" />
        <Skeleton className="w-full h-8" />
      </div>
    </div>
  );
};

// Booting Splash Skeleton Screen for First Load
export const InitialPageBootSkeleton: React.FC<{ progress: number }> = ({ progress }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-8 animate-in fade-in duration-300 font-mono">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-amber-500 text-slate-950 font-bold flex items-center justify-center shadow-lg shadow-amber-500/30 animate-pulse">
          <Zap className="w-7 h-7 fill-current" />
        </div>
        <div>
          <h1 className="text-xl font-black uppercase tracking-widest font-display text-white">
            山东新硕捷 <span className="text-amber-500">XINSHUOJIE</span>
          </h1>
          <p className="text-[10px] text-slate-400 tracking-wider uppercase">
            IDC数据中心基础设施与电源保障系统服务商
          </p>
        </div>
      </div>

      {/* Industrial Progress Status */}
      <div className="w-full max-w-md space-y-2">
        <div className="flex justify-between text-xs text-slate-400">
          <span className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-amber-400 animate-spin" />
            <span>自检模块数据与电能仿真拓扑...</span>
          </span>
          <span className="text-amber-400 font-bold">{progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-emerald-400 transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[10px] text-slate-500 text-center">
          DSP 全数字算法核心加载中 • 三电平逆变自检 • 0ms 零切总线准备就绪
        </p>
      </div>

      {/* Structural Wireframe Placeholder */}
      <div className="w-full max-w-3xl opacity-20 border border-slate-700 p-6 space-y-4 rounded-none">
        <div className="h-8 bg-slate-800 w-1/3"></div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-24 bg-slate-800"></div>
          <div className="h-24 bg-slate-800"></div>
          <div className="h-24 bg-slate-800"></div>
        </div>
      </div>
    </div>
  );
};
