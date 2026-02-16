# viem-hw Example App

Test the viem-hw library with real Ledger and Trezor hardware devices.

## Setup

```bash
cd example
bun install
bun dev
```

Then open http://localhost:5173 in Chrome or Edge (WebHID requires these browsers).

## Requirements

### Ledger
- Ledger Nano S/X/S Plus connected via USB
- Ethereum app installed and open on the device
- Chrome/Edge browser (WebHID support)

### Trezor
- Trezor Model T/One connected via USB
- Trezor Bridge installed, OR use Chrome with WebUSB

## Features Tested

- ✅ Device connection (WebHID for Ledger)
- ✅ Account discovery (BIP-44 paths)
- ✅ Message signing (personal_sign)
- ✅ EIP-712 typed data signing
- ✅ Address verification on device (Ledger)
- ✅ Device info retrieval
- ✅ Error handling (rejection, locked, app not open)

## Troubleshooting

### "No device found"
- Make sure the device is connected via USB
- For Ledger: Open the Ethereum app
- Try a different USB port or cable

### "WebHID not supported"
- Use Chrome, Edge, or other Chromium-based browser
- Localhost or HTTPS is required

### "User rejected"
- The user pressed cancel/reject on the device

### "Device locked"
- Enter your PIN on the device first

## Stack

- React + TypeScript
- Vite
- Tailwind CSS
- viem-hw (local link)
