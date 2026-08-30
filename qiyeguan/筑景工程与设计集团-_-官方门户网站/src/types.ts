export type ProjectCategory = 'all' | 'commercial' | 'office' | 'hospitality' | 'villa' | 'renovation' | 'public';

export interface Project {
  id: string;
  title: string;
  subtitle: string;
  category: ProjectCategory;
  categoryLabel: string;
  coverImage: string;
  galleryImages: string[];
  area: string;
  duration: string;
  location: string;
  client: string;
  completionYear: string;
  craftHighlights: string[];
  architect: string;
  description: string;
  award?: string;
  bimLevel?: string;
  vrAvailable?: boolean;
}

export interface CraftStandard {
  id: string;
  title: string;
  category: string;
  description: string;
  iconName: string;
  standards: string[];
  qcCheckpoints: string[];
  tag: string;
}

export interface BusinessSector {
  id: string;
  title: string;
  enTitle: string;
  summary: string;
  description: string;
  image: string;
  highlights: string[];
  qualifications: string[];
}

export interface BudgetForm {
  projectType: 'commercial' | 'office' | 'villa' | 'civil' | 'renovation';
  area: number;
  grade: 'standard' | 'luxury' | 'ultra_luxury';
  style: string;
  location: string;
  specialRequirements: string;
}

export interface BudgetResult {
  totalEstimate: number;
  unitPrice: number;
  breakdown: {
    civilStructure: number;
    materialsDecoration: number;
    mepSmartHome: number;
    designManagement: number;
  };
  estimatedDays: number;
  aiAdvice: string;
}

export interface SystemLog {
  id: number;
  time: string;
  action: string;
  location: string;
}

export interface AdminSystemSync {
  syncStatus: string;
  lastSyncTime: string;
  totalProjects: number;
  activeSites: number;
  ongoingDesigns: number;
  qualityPassRate: string;
  recentSystemLogs: SystemLog[];
}
