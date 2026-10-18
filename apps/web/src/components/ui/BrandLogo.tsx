interface BrandLogoProps {
  size?: number;
  alt?: string;
  className?: string;
}

/**
 * Full circular Cycle Circle logo. Dark mode swaps to the variant with light "CYCLE" lettering
 * (the navy would vanish into the page); gold, red and the circle of people are unchanged.
 */
export function BrandLogo({ size = 160, alt = 'Cycle Circle', className = '' }: BrandLogoProps) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/cycle-circle-logo.svg" alt={alt} width={size} height={size} className={`dark:hidden ${className}`.trim()} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/cycle-circle-logo-dark.svg" alt={alt} width={size} height={size} className={`hidden dark:block ${className}`.trim()} />
    </>
  );
}

export default BrandLogo;
