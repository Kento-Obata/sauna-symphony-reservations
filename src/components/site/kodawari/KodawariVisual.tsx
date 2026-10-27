import { cn } from "@/lib/utils";
import type { KodawariItem } from "./data";

interface KodawariVisualProps {
  item: KodawariItem;
  sizes: string;
  className?: string;
  /** 画面外の画像は遅延読み込み */
  eager?: boolean;
}

// こだわりの写真。親で大きさを決め、ここは全面に敷く
export const KodawariVisual = ({ item, sizes, className, eager }: KodawariVisualProps) => {
  if (!item.photo) {
    // 写真の無い項目は、網点の霧に「?」を浮かべた図にする
    return (
      <div role="img" aria-label={item.title} className={cn("relative flex h-full w-full items-center justify-center overflow-hidden bg-u-green", className)}>
        <div
          className="u-halftone absolute inset-0 text-u-mist/40"
          style={{
            maskImage: "radial-gradient(70% 70% at 50% 60%, transparent 20%, #000 90%)",
            WebkitMaskImage: "radial-gradient(70% 70% at 50% 60%, transparent 20%, #000 90%)",
          }}
          aria-hidden
        />
        <span className="u-latin relative select-none text-[clamp(7rem,18vw,14rem)] font-light italic leading-none text-u-mist" aria-hidden>
          ?
        </span>
      </div>
    );
  }
  const base = `/kodawari/${item.photo.name}`;
  return (
    <img
      src={`${base}-800.webp`}
      srcSet={`${base}-800.webp 800w, ${base}-1600.webp 1600w`}
      sizes={sizes}
      alt={item.photo.alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      className={cn("u-photo h-full w-full object-cover", className)}
      draggable={false}
    />
  );
};
