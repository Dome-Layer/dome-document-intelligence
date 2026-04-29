type PageContentSize = 'narrow' | 'medium' | 'wide'

const SIZE_CLASS: Record<PageContentSize, string> = {
  narrow: 'max-w-xl',
  medium: 'max-w-2xl',
  wide: 'max-w-5xl',
}

interface PageContentProps {
  children: React.ReactNode
  size?: PageContentSize
}

export function PageContent({ children, size = 'medium' }: PageContentProps) {
  return (
    <div className={`${SIZE_CLASS[size]} mx-auto w-full`}>
      {children}
    </div>
  )
}
