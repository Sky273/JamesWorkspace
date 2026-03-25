interface PageHeaderProps {
  title: string;
  subtitle: string;
}

export default function PageHeader({ title, subtitle }: PageHeaderProps) {
  return (
    <div className="mb-8">
      <div className="mb-1 flex items-center gap-3">
        <div className="h-8 w-1 rounded-full bg-primary-500" />
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-gray-100">{title}</h1>
      </div>
      <p className="ml-[1.75rem] text-gray-500 dark:text-gray-400">{subtitle}</p>
    </div>
  );
}
