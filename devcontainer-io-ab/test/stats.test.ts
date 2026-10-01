import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Machine } from '../machine.ts'
import { machineLine, platformTag } from '../machine.ts'
import { median, ratio, summarise } from '../stats.ts'

// Planted values, not values the harness produced: a median only ever computed by the thing that
// prints it has never been checked.

describe('median', () => {
  it('takes the middle value of an odd count', () => {
    expect(median([5])).toBe(5)
    expect(median([3, 1, 2])).toBe(2)
    expect(median([870, 873, 876, 894, 894])).toBe(876)
  })

  it('takes the mean of the two middle values of an even count', () => {
    expect(median([1, 2])).toBe(1.5)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([100, 200, 300, 401])).toBe(250)
  })

  it('does not care what order the values arrive in', () => {
    expect(median([894, 870, 894, 873, 876])).toBe(876)
    expect(median([2, 4, 1, 3])).toBe(median([3, 1, 4, 2]))
  })

  it('rounds an even-count median to one decimal rather than inventing precision', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([1, 2, 2, 4])).toBe(2)
    expect(median([0, 0, 1, 2])).toBe(0.5)
  })

  it('refuses to answer for no values', () => {
    expect(() => median([])).toThrow('median of no values')
  })
})

describe('summarise', () => {
  it('reports the median, the smallest, the largest and the count', () => {
    expect(summarise([870, 873, 876, 894, 894])).toEqual({
      median: 876,
      min: 870,
      max: 894,
      count: 5,
    })
    expect(summarise([10, 20, 30, 40])).toEqual({ median: 25, min: 10, max: 40, count: 4 })
    expect(summarise([7])).toEqual({ median: 7, min: 7, max: 7, count: 1 })
  })

  it('refuses to answer for no values', () => {
    expect(() => summarise([])).toThrow('summary of no values')
  })
})

describe('ratio', () => {
  it('is bind ÷ volume, to two decimals', () => {
    expect(ratio(876, 1067)).toBe(0.82)
    expect(ratio(1063, 1083)).toBe(0.98)
    expect(ratio(222, 223)).toBe(1)
    expect(ratio(2000, 1000)).toBe(2)
  })

  it('refuses a zero denominator rather than printing Infinity', () => {
    expect(() => ratio(1, 0)).toThrow('ratio with a zero denominator')
  })
})

describe('the machine line', () => {
  const machine: Machine = {
    osName: 'Linux',
    platform: 'linux',
    release: '5.4.0-216-generic',
    arch: 'x64',
    cpuModel: 'Intel(R) Xeon(R) E-2146G CPU @ 3.50GHz',
    cpuCount: 12,
    memoryGiB: 46.9,
    dockerVersion: '28.1.1',
    dockerOs: 'Ubuntu 20.04.6 LTS',
    storageDriver: 'overlay2',
  }

  it('names the OS, the release, the CPU, the memory, Docker and the storage driver', () => {
    expect(machineLine(machine)).toBe(
      'Linux 5.4.0-216-generic (x64), 12 × Intel(R) Xeon(R) E-2146G CPU @ 3.50GHz, 46.9 GiB, ' +
        'Docker 28.1.1 on Ubuntu 20.04.6 LTS, storage driver overlay2',
    )
  })

  it('makes the file-name tag out of the platform and the architecture', () => {
    expect(platformTag(machine)).toBe('linux-x64')
    expect(platformTag({ ...machine, platform: 'win32' })).toBe('win32-x64')
  })
})

describe('the committed results', () => {
  const file = path.join(import.meta.dirname, '..', 'results', '2026-10-01-linux-x64.json')
  type Results = {
    runsPerArm: number
    modules: number
    machine: Machine
    runs: { index: number; arm: string; phases: { phase: string; ms: number }[] }[]
    summary: Record<
      string,
      Record<string, { median: number; min: number; max: number; count: number }>
    >
    ratios: Record<string, number>
  }
  const results = JSON.parse(readFileSync(file, 'utf8')) as Results

  it('holds five runs per arm, alternating, at 1000 modules', () => {
    expect(results.runsPerArm).toBe(5)
    expect(results.modules).toBe(1000)
    expect(results.runs.map((run) => run.arm)).toEqual([
      'bind',
      'volume',
      'bind',
      'volume',
      'bind',
      'volume',
      'bind',
      'volume',
      'bind',
      'volume',
    ])
  })

  it('agrees with the summary it wrote: every median recomputed from the runs', () => {
    for (const phase of ['install', 'build', 'first-request']) {
      for (const arm of ['bind', 'volume']) {
        const values = results.runs
          .filter((run) => run.arm === arm)
          .map((run) => {
            const found = run.phases.find((p) => p.phase === phase)
            if (found === undefined) throw new Error(`no ${phase} in run ${run.index}`)
            return found.ms
          })
        expect(summarise(values)).toEqual(results.summary[phase]?.[arm])
      }
    }
  })

  it('carries the machine it was measured on', () => {
    expect(results.machine.cpuCount).toBeGreaterThan(0)
    expect(results.machine.dockerVersion).not.toBe('unknown')
    expect(results.machine.storageDriver).not.toBe('unknown')
  })
})
