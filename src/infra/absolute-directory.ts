/** Browser-safe absolute-directory validation shared by plugin and panel settings. */
export const ABSOLUTE_DIRECTORY = /^(?:\/|[A-Za-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+(?:[\\/]|$))/
export const absoluteDirectory = (value: string): boolean => ABSOLUTE_DIRECTORY.test(value)
