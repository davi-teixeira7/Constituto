import type { ButtonHTMLAttributes, ReactNode } from "react"
import { AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge as ShadBadge } from "@/components/ui/badge"
import { Button as ShadButton } from "@/components/ui/button"
import { Card as ShadCard, CardContent } from "@/components/ui/card"
import { Input as ShadInput } from "@/components/ui/input"
import { Sheet as ShadSheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea as ShadTextarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
};

export function Button({ className = "", variant = "primary", ...props }: ButtonProps) {
  const mapped = variant === "primary" ? "default" : variant === "danger" ? "destructive" : variant
  return <ShadButton className={className} variant={mapped} {...props} />
}

type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  contentClassName?: string
}

export function Card({ className = "", contentClassName = "", children, ...props }: CardProps) {
  return (
    <ShadCard className={cn("card border-border bg-card shadow-sm", className)} {...props}>
      <CardContent className={cn("p-5", contentClassName)}>{children}</CardContent>
    </ShadCard>
  )
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  const variant =
    tone === "critical" ? "critical" : tone === "warning" ? "warning" : tone === "success" ? "success" : tone === "info" ? "info" : "secondary"
  return <ShadBadge className="min-w-40 justify-center text-center" variant={variant}>{children}</ShadBadge>
}

export function Field({
  label,
  children,
  hint
}: {
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <ShadInput {...props} />
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <ShadTextarea {...props} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50" {...props} />
}

export function PageHeader({
  eyebrow,
  title,
  children
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
      </div>
      {children ? <div className="page-actions">{children}</div> : null}
    </header>
  );
}

export function Sheet({
  title,
  open,
  onClose,
  children
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <ShadSheet open={open} onOpenChange={(next) => {
      if (!next) onClose()
    }}>
      <SheetContent className="w-[440px] border-l-orange-200 bg-card">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>Cadastro rapido de estoque e validade.</SheetDescription>
        </SheetHeader>
        <div className="mt-5">{children}</div>
      </SheetContent>
    </ShadSheet>
  )
}

export function Empty({ children = "Nenhum registro encontrado." }: { children?: ReactNode }) {
  return (
    <Alert className="border-dashed bg-muted/40">
      <AlertCircle className="size-4" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}
