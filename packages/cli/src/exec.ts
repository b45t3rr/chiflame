import { execSync, spawn } from "node:child_process"
import { type CliConfig } from "./config.js"
import { CliError, EXIT } from "./exit.js"
import type { GlobalFlags } from "./parse.js"
import { sendMessage } from "./send.js"

export function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000)
  if (sec < 1) return `${ms}ms`
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  const remSec = sec % 60
  if (min < 60) return remSec > 0 ? `${min}m ${remSec}s` : `${min}m`
  const hrs = Math.floor(min / 60)
  const remMin = min % 60
  return `${hrs}h ${remMin}m ${remSec}s`
}

export function isPidRunning(pid: number): boolean {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (err: unknown) {
    return (err as { code?: string })?.code === "EPERM"
  }
}

export function getProcessName(pid: number): string | null {
  try {
    if (process.platform === "win32") {
      const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 2000,
      })
      const m = /^"([^"]+)"/.exec(out.trim())
      return m ? m[1] : null
    } else {
      const out = execSync(`ps -p ${pid} -o comm=`, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
        timeout: 2000,
      })
      return out.trim() || null
    }
  } catch {
    return null
  }
}

export async function waitProcess(
  cfg: CliConfig,
  configPath: string,
  pidStr: string | undefined,
  flags: GlobalFlags,
): Promise<number> {
  if (!pidStr) {
    throw new CliError("usage", "chifla wait <PID>", EXIT.usage)
  }
  const pid = parseInt(pidStr, 10)
  if (isNaN(pid) || pid <= 0) {
    throw new CliError("usage", `PID inválido: '${pidStr}' debe ser un número entero positivo`, EXIT.usage)
  }

  if (!isPidRunning(pid)) {
    throw new CliError("not_found", `El proceso con PID ${pid} no existe o ya ha finalizado`, EXIT.usage)
  }

  const procName = getProcessName(pid) || `PID ${pid}`
  const intervalMs = Math.max(500, flags.interval ? flags.interval * 1000 : 1000)

  if (!flags.quiet && !flags.json) {
    process.stderr.write(`chifla: monitoreando ${procName} (PID ${pid}). Te avisaremos cuando finalice.\n`)
  }

  const start = Date.now()

  await new Promise<void>((resolve) => {
    const timer = setInterval(() => {
      if (!isPidRunning(pid)) {
        clearInterval(timer)
        process.removeListener("SIGINT", onSigInt)
        resolve()
      }
    }, intervalMs)

    const onSigInt = () => {
      clearInterval(timer)
      if (!flags.quiet && !flags.json) {
        process.stderr.write("\nchifla: monitoreo cancelado por el usuario.\n")
      }
      process.exit(130)
    }
    process.once("SIGINT", onSigInt)
  })

  const duration = formatDuration(Date.now() - start)
  const title = flags.title ?? `Proceso finalizado: ${procName}`
  const body = `El proceso ${procName} (PID ${pid}) ha finalizado tras ${duration} de monitoreo.`
  const priority = flags.priority ?? "default"

  try {
    await sendMessage(cfg, configPath, {
      slug: flags.channel ?? cfg.default_channel ?? "inbox",
      body,
      title,
      priority,
      ttl: flags.ttl,
      click: flags.click,
      json: flags.json,
      quiet: flags.quiet,
    })
  } catch (err) {
    process.stderr.write(`chifla: no se pudo enviar la notificación: ${err instanceof Error ? err.message : String(err)}\n`)
  }

  if (!flags.quiet && !flags.json) {
    process.stderr.write(`chifla: proceso ${pid} (${procName}) finalizado tras ${duration}. Notificación enviada.\n`)
  }

  return EXIT.ok
}

export async function runCommand(
  cfg: CliConfig,
  configPath: string,
  args: string[],
  flags: GlobalFlags,
): Promise<number> {
  if (args.length === 0) {
    throw new CliError("usage", "chifla run <comando...>", EXIT.usage)
  }

  const cmd = args[0]
  const cmdArgs = args.slice(1)
  const fullCmd = args.join(" ")
  const maxLines = flags.lines && flags.lines > 0 ? flags.lines : 15
  const tailLines: string[] = []

  function appendLine(line: string) {
    if (!line) return
    tailLines.push(line)
    if (tailLines.length > maxLines) {
      tailLines.shift()
    }
  }

  const start = Date.now()

  return new Promise<number>((resolve) => {
    const child = spawn(fullCmd, {
      stdio: ["inherit", "pipe", "pipe"],
      shell: true,
    })

    let stdoutRemainder = ""
    child.stdout?.on("data", (chunk: Buffer) => {
      process.stdout.write(chunk)
      stdoutRemainder += chunk.toString("utf8")
      const lines = stdoutRemainder.split("\n")
      stdoutRemainder = lines.pop() ?? ""
      for (const l of lines) appendLine(l.replace(/\r$/, ""))
    })

    let stderrRemainder = ""
    child.stderr?.on("data", (chunk: Buffer) => {
      process.stderr.write(chunk)
      stderrRemainder += chunk.toString("utf8")
      const lines = stderrRemainder.split("\n")
      stderrRemainder = lines.pop() ?? ""
      for (const l of lines) appendLine(l.replace(/\r$/, ""))
    })

    child.on("error", async (err) => {
      process.stderr.write(`chifla: error al ejecutar comando: ${err.message}\n`)

      try {
        await sendMessage(cfg, configPath, {
          slug: flags.channel ?? cfg.default_channel ?? "inbox",
          body: `No se pudo iniciar el comando: \`${fullCmd}\`\nError: ${err.message}`,
          title: flags.title ?? `❌ Error: ${cmd}`,
          priority: flags.priority ?? "urgent",
          ttl: flags.ttl,
          click: flags.click,
          json: flags.json,
          quiet: flags.quiet,
        })
      } catch {
        // ignore send error
      }
      resolve(1)
    })

    child.on("close", async (code, signal) => {
      if (stdoutRemainder) appendLine(stdoutRemainder.replace(/\r$/, ""))
      if (stderrRemainder) appendLine(stderrRemainder.replace(/\r$/, ""))

      const duration = formatDuration(Date.now() - start)
      const exitCode = code !== null ? code : (signal ? 1 : 0)
      const success = exitCode === 0

      if (flags.onError && success) {
        resolve(exitCode)
        return
      }

      let title: string
      let priority: string
      let body: string

      if (success) {
        title = flags.title ?? `✅ ${cmd} completado`
        priority = flags.priority ?? "default"
        body = `Comando: \`${fullCmd}\`\nEstado: Exitoso (exit 0)\nDuración: ${duration}`
      } else {
        title = flags.title ?? `❌ ${cmd} falló (código ${exitCode})`
        priority = flags.priority ?? "urgent"
        const snippet =
          tailLines.length > 0
            ? `\n\nÚltimas líneas de salida:\n\`\`\`text\n${tailLines.join("\n").slice(-2500)}\n\`\`\``
            : ""
        body = `Comando: \`${fullCmd}\`\nEstado: Falló con código ${exitCode}\nDuración: ${duration}${snippet}`
      }

      try {
        await sendMessage(cfg, configPath, {
          slug: flags.channel ?? cfg.default_channel ?? "inbox",
          body,
          title,
          priority,
          ttl: flags.ttl,
          click: flags.click,
          json: flags.json,
          quiet: flags.quiet,
        })
      } catch (err) {
        process.stderr.write(`chifla: no se pudo enviar la notificación: ${err instanceof Error ? err.message : String(err)}\n`)
      }

      resolve(exitCode)
    })

    const onSigInt = () => {
      if (!child.killed) {
        child.kill("SIGINT")
      }
    }
    process.on("SIGINT", onSigInt)
  })
}
