interface PageHeaderProps {
  /** The page's only h1. */
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Optional right-aligned slot (buttons, filters). */
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className = '' }: PageHeaderProps) {
  return (
    // Actions stack under the title on phones so they never squeeze it; side by side from sm.
    <header className={`flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between ${className}`.trim()}>
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="min-w-0 sm:shrink-0 flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export default PageHeader;
