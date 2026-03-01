import Image from 'next/image'

export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <Image
      src="/logo.png"
      alt="Earn4Insights"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}
