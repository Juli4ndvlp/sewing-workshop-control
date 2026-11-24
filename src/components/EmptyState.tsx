import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  className = ''
}) => {
  return (
    <div
      className={`glass-panel rounded-3xl p-8 md:p-12 text-center flex flex-col items-center justify-center max-w-md mx-auto border border-white/65 shadow-[0_12px_40px_rgba(37,34,32,0.06)] transition-all duration-300 ${className}`}
    >
      <div className="w-16 h-16 rounded-2xl bg-white/65 backdrop-blur-xl border border-white/80 shadow-[0_6px_20px_rgba(37,34,32,0.07)] flex items-center justify-center text-[#6f2f3a] mb-4 transition-transform hover:scale-105 duration-300">
        <Icon size={28} className="text-[#6f2f3a]" />
      </div>
      <h3 className="font-display text-lg md:text-xl font-semibold text-stone-800 tracking-tight">
        {title}
      </h3>
      <p className="text-xs md:text-sm text-stone-500 mt-2 max-w-xs leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 glass-btn-primary shadow-md hover:shadow-lg transition-all"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
