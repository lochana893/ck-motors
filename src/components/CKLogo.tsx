import Image from "next/image";

type CKLogoProps = {
  size?: "small" | "medium" | "large";
  className?: string;
  surface?: boolean;
};

export default function CKLogo({
  size = "medium",
  className = "",
  surface = false,
}: CKLogoProps) {
  const sizes = {
    small: {
  width: 105,
  height: 35,
},
    medium: {
      width: 155,
      height: 90,
    },
    large: {
      width: 260,
      height: 160,
    },
  };

  const selectedSize = sizes[size];

  const image = (
    <Image
      src="/ck-motors-logo.png"
      alt="CK Motors - Drive With Confidence"
      width={selectedSize.width}
      height={selectedSize.height}
      priority
      className={`h-auto max-w-full object-contain ${className}`}
    />
  );

  if (!surface) return image;

  return (
    <span className="inline-flex h-11 w-[122px] items-center justify-center rounded-xl border border-slate-200 bg-white/95 px-2 py-1 shadow-sm">
      {image}
    </span>
  );
}