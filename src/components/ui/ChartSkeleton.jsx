export default function ChartSkeleton({ className = 'h-48' }) {
  return (
    <div className={`${className} flex flex-col items-center justify-center gap-2 rounded-lg bg-[hsl(var(--muted)/0.3)]`}>
      <div className="h-8 w-8 rounded-full border-4 border-[hsl(var(--primary))/20] border-t-[hsl(var(--primary))] animate-spin" />
      <p className="text-xs text-[hsl(var(--muted-foreground))]">Cargando datos...</p>
    </div>
  )
}
