import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  label?: string;
  markClassName?: string;
  showText?: boolean;
  textClassName?: string;
};

export function BrandLogo({
  className,
  label = "LiteChat",
  markClassName,
  showText = true,
  textClassName
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)} aria-label={showText ? undefined : label}>
      <svg
        aria-hidden="true"
        className={cn("size-6 shrink-0", markClassName)}
        fill="none"
        viewBox="0 0 32 32"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="32" height="32" rx="6" fill="#2563EB" />
        <path
          d="M7.5 11.75A4.75 4.75 0 0 1 12.25 7h7.5a4.75 4.75 0 0 1 4.75 4.75v4.5A4.75 4.75 0 0 1 19.75 21h-3.08l-3.94 3.08A1.32 1.32 0 0 1 10.6 23.04v-2.75a4.75 4.75 0 0 1-3.1-4.45v-4.09Z"
          fill="white"
        />
        <circle cx="14" cy="14" r="1.25" fill="#2563EB" />
        <circle cx="18" cy="14" r="1.25" fill="#2563EB" />
      </svg>
      {showText ? <span className={cn("min-w-0 truncate", textClassName)}>{label}</span> : null}
    </span>
  );
}
