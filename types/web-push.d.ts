declare module "web-push" {
  export function generateVAPIDKeys(): { publicKey: string; privateKey: string }
  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  export function sendNotification(
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string,
  ): Promise<unknown>
  const webpush: {
    generateVAPIDKeys: typeof generateVAPIDKeys
    setVapidDetails: typeof setVapidDetails
    sendNotification: typeof sendNotification
  }
  export default webpush
}
