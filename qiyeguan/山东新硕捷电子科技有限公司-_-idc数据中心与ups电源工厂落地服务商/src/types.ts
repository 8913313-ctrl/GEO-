export interface Product {
  id: string;
  name: string;
  brand: string; // e.g. "山特", "硕天", "华为", "维谛", "施耐德", "科士达", "科华", "易事特", "圣阳", "理士", "汤浅"
  series: string;
  category: 'ups' | 'battery' | 'eps-stabilizer' | 'idc-storage';
  powerRange: string; // e.g. "1kVA - 30kVA" or "50kVA - 800kVA"
  topology: string; // e.g. "高频在线双变换"
  efficiency: string; // e.g. "96.5%"
  pf: number; // e.g. 1.0 or 0.9
  image: string;
  badge?: string;
  description: string;
  features: string[];
  specs: {
    inputVoltage: string;
    outputVoltage: string;
    transferTime: string;
    batteryVoltage: string;
    dimensions: string;
    weight: string;
    protectionClass: string;
    communication: string;
  };
  suitableFor: string[];
  industryTags?: ('medical' | 'datacenter' | 'industrial')[];
}

export interface Solution {
  id: string;
  title: string;
  industry: string;
  icon: string;
  summary: string;
  challenges: string[];
  features: string[];
  recommendedProducts: string[];
  bgImage: string;
  caseStudy: {
    client: string;
    result: string;
  };
}

export interface SuccessCase {
  id: string;
  title: string;
  clientName: string;
  industry: 'finance' | 'healthcare' | 'education' | 'industrial' | string;
  capacity: string;
  location: string;
  image: string;
  summary: string;
  problemAnalysis: string;
  solutionProvided: string;
  quantifiedBenefits: string[];
  highlights: string[];
  testimonial?: string;
}

export interface Certificate {
  id: string;
  title: string;
  issuer: string;
  year: string;
  category: string;
  code: string;
}

export interface AgencyBrandDetail {
  id: string;
  brandName: string; // e.g. "山特", "硕天", "华为"
  brandEnName: string; // e.g. "SANTAK"
  logoTag: string; // e.g. "特约授权一级代理"
  authCode: string; // e.g. "ST-SD-2025-092"
  authIssuer: string; // e.g. "山特电子（深圳）有限公司"
  marketPosition: string;
  coreSeries: string[];
  strengthsAndQualifications: string[];
  certifications: string[]; // e.g. ["ISO9001认证", "TLC泰尔认证", "CE安全认证"]
  genuineGuarantee: string;
  technicalAdvantages: string[];
  suitableScenarios: string[];
  representativeModel: string;
  image: string;
}

export interface CalculatorState {
  powerKw: number;
  powerFactor: number;
  backupTimeMinutes: number;
  batteryType: 'lead-acid' | 'lifepo4';
  redundancy: 'N' | 'N+1' | '2N';
  environment: 'datacenter' | 'industrial' | 'office' | 'outdoor';
}

export interface CalculationResult {
  powerKva: number;
  recommendedModel: string;
  modelSeries: string;
  recommendedCategory: 'high-freq' | 'modular' | 'industrial' | 'outdoor-storage';
  batteryCapacityAh: number;
  batteryVoltageV: number;
  batteryStrings: number;
  totalBatteryCount: number;
  estimatedSpaceU: number;
  heatDissipationBtu: number;
  efficiencyPercent: number;
  notes: string[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
}
