/** Full-frame, high-res scan so small / slightly smeared box QRs can still decode. */
export function productQrCameraConfig() {
  return {
    fps: 16,
    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
      const edge = Math.min(viewfinderWidth, viewfinderHeight)
      const size = Math.max(180, Math.floor(edge * 0.88))
      return { width: size, height: size }
    },
    aspectRatio: 1,
    disableFlip: false,
  }
}
