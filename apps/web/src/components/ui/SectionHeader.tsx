interface SectionHeaderProps {
  title: React.ReactNode;
  /** Muted supporting text. */
  subtitle?: React.ReactNode;
  /** `stacked`: subtitle under the title. `inline`: subtitle right-aligned on the title row. */
  variant?: 'stacked' | 'inline';
  /** Heading level; defaults to h2. */
  as?: 'h2' | 'h3';
  /** Heading id, for `aria-labelledby` on the section. */
  id?: string;
  className?: string;
}

export function SectionHeader({ title, subtitle, variant = 'stacked', as: Heading = 'h2', id, className = '' }: SectionHeaderProps) {
  const inline = variant === 'inline';
  return (
    <div className={`${inline ? 'flex items-baseline justify-between gap-3' : ''} mb-3 ${className}`.trim()}>
      <Heading id={id} className="min-w-0 text-base font-bold text-[var(--color-text-primary)]">
        {title}
      </Heading>
      {subtitle ? (
        <p className={`text-xs text-[var(--color-text-muted)] ${inline ? 'shrink-0 text-right' : 'mt-0.5'}`}>{subtitle}</p>
      ) : null}
    </div>
  );
}

export default SectionHeader;
