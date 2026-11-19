import React, { useEffect, useState } from 'react';
import { School } from 'lucide-react';

interface SchoolLogoProps {
  logoUrl?: string;
  schoolName?: string;
  className?: string;
  imgClassName?: string;
  fallbackIconClassName?: string;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({
  logoUrl,
  schoolName,
  className = 'w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shrink-0',
  imgClassName = 'w-full h-full object-contain p-0.5',
  fallbackIconClassName = 'w-5 h-5 text-slate-600',
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [logoUrl]);

  return (
    <div className={className}>
      {logoUrl && !hasError ? (
        <img
          src={logoUrl}
          alt={schoolName ? `Logo ${schoolName}` : 'Logo Sekolah'}
          referrerPolicy="no-referrer"
          onError={() => setHasError(true)}
          className={imgClassName}
        />
      ) : (
        <School className={fallbackIconClassName} />
      )}
    </div>
  );
};
