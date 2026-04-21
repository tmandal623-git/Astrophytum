// src/utils/cn.ts
// Tiny className merger — install 'clsx' or use this zero-dep version.
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
