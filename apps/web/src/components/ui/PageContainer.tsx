import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface PageContainerProps {
  children: React.ReactNode;
  /**
   * 'default' = max-w-4xl (error and not-found pages).
   * 'canvas' = max-w-5xl, growing to 110rem from xl: every signed-in page. Each page recomposes into more
   * columns on wide screens so forms and text keep a readable width instead of stretching.
   */
  width?: 'default' | 'canvas';
  /**
   * From xl the page is at least one screen tall, so a page whose body takes the free height (`xl:flex-1`)
   * ends at the bottom of the screen like the dashboard instead of stopping halfway down.
   */
  fill?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Page-level container for every signed-in page and the error / not-found pages.
 * Left-aligned so every page title shares one left edge. Owns width, side padding, vertical padding and the section gap (gap-5).
 */
export function PageContainer({ children, width = 'default', fill = false, className, style }: PageContainerProps) {
  return (
    <div
      style={style}
      className={twMerge(
        clsx(
          'w-full flex flex-col gap-5 px-4 md:px-8 py-4',
          width === 'canvas' ? 'max-w-5xl xl:max-w-[110rem]' : 'max-w-4xl',
          fill && 'xl:flex-1',
          className,
        ),
      )}
    >
      {children}
    </div>
  );
}

export default PageContainer;
