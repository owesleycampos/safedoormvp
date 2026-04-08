import { cn } from '@/lib/utils';

type SkeletonVariant = 'text' | 'circle' | 'card';

const variantClasses: Record<SkeletonVariant, string> = {
  text: 'h-4 rounded',
  circle: 'rounded-full',
  card: 'rounded-lg h-[200px]',
};

function Skeleton({
  className,
  variant = 'text',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { variant?: SkeletonVariant }) {
  return (
    <div
      className={cn(
        'bg-muted animate-pulse',
        variantClasses[variant],
        className
      )}
      style={{
        backgroundImage:
          'linear-gradient(90deg, transparent 0%, hsl(var(--muted-foreground) / 0.06) 50%, transparent 100%)',
        backgroundSize: '400px 100%',
        backgroundRepeat: 'no-repeat',
        animation: 'shimmer 1.5s ease-in-out infinite, pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }}
      {...props}
    />
  );
}

export { Skeleton };
