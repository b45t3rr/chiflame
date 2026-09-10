# chiflame (`chifla`)

> End-to-end encrypted (E2EE) & zero-knowledge notifications from your terminal to your pocket.

[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](https://opensource.org/licenses/MIT)
[![Web App](https://img.shields.io/badge/Web%20App-app.chifla.me-white)](https://app.chifla.me)
[![Landing](https://img.shields.io/badge/Website-chifla.me-black)](https://chifla.me)

Chiflame lets you trigger notifications on your phone or browser when commands finish, watch long-running processes by PID, pipe logs, and send alerts with channels and priorities.

All messages are encrypted client-side using **XChaCha20-Poly1305 AEAD**. The server never sees plaintext, titles, channels, or private keys.

---

## Installation

```bash
npm install -g chiflame
```

Or run directly with `npx`:

```bash
npx chiflame auth pair
```

---

## Quickstart (60 seconds)

### 1. Open the Web App (PWA)
Navigate to [app.chifla.me](https://app.chifla.me) on your phone (iOS Safari 16.4+ or Android Chrome) and install it to your home screen. Set up your vault with your biometric passkey (Face ID / Touch ID / Windows Hello).

### 2. Pair your terminal
Run the pairing command:
```bash
chifla auth pair
```
Scan the interactive QR code in your terminal with your phone camera. The ephemeral X25519 sealed box safely transmits the channel data key (CDK) directly to your device.

### 3. Start chiflando

#### Wrap any command
```bash
chifla run -t "Build Producción" npm run build
```
Measures execution time and alerts you on completion with exit code and summary.

#### Watch an existing PID
```bash
chifla wait 14280 -t "Modelo PyTorch"
```
Non-invasively monitors any running process without restarting it.

#### Send instant notifications
```bash
chifla -c deploys -p urgent "Deploy canary al 100% completado"
```

#### Pipe stdout / stderr
```bash
git log -1 --oneline | chifla -t "Nuevo Commit"
```

---

## Commands

| Command | Description |
| :--- | :--- |
| `chifla "msg"` | Quick message to default `#inbox` |
| `chifla send [channel] <msg>` | Send message to specific channel |
| `chifla run [flags] <cmd...>` | Execute command and notify on exit |
| `chifla wait [flags] <PID>` | Monitor active process until termination |
| `chifla auth pair` | Interactive QR pairing |
| `chifla auth status` | Check current pairing and device key |
| `chifla auth unpair` | Revoke device pairing |
| `chifla channels` | List active notification channels |
| `chifla channels create <slug>` | Create a new channel |
| `chifla devices` | List paired devices |
| `chifla whoami` | Show local client identity & public keys |

### Flags

- `-t, --title <str>`: Notification title
- `-c, --channel <slug>`: Channel slug (e.g. `deploys`, `ai`, `inbox`)
- `-p, --priority <level>`: Priority (`min`, `low`, `default`, `high`, `urgent`)
- `--on-error`: Only send notification if the command exits with non-zero code
- `--lines <N>`: Capture last N lines of stdout/stderr (default: 15)
- `--interval <sec>`: Polling interval for process monitoring (default: 1s)
- `--json`: Output JSON to stdout (agent & script friendly)
- `-q, --quiet`: Suppress human-readable logs

---

## Cryptography & Privacy

- **Symmetric Encryption**: XChaCha20-Poly1305 with authenticated associated data (AAD) binding message ID, channel, and sender device.
- **Asymmetric Key Exchange**: Ephemeral X25519 sealed box for pairing new devices.
- **Hardware Vault**: Client keys protected via WebAuthn PRF and stored in device hardware enclaves.
- **Zero Knowledge**: Supabase database and Cloudflare Edge only handle opaque ciphertexts.

---

## Links

- **Web App**: [https://app.chifla.me](https://app.chifla.me)
- **Landing Page**: [https://chifla.me](https://chifla.me)
- **Source Code**: [https://github.com/b45t3rr/chiflame](https://github.com/b45t3rr/chiflame)
- **License**: MIT
