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
