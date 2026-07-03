/** SVG 國旗（flag-icons）：含台灣國旗，Windows 上也能正確顯示 */
export default function Flag({ iso2, className = '' }: { iso2: string | null; className?: string }) {
  if (!iso2) return <span className={`inline-block w-6 ${className}`}>🌐</span>
  return <span className={`fi fi-${iso2.toLowerCase()} rounded-sm shadow-sm ${className}`} />
}
