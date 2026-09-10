export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-md bg-muted/70 ${className}`} />
}

export function MessageListSkeleton() {
  return (
    <div aria-label="Cargando mensajes" className="space-y-1 px-4 py-3">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex items-start gap-3 border-b border-border/30 py-4 last:border-none">
          <Skeleton className="mt-1.5 h-2 w-2 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex justify-between gap-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-12" />
            </div>
            <Skeleton className="h-3 w-5/6" />
          </div>
        </div>
      ))}
    </div>
  )
}
