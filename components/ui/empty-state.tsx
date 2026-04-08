'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

type EmptyStateVariant =
  | 'no-data'
  | 'no-students'
  | 'no-classes'
  | 'no-parents'
  | 'no-camera'
  | 'no-events'
  | 'no-unrecognized'
  | 'search-empty';

interface EmptyStateProps {
  variant: EmptyStateVariant;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

const illustrations: Record<EmptyStateVariant, React.ReactNode> = {
  'no-data': (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="22" y="12" width="36" height="56" rx="4" stroke="currentColor" strokeWidth="2" />
      <line x1="30" y1="28" x2="50" y2="28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="30" y1="36" x2="50" y2="36" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="30" y1="44" x2="42" y2="44" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M28 20h24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  'no-students': (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="30" r="10" stroke="currentColor" strokeWidth="2" />
      <path d="M24 60c0-8.837 7.163-16 16-16s16 7.163 16 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="40" r="26" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
    </svg>
  ),
  'no-classes': (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="12" y="16" width="22" height="20" rx="3" stroke="currentColor" strokeWidth="2" />
      <rect x="46" y="16" width="22" height="20" rx="3" stroke="currentColor" strokeWidth="2" />
      <rect x="12" y="44" width="22" height="20" rx="3" stroke="currentColor" strokeWidth="2" />
      <rect x="46" y="44" width="22" height="20" rx="3" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
    </svg>
  ),
  'no-parents': (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="28" r="8" stroke="currentColor" strokeWidth="2" />
      <circle cx="52" cy="28" r="8" stroke="currentColor" strokeWidth="2" />
      <path d="M18 56c0-6.627 5.373-12 12-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M42 56c0-6.627 5.373-12 12-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
      <path d="M42 56c0-6.627-5.373-12-12-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M62 56c0-6.627-5.373-12-12-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
    </svg>
  ),
  'no-camera': (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="14" y="26" width="52" height="34" rx="4" stroke="currentColor" strokeWidth="2" />
      <path d="M30 20h20l4 6H26l4-6z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <circle cx="40" cy="43" r="10" stroke="currentColor" strokeWidth="2" />
      <line x1="22" y1="18" x2="58" y2="62" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  'no-events': (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="40" r="24" stroke="currentColor" strokeWidth="2" />
      <line x1="40" y1="24" x2="40" y2="40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="40" y1="40" x2="52" y2="46" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="40" cy="40" r="3" fill="currentColor" opacity="0.3" />
    </svg>
  ),
  'no-unrecognized': (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="40" cy="32" r="12" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
      <path d="M20 22V16h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M60 22V16h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 52v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M60 52v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M34 54c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 4" />
    </svg>
  ),
  'search-empty': (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="36" cy="36" r="16" stroke="currentColor" strokeWidth="2" />
      <line x1="48" y1="48" x2="62" y2="62" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <text x="32" y="42" fontSize="18" fill="currentColor" fontFamily="Inter, sans-serif" fontWeight="500">?</text>
    </svg>
  ),
};

export function EmptyState({
  variant,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        className
      )}
    >
      <div className="text-muted-foreground/40 mb-4">
        {illustrations[variant]}
      </div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 inline-flex items-center justify-center rounded-lg border border-border bg-card px-3.5 h-8 text-xs font-medium transition-colors hover:bg-accent"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
