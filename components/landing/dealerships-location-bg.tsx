"use client"

import "./dealerships-location-bg.css"

const PINS = [
  { x: 216, y: 224, delay: 0 },
  { x: 504, y: 416, delay: 1.2 },
  { x: 816, y: 272, delay: 0.6 },
  { x: 984, y: 496, delay: 1.8 },
  { x: 660, y: 624, delay: 2.4 },
  { x: 360, y: 560, delay: 0.9 },
] as const

export default function DealershipsLocationBg() {
  return (
    <div className="dealerships-location-bg" aria-hidden="true">
      <div className="dealerships-location-bg__gradient" />

      <svg className="dealerships-location-bg__svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="dealerships-map-grid" width="48" height="48" patternUnits="userSpaceOnUse">
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="rgba(26, 159, 154, 0.08)"
              strokeWidth="1"
            />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#dealerships-map-grid)" className="dealerships-location-bg__grid" />

        <path
          d="M 180 220 C 320 180, 420 280, 520 360 S 720 420, 880 380"
          className="dealerships-location-bg__route"
          style={{ animationDelay: "0s" }}
        />
        <path
          d="M 120 520 C 260 480, 380 560, 500 500 S 760 440, 960 520"
          className="dealerships-location-bg__route dealerships-location-bg__route--alt"
          style={{ animationDelay: "1.5s" }}
        />
        <path
          d="M 300 140 C 420 200, 540 160, 660 220 S 820 300, 980 260"
          className="dealerships-location-bg__route dealerships-location-bg__route--thin"
          style={{ animationDelay: "0.8s" }}
        />

        {PINS.map((pin, i) => (
          <g key={i} transform={`translate(${pin.x} ${pin.y})`}>
            <g
              className="dealerships-location-bg__pin"
              style={{ animationDelay: `${pin.delay}s` }}
            >
              <circle r="28" className="dealerships-location-bg__pulse dealerships-location-bg__pulse--outer" />
              <circle r="16" className="dealerships-location-bg__pulse dealerships-location-bg__pulse--inner" />
              <circle r="5" className="dealerships-location-bg__dot" />
              <path d="M 0 5 L 0 14" className="dealerships-location-bg__stem" />
            </g>
          </g>
        ))}
      </svg>

      <div className="dealerships-location-bg__fade" />
    </div>
  )
}
