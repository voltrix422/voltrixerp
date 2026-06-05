import Link from "next/link"

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 bg-white text-neutral-900">
      <p className="text-sm font-medium text-[#1a9f9a] tracking-widest uppercase mb-3">404</p>
      <h1 className="text-3xl font-bold mb-2">Page not found</h1>
      <p className="text-neutral-500 text-sm mb-8 text-center max-w-md">
        The page you requested does not exist or may have been moved.
      </p>
      <Link
        href="/"
        className="px-5 py-2.5 rounded-full text-sm font-semibold text-neutral-950 bg-[#1a9f9a] hover:bg-[#158a85] transition-colors"
      >
        Back to home
      </Link>
    </main>
  )
}
