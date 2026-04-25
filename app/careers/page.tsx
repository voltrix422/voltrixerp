import Navbar from "@/components/landing/navbar"
import Footer from "@/components/landing/footer"

async function getJobs() {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/db/jobs`, {
    cache: 'no-store'
  })
  if (!res.ok) return []
  const jobs = await res.json()
  return jobs.filter((j: any) => j.published)
}

export default async function CareersPage() {
  const jobs = await getJobs()

  return (
    <main className="min-h-screen bg-white text-neutral-900">
      <Navbar />
      <section className="pt-36 pb-24 px-4">
        <div className="max-w-4xl mx-auto space-y-12">
          <div className="text-center space-y-4">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#1a9f9a" }}>Careers</p>
            <h1 className="text-5xl font-bold tracking-tight text-neutral-900">Join Our Team</h1>
            <p className="text-neutral-500 text-lg max-w-xl mx-auto">Help us build the future of battery technology in Pakistan.</p>
          </div>

          {jobs.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-neutral-400">Coming soon...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {jobs.map((job: any) => (
                <article key={job.id} className="border border-neutral-200 rounded-lg p-6 hover:border-neutral-300 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-neutral-900 mb-2">{job.title}</h2>
                      <div className="flex items-center gap-3 text-sm text-neutral-500">
                        <span>{job.location}</span>
                        <span>•</span>
                        <span>{job.type}</span>
                      </div>
                    </div>
                    {job.salary && (
                      <span className="text-sm font-medium" style={{ color: "#1a9f9a" }}>{job.salary}</span>
                    )}
                  </div>
                  <p className="text-neutral-600 mb-4 whitespace-pre-line">{job.description}</p>
                  <div className="border-t border-neutral-100 pt-4">
                    <p className="text-sm font-medium text-neutral-900 mb-2">Requirements</p>
                    <p className="text-sm text-neutral-600 whitespace-pre-line">{job.requirements}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </main>
  )
}
