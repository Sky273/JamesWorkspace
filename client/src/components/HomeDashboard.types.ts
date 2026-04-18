export interface DashboardStats {
  resumes: {
    total: number;
    analyzed: number;
    improved: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
  };
  missions: {
    total: number;
    active: number;
  };
  adaptations: {
    total: number;
  };
  scores: {
    averageOriginal: number;
    averageImproved: number;
    improvement: number;
  };
  firmId: string | null;
}

export interface KPICardConfig {
  label: string;
  value: number | string;
  subValue?: string;
  color: string;
  delay: number;
  route: string;
  icon: React.ElementType;
}

export interface QuickActionConfig {
  label: string;
  description: string;
  color: string;
  delay: number;
  route: string;
  icon: React.ElementType;
  tone?: 'primary' | 'secondary';
}

export interface StatRow {
  label: string;
  value: number | string;
  valueClassName?: string;
}

export interface SecondaryStatCard {
  title: string;
  delay: number;
  icon: React.ElementType;
  rows: StatRow[];
}
