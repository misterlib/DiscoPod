import { useEffect } from "react";
import logoLightSvg from "../../assets/logo-light.svg";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AdminModal({ isOpen, onClose }: AdminModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Admin panel"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 bg-disco-dark/80 backdrop-blur-sm transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Main modal container - grows up from bottom-left */}
      <div className="relative z-10 w-full max-w-4xl animate-grow-left">
        {/* Top Header Bar */}
        <div className="relative mb-3 flex flex-col items-center justify-center px-2">
          {/* Centered DISCOPOD logo */}
          <img
            src={logoLightSvg}
            alt="DISCOPOD"
            className="h-8 sm:h-10 w-auto drop-shadow select-none"
          />

          {/* Admin badge centered below logo */}
          <div className="mt-1.5 animate-drop-top rounded-full bg-disco-rose px-4 py-1.5 text-xs font-black uppercase tracking-wider text-disco-dark shadow-md">
            Admin
          </div>

          {/* Close X Button - top-right */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close admin panel"
            className="animate-pop-in absolute right-2 top-0 flex h-9 w-9 items-center justify-center rounded-full bg-disco-navy text-disco-cream shadow-md transition-transform hover:scale-110 active:scale-95"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Card Body with Cream background and Dusty Rose thick border */}
        <div className="relative min-h-[360px] sm:min-h-[440px] rounded-3xl border-8 sm:border-[12px] border-disco-rose bg-disco-cream p-6 sm:p-12 shadow-2xl flex flex-col items-center justify-center text-center">
          {/* Subtitle */}
          <h3 className="mb-8 font-['Lato'] text-base sm:text-lg font-extrabold uppercase tracking-wide text-disco-dark/90">
            Manage podcast indexes
          </h3>

          {/* Dashed placeholder container */}
          <div className="w-full max-w-md rounded-2xl border-2 border-dashed border-disco-dark/50 bg-disco-cream/60 px-8 py-14 sm:py-18">
            <p className="font-['Lato'] text-sm sm:text-base font-extrabold uppercase tracking-widest text-disco-dark/80 leading-relaxed">
              PLACEHOLDER FOR
              <br />
              GITHUB, SCHEDULER, STUFF
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
