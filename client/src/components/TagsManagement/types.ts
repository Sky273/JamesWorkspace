import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react';

export type HeroIcon = ForwardRefExoticComponent<Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>>;

export interface CategoryConfig {
  icon: HeroIcon;
  color: string;
  bgLight: string;
  textColor: string;
  tagBg: string;
  tagText: string;
  tagBorder: string;
}

export interface Tags {
  [category: string]: string[];
}

export interface CleanedTags {
  [category: string]: string[];
}

export interface EditingTag {
  category: string;
  tag: string;
}

export interface EscoTagItem {
  label: string;
  uri: string;
}

export interface EscoTags {
  skills: EscoTagItem[];
  industries: EscoTagItem[];
  tools: EscoTagItem[];
  softSkills: EscoTagItem[];
}

export type TabType = 'raw' | 'cleaned' | 'esco';
