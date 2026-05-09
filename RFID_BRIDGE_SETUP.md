# RFID Bridge Setup (Fixes "connected but no tags")

If Hopeland RFID Manager sees tags but ERP does not, the missing part is **packet forwarding**.

Your ERP runs on VPS, but reader is on local LAN (`192.168.18.x`).  
So run a bridge on your local Windows machine to forward EPC packets to ERP.

## 1) Set reader host target in Hopeland

In reader network settings:

- `HOST_SERVER_IP` = your local PC LAN IP (example: `192.168.18.10`)
- `HOST_SERVER_PORT` = `9090`
- `MODE` = `SERVER`

This makes reader push data to your local bridge.

## 2) Run bridge on local PC

From project folder:

```bash
npm install
npm run rfid:bridge
```

Optional custom env:

```bash
ERP_SCAN_URL=https://voltrixbatteries.com/api/rfid/scanner/scan ERP_CONNECT_URL=https://voltrixbatteries.com/api/rfid/scanner RFID_BRIDGE_HOST=0.0.0.0 RFID_BRIDGE_PORT=9090 RFID_READER_IP=192.168.18.112 RFID_READER_PORT=9090 npm run rfid:bridge
```

## 3) Verify

- Keep ERP RFID page open.
- Start scanning in Hopeland.
- Live tags should appear in ERP tag grid automatically.

## 4) Common issues

- **No tags in ERP**: reader still points to old host IP, not your bridge PC.
- **Port blocked**: allow `9090` on Windows firewall.
- **Hopeland connected directly**: some readers/sessions allow one active stream. Prefer bridge path during ERP testing.
