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

## Hopeland readers (Hopeland RFID Manager)

Hopeland fixed readers use a **binary `0xAA` protocol** (not Impinj `0xA0`). This app now:

- Sends **STOP** (`MID 0xFF`) after TCP connect, then **inventory on antenna 1** (`MID 0x10`, continuous mode) per Hopeland’s *Data Communication Protocol* examples.
- Parses **active uploads** that start with `AA 12…` and extracts **EPC** patterns (`E2…` / `30…`).

**Hopeland Manager works but Voltrix does not?** Common causes:

1. **Hopeland is on USB/serial** — Voltrix Local only speaks **Ethernet TCP**. Use RJ45 and the reader’s **IP**, or use **Reader IP** + **Connect** on port **9090** (or whatever port shows in Hopeland network settings).
2. **Reader is TCP client** (reports to a host IP) — set the reader’s **server IP** to this PC and use **Listen** in the app, or run with the reader in **TCP server** mode and **Connect** from the PC.
3. **Only one client** — close Hopeland Manager while testing Voltrix, or the reader may reject the second connection.
4. **Wrong port** — discovery now tries several ports; picking a reader from the list **updates the Port field** to the port that answered.

## ERP Endpoint

Set ERP scan API in `.env`:

- `ERP_SCAN_URL=https://voltrixbatteries.com/api/rfid/scanner/scan`

This app posts scanned EPC data directly to ERP.

## In-app updates

The desktop UI no longer shows an update feed (to keep the operator screen simple). App updates are done by installing a new build from your team (`npm run dist`).

## Troubleshooting

- **No reader found**: Use **Reader IP** with the reader’s real address (e.g. `192.168.18.104`) and Connect — discovery only finds readers that accept **inbound** TCP on that port. Or put **three octets** in Subnet (`192.168.18`) so `.1`–`.254` are scanned, not a fourth octet alone.
- **LISTEN … (no reader yet)**: The app is only **accepting TCP** on that port. That is **not** a live scanner. **Connected** appears only after a reader opens a session (push mode) or you **Connect** to a reader IP that accepts TCP. Configure the reader to push to this PC’s IP and port; allow inbound **TCP** on that port in Windows Firewall.
- **Tags not showing**: You need a **reader session** (connected) and **scanning**. In push/listen mode, scanning starts when the reader connects; in direct mode use **Start Scan** after **Connect**. Tags only reflect data from that live session.
