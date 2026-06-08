import { Link } from "wouter";

export function AgroFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/50 bg-background">
      <div className="max-w-7xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-center md:text-left">
          <p className="text-sm font-semibold text-foreground">JGG Agro</p>
          <p className="text-xs text-muted-foreground mt-1">
            Estratégia jurídica para o agronegócio
          </p>
        </div>
        <nav
          className="flex items-center gap-4 text-xs text-muted-foreground"
          aria-label="Links do rodapé"
        >
          <Link
            href="/agro"
            className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1"
          >
            Hub Agro
          </Link>
          <span aria-hidden="true">·</span>
          <Link
            href="/"
            className="hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-1"
          >
            Hub Tributário
          </Link>
        </nav>
        <p className="text-xs text-muted-foreground">
          © {year} JGG. Todos os direitos reservados.
        </p>
      </div>
    </footer>
  );
}