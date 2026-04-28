import type { ForwardRefExoticComponent, SVGProps, RefAttributes } from 'react';

export type HeroIcon = ForwardRefExoticComponent<
  Omit<SVGProps<SVGSVGElement>, 'ref'> & { title?: string; titleId?: string } & RefAttributes<SVGSVGElement>
>;

export interface SettingsTabItem {
  id: string;
  name: string;
  icon: HeroIcon;
}

interface SettingsTabsNavProps {
  tabs: SettingsTabItem[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
}

export default function SettingsTabsNav({
  tabs,
  activeTab,
  onTabChange
}: SettingsTabsNavProps): JSX.Element {
  return (
    <div className="mb-5 rounded-[13px] border border-[#dedbe8] bg-[#f8f8f7] p-1 dark:border-white/10 dark:bg-[#111827]">
      <nav className="flex flex-wrap gap-1">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center rounded-[9px] border px-2.5 py-2 text-[11px] font-semibold leading-tight transition ${
                isActive
                  ? 'border-[#dedbe8] bg-white text-[#6246ea] shadow-sm dark:border-white/10 dark:bg-[#182235] dark:text-[#c9ccff]'
                  : 'border-transparent text-[var(--cv-muted)] hover:bg-white/70 hover:text-[var(--cv-text)] dark:hover:bg-white/5'
              }`}
            >
              <IconComponent className="w-3.5 h-3.5 mr-1 flex-shrink-0" />
              {tab.name}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
