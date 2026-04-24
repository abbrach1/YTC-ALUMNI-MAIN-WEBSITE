import Link from "next/link"

export function Footer() {
  return (
    <footer className="w-full border-t border-[#C9A44E]/20 bg-[#0C1A35] py-1">
      <div className="container mx-auto px-4 flex flex-col items-center gap-1">
        <div className="flex items-center justify-center gap-3">
          <span className="text-base text-[#F8F5EF]/60">Website powered by</span>
          <a
            href="https://raisegenius.org"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <img
              src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/3-kkk26f5zsTaG5TevXfuubW8kaVBYa5.png"
              alt="RaiseGenius"
              className="h-24 w-auto"
            />
            <span className="text-base text-[#F8F5EF]/80 font-medium">Raisegenius.org</span>
          </a>
        </div>
        <Link
          href="/privacy"
          className="text-xs text-[#F8F5EF]/30 hover:text-[#C9A44E]/70 transition-colors pb-2"
        >
          Privacy Policy
        </Link>
      </div>
    </footer>
  )
}
