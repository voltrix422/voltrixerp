import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[hsl(var(--background))] to-[hsl(var(--muted))]">
      <div className="text-center space-y-8 p-8">
        <div className="space-y-4">
          <h1 className="text-5xl font-bold text-[hsl(var(--foreground))]">
            Welcome to ERP System
          </h1>
          <p className="text-lg text-[hsl(var(--muted-foreground))] max-w-md mx-auto">
            Manage your business operations efficiently with our comprehensive ERP solution
          </p>
        </div>
        
        <div className="flex flex-col items-center gap-4">
          <Link href="/login">
            <Button size="lg" className="h-12 px-8 text-base">
              Get Started
            </Button>
          </Link>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Click to access the login page
          </p>
        </div>
      </div>
    </div>
  )
}
