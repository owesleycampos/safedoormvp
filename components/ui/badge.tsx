import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-secondary text-foreground',
        secondary:   'bg-secondary text-secondary-foreground',
        destructive: 'bg-destructive/15 text-destructive',
        outline:     'border border-border text-foreground',
        success:     'bg-success/12 text-success',
        warning:     'bg-warn/12 text-warn',
        entry:       'bg-success/12 text-success',
        exit:        'bg-secondary text-muted-foreground',
        online:      'bg-success/12 text-success',
        offline:     'bg-secondary text-muted-foreground',
        error:       'bg-destructive/15 text-destructive',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
