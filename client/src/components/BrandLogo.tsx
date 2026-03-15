import { useState } from 'react';
import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

type BrandLogoProps = {
  variant?: 'full' | 'icon';
  className?: string;
  imgClassName?: string;
  textClassName?: string;
  showTextOnIconFallback?: boolean;
};

const LOGO_FULL_SRC = '/brand/logo.png';
const LOGO_ICON_SRC = '/brand/icon.png';

export default function BrandLogo({
  variant = 'full',
  className,
  imgClassName,
  textClassName,
  showTextOnIconFallback = false,
}: BrandLogoProps) {
  const [failed, setFailed] = useState(false);
  const src = variant === 'icon' ? LOGO_ICON_SRC : LOGO_FULL_SRC;

  if (!failed) {
    return (
      <img
        src={src}
        alt="Nexa Chess"
        className={cn('block object-contain', imgClassName)}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Crown className="h-7 w-7 text-primary" />
      {(variant === 'full' || showTextOnIconFallback) && (
        <span className={cn('font-cairo text-xl font-bold text-foreground', textClassName)}>
          نيكسا للشطرنج
        </span>
      )}
    </div>
  );
}
