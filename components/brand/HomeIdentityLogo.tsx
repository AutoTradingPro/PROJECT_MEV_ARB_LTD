import Image from "next/image";

/** Identitas landing Markets / Home. */
export default function HomeIdentityLogo({
  size = 44,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/images/home.png"
      alt="MEV-ARB Home"
      width={size}
      height={size}
      className={`shrink-0 rounded-lg object-contain ${className}`}
      style={{ width: size, height: size }}
      priority
    />
  );
}
