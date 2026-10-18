import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface PageContainerProps {
  children: React.ReactNode;
  /**
   * 'default' = max-w-4xl, 'wide' = max-w-5xl (calendar).
   * 'canvas' = max-w-5xl, growing to 100rem from 2xl for a page that recomposes into a side rail there (dashboard).
   */
  width?: 'default' | 'wide' | 'canvas';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Page-level container for every signed-in page and the error / not-found pages.
 * Left-aligned so every page title shares one left edge. Owns width, side padding, vertical padding and the section gap (gap-5).
 */
export function PageContainer({ children, width = 'default', className, style }: PageContainerProps) {
  return (
    <div
      style={style}
      className={twMerge(
        clsx(
          'w-full flex flex-col gap-5 px-4 md:px-8 py-4',
          width === 'canvas' ? 'max-w-5xl 2xl:max-w-[100rem]' : width === 'wide' ? 'max-w-5xl' : 'max-w-4xl',
          className,
        ),
      )}
    >
      {children}
    </div>
  );
}

export default PageContainer;
