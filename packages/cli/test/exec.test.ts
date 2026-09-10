import { describe, expect, it } from "vitest"
import { formatDuration, isPidRunning, getProcessName } from "../src/exec.js"

describe("exec helpers", () => {
  describe("formatDuration", () => {
    it("formats milliseconds", () => {
      expect(formatDuration(450)).toBe("450ms")
    })

    it("formats seconds", () => {
      expect(formatDuration(15_000)).toBe("15s")
      expect(formatDuration(59_000)).toBe("59s")
    })

    it("formats minutes and seconds", () => {
      expect(formatDuration(60_000)).toBe("1m")
      expect(formatDuration(125_000)).toBe("2m 5s")
    })

    it("formats hours, minutes and seconds", () => {
      expect(formatDuration(3_665_000)).toBe("1h 1m 5s")
    })
  })

  describe("isPidRunning", () => {
    it("returns true for the current process", () => {
      expect(isPidRunning(process.pid)).toBe(true)
    })

    it("returns false for an invalid or non-existent PID", () => {
      expect(isPidRunning(-1)).toBe(false)
      expect(isPidRunning(0)).toBe(false)
      expect(isPidRunning(99999999)).toBe(false)
    })
  })

  describe("getProcessName", () => {
    it("identifies the current process name or returns null gracefully", () => {
      const name = getProcessName(process.pid)
      if (name) {
        expect(typeof name).toBe("string")
        expect(name.length).toBeGreaterThan(0)
      }
    })
  })
})
