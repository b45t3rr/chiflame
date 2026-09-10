# Visión — Chiflame

## Objective

Chiflame manda notificaciones **privadas y cifradas de extremo a extremo** desde una CLI (y agentes) hacia dispositivos con una **PWA instalable**.

Promesa de v1:

```text
npm i -g chiflame
chifla auth pair          # QR en la terminal
# escanear → PWA → passphrase → activar notificaciones
chifla "build listo"      # llega al teléfono
```

Para un agente: el usuario dice *“y chiflame cuando termines”* y el agente corre `chifla "done"`.

## Usuario

Desarrolladora o agente que ya está en una terminal. Quiere un ping en el teléfono (o el desktop) cuando algo termina, sin Slack, sin ntfy público, sin app nativa por plataforma.

Un usuario. **v1:** una PWA (el vault host) + N CLIs. **v1.1:** N PWAs vía email + prelogin. No es un chat. No es un topic público.

## Problema

- ntfy.sh y similares son fáciles, pero los topics pueden ser adivinables y el servidor lee el mensaje.
- Pushover / OneSignal son cuentas + API keys + el operador ve el contenido.
- FCM/APNs nativos fragmentan Android / iOS / Linux.
- Un agente no debería pelearse con OAuth para avisar “los tests pasaron”.

## Solución

| Pieza | Rol |
|---|---|
| CLI `chifla` (npm `chiflame`) | Sender agent-first. Pairing por QR. |
| PWA | Receiver instalable. Inbox + Settings. Web Push. |
| Supabase | Buzón ciego: Auth, Postgres, Realtime, Edge Functions. |
| Passphrase | Desbloquea el vault en el cliente. Nunca viaja en claro. |

## Success (producto)

- Pairing en menos de 2 minutos, un QR y un código de 6 caracteres.
- `chifla "hola"` llega como notificación de SO en un dispositivo con la PWA instalada.
- En el SQL editor de Supabase, `messages.ciphertext` no es JSON de title/body.
- Si se pierde la passphrase, **nadie** (tampoco nosotros) recupera el contenido. Copy explícito.
- Un agente puede mandar un mensaje con un solo comando, JSON en stdout, exit 0 = aceptado.

## Anti-goals (v1)

- Chat, threads, reacciones.
- Topics públicos tipo `ntfy.sh/mytopic`.
- Apps nativas, FCM/APNs directos, UnifiedPush.
- `chifla listen` en la terminal.
- Búsqueda server-side del cuerpo del mensaje (imposible con E2E).
- “Forgot password” que descifre el vault.
- Orgs, billing, self-host como requisito de lanzamiento.

## Asunciones

1. Cloud-first: un proyecto Supabase hosted. Contratos compatibles con self-host después.
2. Marca: producto **Chiflame**, comando **chifla**, PWA `app.chiflame.dev` (placeholder).
3. iOS 16.4+: push solo con PWA añadida a inicio y abierta desde el icono.
4. Email es opcional (recovery de **cuenta Auth**, no del vault).
5. Shared channels: schema sí, UI/invites no hasta v1.1.
6. Email interno siempre (sintético si el humano no lo da). UI de email sigue opcional. Recovery de GoTrue deshabilitado.

## Alternativas rechazadas

| Idea | Por qué no |
|---|---|
| Server-side encryption en Edge Functions | Nosotros podríamos leer todo. Mata la confianza. |
| Solo Realtime, sin tabla | No hay inbox ni historia. |
| Solo Web Push, sin E2E en el blob | El servidor arma title/body → ve el contenido. |
| VAPID derivado del passphrase | VAPID identifica al application server, no al usuario. |
| Auth password = passphrase en claro en GoTrue | El servidor tendría un secreto equivalente al vault. |

## Frase de producto

> Si perdés la passphrase, no hay backdoor. Ni nosotros.
