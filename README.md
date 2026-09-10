# 🔔 Chiflame

> **Notificaciones End-to-End Encrypted (E2EE) y Zero-Knowledge desde tu terminal hacia tu teléfono o navegador.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Security: Zero-Knowledge](https://img.shields.io/badge/Security-Zero--Knowledge%20E2EE-emerald.svg)](#-auditor%C3%ADa-de-cifrado-zero-knowledge-verificable)
[![Crypto: Libsodium/Noble](https://img.shields.io/badge/Crypto-XChaCha20--Poly1305-purple.svg)](#-auditor%C3%ADa-de-cifrado-zero-knowledge-verificable)
[![PWA: app.chifla.me](https://img.shields.io/badge/PWA-app.chifla.me-orange.svg)](https://app.chifla.me)

Chiflame te permite recibir alertas seguras en tiempo real en tus dispositivos móviles o de escritorio cuando terminan tus builds, deploys, scripts de CI, backups o cualquier comando de consola, **sin que el servidor jamás tenga acceso al contenido de tus mensajes**.

## Instala la CLI en segundos

Instala Chiflame globalmente desde npm y úsalo desde cualquier terminal:

```bash
npm install -g chiflame
```

Después, vinculá tu terminal con la PWA ejecutando `chifla auth pair`.

🌐 **Aplicación Web / PWA:** [https://app.chifla.me](https://app.chifla.me)

---

## 🔒 Auditoría de Cifrado (Zero-Knowledge Verificable)

Publicamos este código como Open Source para que cualquier desarrollador o auditor pueda verificar matemáticamente las garantías de privacidad:

1. **Cifrado en el Cliente:**
   * Todo mensaje se cifra **en tu terminal o navegador antes de tocar la red** usando **XChaCha20-Poly1305** con autenticación criptográfica AAD (`id|channel_id|sender_device_id`).
   * Ver implementación: [`packages/crypto/src/symmetric.ts`](./packages/crypto/src/symmetric.ts) y [`packages/cli/src/send.ts`](./packages/cli/src/send.ts).

2. **Intercambio de Claves Asimétrico:**
   * La Channel Data Key (CDK) se transfiere entre tus dispositivos cifrada con **X25519 Sealed Box** (`crypto_box_seal`).
   * El backend de Supabase solo almacena `sealed_key`; ni la base de datos ni los administradores del servidor pueden leer la clave del canal.
   * Ver implementación: [`packages/crypto/src/asymmetric.ts`](./packages/crypto/src/asymmetric.ts).

3. **Firma y Autenticación de Dispositivos:**
   * Todas las operaciones críticas de pairing y revocación requieren **Proof-of-Possession con Ed25519** (`X-Device-Id`, `X-Signature`, timestamp y nonces).
   * Ver implementación: [`packages/crypto/src/signatures.ts`](./packages/crypto/src/signatures.ts).

4. **Notificaciones Push Opacas:**
   * Las notificaciones Web Push emitidas por el servidor **no contienen texto, títulos ni payloads del mensaje**.
   * Solo transmiten una señal silenciosa `{ message_id, channel_id, priority }`. La PWA se despierta en segundo plano, descarga el blob cifrado y lo descifra localmente en memoria.
   * Ver implementación: [`supabase/functions/dispatch-push/index.ts`](./supabase/functions/dispatch-push/index.ts).

---

## ⚡ Instalación y Uso Rápido

### 1. Emparejar la CLI con tu teléfono o navegador

Abre [https://app.chifla.me](https://app.chifla.me) en tu dispositivo y luego ejecuta:

```bash
# Emparejamiento por código QR interactivo en tu terminal
node packages/cli/dist/index.js auth pair
# O cuando esté publicado en npm:
# chifla auth pair
```

Escanea el código QR generado en la terminal con la cámara de tu teléfono o confirma el código de 6 dígitos en la web.

### 2. Enviar mensajes cifrados

```bash
# Envío directo al canal por defecto (inbox)
chifla "Deploy finalizado con éxito"

# Con título y prioridad urgente
chifla -t "Base de Datos" -p urgent "Fallo de conexión en réplica 2"

# Enviar a un canal específico
chifla send deploys "Versión v1.2.0 en staging"
```

### 3. Ejecutar comandos y avisar al finalizar (`chifla run`)

Ejecuta cualquier tarea pesada, muestra su progreso en vivo y te avisa a tu celular al concluir:

```bash
# Ejecutar y avisar (mide tiempo de ejecución y detecta código de salida)
chifla run npm test

# Con título personalizado
chifla run -t "Build de Producción" npm run build

# Solo avisar si algo falla (con prioridad urgente y logs adjuntos)
chifla run --on-error cargo build --release
```

### 4. Anclar a procesos que ya están corriendo (`chifla wait`)

Si ya lanzaste un proceso largo en otra terminal o en segundo plano:

```bash
# Monitorea el PID y te avisa en cuanto finalice
chifla wait 14280

# Con título personalizado
chifla wait 14280 -t "Entrenamiento de Modelo"
```

### 5. Enviar salida por tubería (Pipes / Stdin)

```bash
# Enviar los últimos logs de un build
npm run build 2>&1 | tail -n 15 | chifla -t "Build status"

# Enviar el último commit de git tras un deploy
git log -1 --oneline | chifla -t "Git Shipped"
```

---

## 📁 Estructura del Monorepo

```text
chiflame/
├── apps/
│   └── web/                # PWA (React 19 + Vite + Tailwind CSS + shadcn)
├── packages/
│   ├── cli/                # Binarios chifla y chiflame (Node.js)
│   └── crypto/             # Primitivas criptográficas puras (@noble/hashes, ciphers, curves)
├── supabase/
│   ├── migrations/         # Schemas SQL con RLS estricto e índices
│   └── functions/          # Edge Functions (Deno / TypeScript)
└── docs/                   # Especificaciones de arquitectura, modelo de amenazas y flujos
```

---

## 🛠️ Desarrollo Local y Tests

```bash
# Instalar dependencias del monorepo
npm install

# Correr los tests criptográficos y de CLI
npm test

# Compilar todos los paquetes
npm run build

# Iniciar la PWA en modo desarrollo
npm run dev
```

---

## 📄 Licencia

Este proyecto está liberado bajo la licencia [MIT](./LICENSE).
