import { useState, type ReactNode } from 'react'

/** 名詞白話解釋：ⓘ 點擊/hover 顯示（手機也能點） */
export default function InfoTip({ text, children }: { text: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <span className="relative inline-flex items-center gap-1">
      {children}
      <button
        type="button"
        aria-label="explain"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="group relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-stone-200 text-[10px] font-bold text-stone-500 hover:bg-brand-100 hover:text-brand-700"
      >
        i
        <span
          className={`pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-60 -translate-x-1/2 rounded-lg bg-stone-800 p-2.5 text-left text-xs font-normal leading-relaxed text-white shadow-lg transition-opacity ${
            open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          }`}
        >
          {text}
        </span>
      </button>
    </span>
  )
}
