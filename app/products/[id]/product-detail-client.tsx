"use client"

import { useState, useEffect, useRef } from 'react'
import Image from "next/image"
import Link from "next/link"
import { CheckCircle2, XCircle, AlertCircle, ArrowRight, ArrowLeft, X, ChevronLeft, ChevronRight } from "lucide-react"

type TabType = 'description' | 'specifications'

function StockBadge({ stock }: { stock: any }) {
  const s = typeof stock === "number" ? (stock > 0 ? "in" : stock === 0 ? "low" : "out") : stock
  if (s === "in")  return <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium"><CheckCircle2 className="w-4 h-4" /> In Stock</span>
  if (s === "low") return <span className="flex items-center gap-1.5 text-sm text-amber-500 font-medium"><AlertCircle className="w-4 h-4" /> Low Stock</span>
  return <span className="flex items-center gap-1.5 text-sm text-neutral-400 font-medium"><XCircle className="w-4 h-4" /> Out of Stock</span>
}

function ProductImages({ images, productName }: { images: string[], productName: string }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const [touchStart, setTouchStart] = useState(0)
  const [touchEnd, setTouchEnd] = useState(0)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const imageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (images.length <= 1) return
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % images.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [images.length])

  // Handle keyboard navigation in lightbox
  useEffect(() => {
    if (!isLightboxOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsLightboxOpen(false)
      if (e.key === 'ArrowLeft') handlePrevious()
      if (e.key === 'ArrowRight') handleNext()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isLightboxOpen, lightboxIndex, images.length])

  const handleNext = () => {
    setLightboxIndex((prev) => (prev + 1) % images.length)
  }

  const handlePrevious = () => {
    setLightboxIndex((prev) => (prev - 1 + images.length) % images.length)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX)
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > 50
    const isRightSwipe = distance < -50

    if (isLeftSwipe) handleNext()
    if (isRightSwipe) handlePrevious()

    setTouchStart(0)
    setTouchEnd(0)
  }

  const openLightbox = (index: number) => {
    setLightboxIndex(index)
    setIsLightboxOpen(true)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!imageRef.current) return
    const rect = imageRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setMousePosition({ x, y })
  }

  if (images.length === 0) {
    return (
      <div className="relative w-full h-[400px] rounded-2xl overflow-hidden bg-gradient-to-br from-neutral-50 to-neutral-100 border border-neutral-200 flex items-center justify-center">
        <span className="text-sm text-neutral-300">No image</span>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <div 
          ref={imageRef}
          className="relative w-full h-[400px] rounded-2xl overflow-hidden bg-gradient-to-br from-neutral-50 to-neutral-100 border border-neutral-200 cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          onClick={() => openLightbox(currentIndex)}
        >
          {/* Base Image */}
          <Image 
            src={images[currentIndex]} 
            alt={productName} 
            fill 
            className="object-contain p-8" 
            priority 
          />
          
          {/* Zoomed Image Overlay */}
          {isHovering && (
            <div 
              className="absolute inset-0 overflow-hidden pointer-events-none"
              style={
                {
                  '--mouse-x': `${mousePosition.x}px`,
                  '--mouse-y': `${mousePosition.y}px`,
                  maskImage: 'radial-gradient(circle 150px at var(--mouse-x) var(--mouse-y), transparent, black)',
                  WebkitMaskImage: 'radial-gradient(circle 150px at var(--mouse-x) var(--mouse-y), transparent, black)'
                } as React.CSSProperties
              }
            >
              <Image
                src={images[currentIndex]}
                alt={productName}
                fill
                className="object-contain p-8 scale-200 origin-center"
                style={{
                  transformOrigin: `${mousePosition}px ${mousePosition}px`
                }}
                priority
              />
            </div>
          )}

          {/* Magnifying Lens */}
          {isHovering && (
            <div 
              className="absolute pointer-events-none rounded-full border-4 border-white shadow-2xl overflow-hidden"
              style={{
                width: '200px',
                height: '200px',
                left: `${mousePosition.x - 100}px`,
                top: `${mousePosition.y - 100}px`,
                transform: 'translate(-50%, -50%)'
              }}
            >
              <div className="w-full h-full bg-white">
                <Image
                  src={images[currentIndex]}
                  alt={productName}
                  fill
                  className="object-contain p-4"
                  style={{
                    transform: 'scale(2.5)',
                    transformOrigin: `${(mousePosition.x / 600) * 100}% ${(mousePosition.y / 600) * 100}%`
                  }}
                  priority
                />
              </div>
            </div>
          )}

          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={(e) => { e.stopPropagation(); setCurrentIndex(i) }}
                  className={`h-2 rounded-full transition-all ${
                    i === currentIndex 
                      ? 'w-8 bg-white shadow-lg' 
                      : 'w-2 bg-white/50 hover:bg-white/70'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Zoom hint */}
          {!isHovering && (
            <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg">
              <svg className="w-5 h-5 text-neutral-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
              </svg>
            </div>
          )}
        </div>

        {images.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {images.map((img: string, i: number) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`relative w-24 h-24 shrink-0 rounded-2xl overflow-hidden border-2 bg-white shadow-sm transition-all hover:shadow-md ${
                  i === currentIndex 
                    ? 'border-[#1a9f9a] ring-2 ring-[#1a9f9a]/20 scale-105' 
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <Image src={img} alt="" fill className="object-contain p-2" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {isLightboxOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
          onClick={() => setIsLightboxOpen(false)}
        >
          <button
            onClick={() => setIsLightboxOpen(false)}
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"
          >
            <X className="w-6 h-6" />
          </button>

          <div 
            className="relative w-full h-full flex items-center justify-center px-4"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="relative w-full max-w-5xl h-[80vh]">
              <Image
                src={images[lightboxIndex]}
                alt={productName}
                fill
                className="object-contain"
                priority
              />
            </div>

            {images.length > 1 && (
              <>
                <button
                  onClick={handlePrevious}
                  className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <ChevronLeft className="w-8 h-8" />
                </button>
                <button
                  onClick={handleNext}
                  className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <ChevronRight className="w-8 h-8" />
                </button>

                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
                  {images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setLightboxIndex(i)}
                      className={`h-2 rounded-full transition-all ${
                        i === lightboxIndex 
                          ? 'w-8 bg-white' 
                          : 'w-2 bg-white/40 hover:bg-white/60'
                      }`}
                    />
                  ))}
                </div>

                <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm font-medium bg-black/50 px-4 py-2 rounded-full">
                  {lightboxIndex + 1} / {images.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default function ProductDetailClient({ 
  product, 
  related, 
  categoryColors 
}: { 
  product: any
  related: any[]
  categoryColors: Record<string, string>
}) {
  const images = Array.isArray(product.images) ? product.images : []
  const [activeTab, setActiveTab] = useState<TabType>('description')

  return (
    <section className="pt-24 pb-16 px-4 bg-white min-h-screen">
      <div className="max-w-6xl mx-auto space-y-8">

        <Link href="/products" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-[#1a9f9a] transition-colors">
          <ArrowLeft className="w-4 h-4" /> All products
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left - Images */}
          <div className="space-y-4">
            <ProductImages images={images} productName={product.name} />
          </div>

          {/* Right - Product Details */}
          <div className="space-y-6">
            <div className="flex items-center gap-3 flex-wrap">
              <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${categoryColors[product.category] || "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>{product.category}</span>
              <StockBadge stock={product.stock} />
            </div>
            
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-neutral-900 leading-tight">{product.name}</h1>

            {product.description && (
              <p className="text-neutral-600 text-base leading-relaxed">{product.description}</p>
            )}

            <div className="space-y-4 pt-2">
              {product.quoteMode ? (
                <Link href="/quote" className="inline-flex items-center justify-center gap-2 px-8 h-12 rounded-full text-sm font-semibold text-white bg-[#1a9f9a] hover:bg-[#158a85] transition-all duration-300 shadow-lg shadow-[#1a9f9a]/20 hover:shadow-xl hover:shadow-[#1a9f9a]/30 hover:scale-105 w-full">
                  Request a Quote <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Price</p>
                  <p className="text-2xl font-bold text-neutral-900">{product.price ? `Rs. ${Number(product.price).toLocaleString()}` : "—"}</p>
                </div>
              )}
              <div className="space-y-2">
                <p className="text-xs text-neutral-400 uppercase tracking-wider font-semibold">Warranty</p>
                <p className="text-base font-semibold text-neutral-900">{product.warranty || "—"}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {!product.quoteMode && (
                <Link href="/quote" className="inline-flex items-center justify-center gap-2 px-8 h-12 rounded-full text-sm font-semibold text-white bg-[#1a9f9a] hover:bg-[#158a85] transition-all duration-300 shadow-lg shadow-[#1a9f9a]/20 hover:shadow-xl hover:shadow-[#1a9f9a]/30 hover:scale-105">
                  Request a quote <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              <Link href="/#contact" className="inline-flex items-center justify-center gap-2 px-8 h-12 rounded-full text-sm font-medium text-neutral-600 border-2 border-neutral-200 hover:border-[#1a9f9a] hover:text-[#1a9f9a] hover:bg-neutral-50 transition-all">
                Contact us
              </Link>
            </div>

            {/* Tabs */}
            <div className="pt-6 border-t border-neutral-200">
              <div className="flex gap-1 border-b border-neutral-200">
                <button
                  onClick={() => setActiveTab('description')}
                  className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                    activeTab === 'description'
                      ? 'border-[#1a9f9a] text-[#1a9f9a]'
                      : 'border-transparent text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  Description
                </button>
                {product.specs?.length > 0 && (
                  <button
                    onClick={() => setActiveTab('specifications')}
                    className={`px-5 py-3 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                      activeTab === 'specifications'
                        ? 'border-[#1a9f9a] text-[#1a9f9a]'
                        : 'border-transparent text-neutral-500 hover:text-neutral-700'
                    }`}
                  >
                    Specifications
                  </button>
                )}
              </div>

              <div className="py-5">
                {activeTab === 'description' && (
                  <div className="text-neutral-600 text-base leading-relaxed">
                    {product.full_desc || product.description || <span className="text-neutral-400">No description available.</span>}
                  </div>
                )}

                {activeTab === 'specifications' && product.specs?.length > 0 && (
                  <div className="rounded-2xl border border-neutral-200 overflow-hidden bg-neutral-50">
                    <div className="grid grid-cols-1 divide-y divide-neutral-200">
                      {product.specs.map((s: any, index: number) => (
                        <div key={s.label} className={`flex items-center justify-between px-6 py-3 ${index % 2 === 0 ? 'bg-white' : 'bg-neutral-50'}`}>
                          <p className="text-sm font-medium text-neutral-600">{s.label}</p>
                          <p className="text-sm font-semibold text-neutral-900">{s.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="space-y-6 pt-8 border-t border-neutral-200">
            <h2 className="text-xl font-bold text-neutral-900">Related products</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {related.map((r: any) => {
                const rImgs = Array.isArray(r.images) ? r.images : []
                const rThumb = rImgs[0]
                return (
                  <Link key={r.id} href={`/products/${r.id}`} className="group flex flex-col gap-3 p-5 rounded-2xl border border-neutral-200 bg-white hover:border-[#1a9f9a]/30 hover:shadow-xl hover:shadow-neutral-100 transition-all duration-300">
                    <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg border w-fit ${categoryColors[r.category] || "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>{r.category}</span>
                    <div className="relative w-full h-40 rounded-2xl overflow-hidden bg-gradient-to-br from-neutral-50 to-neutral-100 flex items-center justify-center">
                      {rThumb
                        ? <Image src={rThumb} alt={r.name} fill className="object-contain p-4 group-hover:scale-110 transition-transform duration-300" />
                        : <span className="text-xs text-neutral-300">No image</span>}
                    </div>
                    <p className="font-bold text-neutral-900 text-base">{r.name}</p>
                    <p className="text-sm text-neutral-500 leading-relaxed line-clamp-2">{r.description}</p>
                    <p className="text-base font-bold text-neutral-900 mt-auto">{r.price ? `Rs. ${Number(r.price).toLocaleString()}` : "—"}</p>
                  </Link>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
