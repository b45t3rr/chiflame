# Agent-first

La CLI existe tanto para humanos como para agentes. Un agente no lee un tutorial: corre un comando.

## Contrato

Cuando el humano dice *“chiflame”*, *“avisame”*, *“mandá un chifla”* o *“y chiflame cuando termines”*:

1. Al terminar el trabajo (éxito o fallo), ejecutar `chifla "<resumen corto>"`.
2. No hacer `auth pair` (exige TTY y un humano con el teléfono).
3. No imprimir secretos. `--json` si hay que parsear.
4. Exit 0 = el server aceptó. No esperar ACK humano.
5. Si exit 4 / `not_paired`: decirle al humano que corra `chifla auth pair`.

## Comando canónico

```text
chifla "tests green"
chifla -t "Deploy" -p high "prod OK"
chifla -c deploys "canary 20%"
```

Stdin:

```text
git log -1 --oneline | chifla -t "shipped"
```

CI:

```text
CHIFLA_JSON=1 chifla -q "nightly failed"
```

## Snippet para `AGENTS.md` (copiar al repo del usuario, no a este)

```markdown
## Chiflame

If the user asks to be notified (e.g. "chiflame when you're done"), run:

    chifla "<one-line summary>"

Use `--json` only if you need to parse the result. Do not run `chifla auth pair`
(the human must scan a QR). If the command exits non-zero with `not_paired` or
`device_revoked`, tell the user to pair the CLI on their machine.
```

## Skill corto (futuro, `~/.agents` o bundled)

Nombre: `chiflame`. Trigger: el usuario pide notificación al terminar. Acción: el comando de arriba. No es parte del pack de diseño de producto más que este contrato.

## Qué no hacer el agente

- Inventar el passphrase.
- Leer `~/.config/chiflame/config.json` para “verificar”.
- Reintentar pairing en loop.
- Mandar el diff entero (límite 4 KiB; resumen).
- Asumir que el humano vio el push (exit 0 ≠ leído).

## Discoverability

`chifla --help` menciona:

```text
Agent-friendly: chifla "message"   JSON: --json   quiet: -q
```

`whoami --json` sirve para debug (“¿estoy paired?”) sin dump de keys.
