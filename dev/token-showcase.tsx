export function TokenShowcase() {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', opacity: 0.6 }}>
        DESIGN TOKENS (Tailwind + shadcn)
      </div>
      <div className="bg-background text-foreground border border-border rounded-lg p-6">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'flex-start' }}>
          <span className="bg-brand text-brand-foreground text-sm font-medium rounded-md px-3 py-1.5">
            Tailwind @theme: bg-brand
          </span>
          <button className="bg-primary text-primary-foreground text-sm font-semibold rounded-md px-4 py-2">
            shadcn: bg-primary
          </button>
          <button className="bg-secondary text-secondary-foreground text-sm font-medium rounded-md px-4 py-2">
            bg-secondary
          </button>
          <p className="text-muted-foreground text-lg font-semibold">
            text-muted-foreground · text-lg · font-semibold
          </p>
          <span className="bg-destructive text-white text-xs font-medium rounded px-2 py-1">
            bg-destructive
          </span>
        </div>
      </div>
    </section>
  )
}
