/** Une clases condicionales: cx('a', cond && 'b') → "a b" */
export function cx(...parts: (string | false | null | undefined | 0)[]): string {
  return parts.filter(Boolean).join(' ')
}
