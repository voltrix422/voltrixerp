# Voltrix RFID Local App

Clean standalone Windows application for RFID reader control and ERP sync.

This folder is fully isolated from the ERP web app code so it does not interfere with existing deployment.

## Folder Structure

- `package.json` - app dependencies and build scripts
- `.env.example` - environment variables for ERP endpoint and reader defaults
- `src/main.js` - Electron main process and scanner orchestration
- `src/preload.js` - secure IPC bridge for renderer UI
- `src/reader-service.js` - TCP reader connection and EPC extraction
- `src/index.html` - simple operator UI
- `src/renderer.js` - frontend behavior
- `src/styles.css` - UI styles

## What This App Does

1. Search scanner IPs on local subnet
2. Connect to reader by IP/port
3. Start/stop scan session
4. Show live tag list and counters
5. Forward tags to ERP API automatically
6. Check/download/install app updates from a feed URL

## Quick Start (Windows)

```bash
cd rfid-local-app
npm install
copy .env.example .env
npm run dev
```

## Build Installer

```bash
npm run dist
```

Output installer is created by `electron-builder` in `dist/`.

## ERP Endpoint

Set ERP scan API in `.env`:

- `ERP_SCAN_URL=https://voltrixbatteries.com/api/rfid/scanner/scan`

This app posts scanned EPC data directly to ERP.

## In-App Auto Update

The app includes an update panel with:

- `Check Update`
- `Download Update`
- `Install Update`

Set your update feed URL in the app (for example a static directory that contains the generated `latest.yml` and installer files).

You can also preconfigure it via environment variable:

- `APP_UPDATE_URL=https://your-domain/rfid-updates`

## Troubleshooting

- **No reader found**: Use **Reader IP** with the reader’s real address (e.g. `192.168.18.104`) and Connect — discovery only finds readers that accept **inbound** TCP on that port. Or put **three octets** in Subnet (`192.168.18`) so `.1`–`.254` are scanned, not a fourth octet alone.
- **LISTEN … Packets: 0**: The reader must be configured to **push** to this PC’s IP and the same port (e.g. `9090`). Allow inbound **TCP** on that port in Windows Firewall.
- **Tags not showing**: Ensure **Start Scan** is on (auto mode turns it on in listen mode when the reader connects). Update the app if you are on an older build; newer builds parse passive streams as soon as the reader opens the socket.
