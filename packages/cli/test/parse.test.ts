import { describe, expect, it } from "vitest"
import { parseArgv } from "../src/parse.js"

describe("parseArgv", () => {
  it("treats a bare string as send", () => {
    const p = parseArgv(["hola mundo"])
    expect(p.command).toBe("send")
    expect(p.args).toEqual(["hola mundo"])
  })

  it("parses send with channel", () => {
    const p = parseArgv(["send", "deploys", "hola"])
    expect(p.command).toBe("send")
    expect(p.args).toEqual(["deploys", "hola"])
  })

  it("parses flags", () => {
    const p = parseArgv(["--json", "-q", "-t", "T", "auth", "pair"])
    expect(p.flags.json).toBe(true)
    expect(p.flags.quiet).toBe(true)
    expect(p.flags.title).toBe("T")
    expect(p.command).toBe("auth")
    expect(p.args).toEqual(["pair"])
  })

  it("parses run with command and child flags", () => {
    const p = parseArgv(["run", "-t", "Test Run", "npm", "test", "--coverage", "--verbose"])
    expect(p.command).toBe("run")
    expect(p.flags.title).toBe("Test Run")
    expect(p.args).toEqual(["npm", "test", "--coverage", "--verbose"])
  })

  it("parses run with explicit delimiter --", () => {
    const p = parseArgv(["run", "--on-error", "-t", "Build", "--", "cargo", "build", "--release"])
    expect(p.command).toBe("run")
    expect(p.flags.onError).toBe(true)
    expect(p.flags.title).toBe("Build")
    expect(p.args).toEqual(["cargo", "build", "--release"])
  })

  it("parses wait with pid and flags", () => {
    const p = parseArgv(["wait", "98765", "-t", "Process Monitor", "--interval", "2"])
    expect(p.command).toBe("wait")
    expect(p.args).toEqual(["98765"])
    expect(p.flags.title).toBe("Process Monitor")
    expect(p.flags.interval).toBe(2)
  })

  it("parses watch alias with pid", () => {
    const p = parseArgv(["watch", "1234"])
    expect(p.command).toBe("watch")
    expect(p.args).toEqual(["1234"])
  })
})

