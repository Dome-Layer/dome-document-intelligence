export function Footer() {
  return (
    <footer className="border-t border-dome-border mt-auto">
      <div className="max-w-[1152px] mx-auto px-6 md:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="font-sans text-sm text-dome-muted text-center sm:text-left">
          Document Intelligence is a free tool by{' '}
          <a
            href="https://www.domelayer.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-dome-text hover:text-dome-accent transition-colors duration-150"
          >
            Dome
          </a>
          {' '}— Governance-Driven Operational AI.
        </p>
        <a
          href="https://www.domelayer.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-dome-accent hover:text-dome-accent-hover transition-colors duration-150 whitespace-nowrap"
        >
          Explore Dome
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path d="M2.5 7h9M8 3.5 11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </a>
      </div>
    </footer>
  )
}
