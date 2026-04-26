import { useEffect } from 'react'

export default function BottomSheet({ title, onClose, children, disableBackdropClose = false }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape' && !disableBackdropClose) onClose() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, disableBackdropClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:justify-center lg:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={disableBackdropClose ? undefined : onClose}
      />

      {/* Sheet */}
      <div className="relative sheet-enter bg-white dark:bg-slate-900 rounded-t-3xl lg:rounded-2xl w-full lg:max-w-lg lg:mx-4 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white text-base">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-5 py-4">
          {children}
        </div>
      </div>
    </div>
  )
}
