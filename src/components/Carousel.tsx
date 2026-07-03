import { useRef, useState, type ReactNode } from 'react'

/** 翻頁卡：手機可滑動、桌面有左右箭頭與圓點指示。只有一張時直接顯示。 */
export default function Carousel({ items }: { items: ReactNode[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [idx, setIdx] = useState(0)

  if (items.length === 0) return null
  if (items.length === 1) return <>{items[0]}</>

  const go = (i: number) => {
    const el = ref.current
    if (!el) return
    const n = Math.max(0, Math.min(i, items.length - 1))
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' })
    setIdx(n)
  }

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={() => {
          const el = ref.current
          if (el) setIdx(Math.round(el.scrollLeft / el.clientWidth))
        }}
        className="flex snap-x snap-mandatory overflow-x-auto rounded-3xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item, i) => (
          <div key={i} className="w-full shrink-0 snap-center">
            {item}
          </div>
        ))}
      </div>

      {/* 左右箭頭（桌面） */}
      <button
        type="button"
        aria-label="previous"
        onClick={() => go(idx - 1)}
        disabled={idx === 0}
        className="absolute -left-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-md transition hover:text-brand-600 disabled:opacity-0 sm:flex"
      >
        ‹
      </button>
      <button
        type="button"
        aria-label="next"
        onClick={() => go(idx + 1)}
        disabled={idx === items.length - 1}
        className="absolute -right-3 top-1/2 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-md transition hover:text-brand-600 disabled:opacity-0 sm:flex"
      >
        ›
      </button>

      {/* 圓點指示 */}
      <div className="mt-3 flex justify-center gap-1.5">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`slide ${i + 1}`}
            onClick={() => go(i)}
            className={`h-2 rounded-full transition-all ${i === idx ? 'w-5 bg-brand-500' : 'w-2 bg-stone-300 hover:bg-stone-400'}`}
          />
        ))}
      </div>
    </div>
  )
}
