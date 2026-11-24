// With --trace-files of the tests (TS_SQL_QUERY_TRACE_FILES), a line when each test file starts and ends, with the
// process that runs it, written straight to the standard error of the process (not through the console the runner
// captures), so it is in the log at once even when the process then hangs: the files that started and didn't end are
// the ones each worker was running. vitest only (a setup file runs for each test file); bun:test prints the name of
// each file it runs.
import { writeSync } from 'node:fs'
import { afterAll, beforeAll, expect } from 'vitest'

function trace(event: string): void {
    writeSync(2, '[trace-files] ' + new Date().toISOString() + ' pid ' + process.pid + ' ' + event + ' ' + String(expect.getState().testPath) + '\n')
}

if (process.env['TS_SQL_QUERY_TRACE_FILES'] === 'on') {
    beforeAll(() => trace('start'))
    afterAll(() => trace('end'))
}
