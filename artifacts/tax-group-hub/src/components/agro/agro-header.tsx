import { useState } from "react";
import { Link } from "wouter";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NAV_LINKS, agroContactMailto } from "@/lib/agro-content";

export function AgroHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNavClick = () => setMobileOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/90 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link
          href="/agro"
          className="flex items-center gap-3 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
        >
          <div
            className="w-8 h-8 rounded-lg bg-primary/12 ring-1 ring-primary/25 flex items-center justify-center"
            aria-hidden="true"
          >
            <span className="text-xs font-bold text-primary">JA</span>
          </div>
          <div className="min-w-0">
            <span className="font-bold text-sm tracking-tight text-foreground block">
              JGG Agro
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest hidden sm:block">
              Hub Jurídico
            </span>
          </div>
        </Link>

        <nav
          className="hidden lg:flex items-center gap-1"
          aria-label="Navegação principal"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/"
            className="hidden md:inline text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-2 py-1"
          >
            Hub Tributário
          </Link>
          <Button size="sm" asChild className="hidden sm:inline-flex">
            <a href={agroContactMailto}>Falar com o time</a>
          </Button>
          <button
            type="button"
            className="lg:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setMobileOpen((o) => !o)}
            aria-expanded={mobileOpen}
            aria-controls="agro-mobile-nav"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          >
            {mobileOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <nav
          id="agro-mobile-nav"
          className="lg:hidden border-t border-border/50 bg-background px-6 py-4"
          aria-label="Navegação mobile"
        >
          <ul className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={handleNavClick}
                  className="block px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted/60 rounded-md transition-colors"
                >
                  {link.label}
                </a>
              </li>
            ))}
            <li className="pt-2 border-t border-border/50 mt-2">
              <Link
                href="/"
                onClick={handleNavClick}
                className="block px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground"
              >
                Hub Tributário
              </Link>
            </li>
            <li className="pt-2">
              <Button asChild className="w-full">
                <a href={agroContactMailto} onClick={handleNavClick}>
                  Falar com o time Agro
                </a>
              </Button>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}