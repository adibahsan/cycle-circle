interface BrandLogoProps {
  size?: number;
  alt?: string;
  className?: string;
}

/**
 * Full circular Cycle Circle logo. In dark mode the navy lettering would vanish
 * into the page, so it sits on a literal light disc (the light bg-primary value).
 */
export function BrandLogo({ size = 160, alt = 'Cycle Circle', className = '' }: BrandLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/cycle-circle-logo.svg"
      alt={alt}
      width={size}
      height={size}
      className={`rounded-full dark:bg-[#FFF7F8] dark:p-2 ${className}`.trim()}
    />
  );
}

export default BrandLogo;
