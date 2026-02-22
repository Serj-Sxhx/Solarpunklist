import { Link } from "wouter";
import { Leaf } from "lucide-react";

export function Header() {
  return (
    <header className="border-b border-border/60 bg-background/80 backdrop-blur-sm sticky top-0 z-50" data-testid="header">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 h-14">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Leaf className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground tracking-tight">
              Solarpunk<span className="text-primary">List</span>
            </span>
          </Link>

          <nav className="hidden sm:flex items-center gap-6">
            <Link href="/" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors no-underline">
              Directory
            </Link>
            <Link href="/about" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors no-underline">
              About
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
