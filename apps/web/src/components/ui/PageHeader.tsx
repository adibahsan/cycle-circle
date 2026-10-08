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
    <header className={`flex items-start justify-between gap-3 ${className}`.trim()}>
      <div className="min-w-0">
        <h1 className="text-2xl md:text-3xl font-bold text-[var(--color-text-primary)]">{title}</h1>
        {subtitle ? (
          <p className="text-sm text-[var(--color-text-muted)] mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="shrink-0 flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export default PageHeader;
