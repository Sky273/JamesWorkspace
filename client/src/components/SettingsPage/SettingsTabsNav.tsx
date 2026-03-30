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
    <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
      <nav className="-mb-px flex flex-wrap gap-x-1 gap-y-1">
        {tabs.map((tab) => {
          const IconComponent = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex items-center py-2 px-1.5 border-b-2 font-medium text-[11px] leading-tight ${
                isActive
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
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
