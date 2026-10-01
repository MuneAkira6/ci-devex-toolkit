import { spawnSync } from 'node:child_process'
import os from 'node:os'

/**
 * The machine a measurement was made on. Every number in the results is only meaningful next to
 * it, so it is written into both the JSON and the Markdown and never left to the reader to guess.
 */
export type Machine = {
  readonly osName: string
  readonly platform: string
  readonly release: string
  readonly arch: string
  readonly cpuModel: string
  readonly cpuCount: number
  readonly memoryGiB: number
  readonly dockerVersion: string
  readonly dockerOs: string
  readonly storageDriver: string
}

function dockerInfo(): { version: string; operatingSystem: string; driver: string } {
  const result = spawnSync(
    'docker',
    ['info', '--format', '{{.ServerVersion}}\t{{.OperatingSystem}}\t{{.Driver}}'],
    { encoding: 'utf8' },
  )
  if (result.status !== 0) {
    return { version: 'unknown', operatingSystem: 'unknown', driver: 'unknown' }
  }
  const [version = 'unknown', operatingSystem = 'unknown', driver = 'unknown'] = result.stdout
    .trim()
    .split('\t')
  return { version, operatingSystem, driver }
}

export function readMachine(): Machine {
  const cpus = os.cpus()
  const docker = dockerInfo()
  return {
    osName: os.type(),
    platform: os.platform(),
    release: os.release(),
    arch: os.arch(),
    cpuModel: (cpus[0]?.model ?? 'unknown').replace(/\s+/g, ' ').trim(),
    cpuCount: cpus.length,
    memoryGiB: Math.round((os.totalmem() / 1024 ** 3) * 10) / 10,
    dockerVersion: docker.version,
    dockerOs: docker.operatingSystem,
    storageDriver: docker.driver,
  }
}

/** The one line that goes under the results table. */
export function machineLine(machine: Machine): string {
  return (
    `${machine.osName} ${machine.release} (${machine.arch}), ` +
    `${machine.cpuCount} × ${machine.cpuModel}, ${machine.memoryGiB} GiB, ` +
    `Docker ${machine.dockerVersion} on ${machine.dockerOs}, storage driver ${machine.storageDriver}`
  )
}

/** The platform tag of a results file name: `linux-x64`, `win32-x64`, … */
export function platformTag(machine: Machine): string {
  return `${machine.platform}-${machine.arch}`
}
