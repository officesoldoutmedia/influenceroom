// Tiny class-name joiner — avoids pulling in clsx/cn-utils for one helper.
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
