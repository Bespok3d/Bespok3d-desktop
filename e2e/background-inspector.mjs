// SPDX-FileCopyrightText: Copyright (C) 2026 unlucio and the Bespok3d contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import WebSocket from 'ws'

export function installBackgroundWindowHook(endpoint, source) {
  return new Promise(function connectInspector(resolve, reject) {
    const socket = new WebSocket(endpoint)
    const pending = new Map()
    var sequence = 0
    const timer = setTimeout(() => fail(new Error('Background startup hook timed out')), 15_000)

    function fail(error) {
      clearTimeout(timer)
      socket.terminate()
      reject(error)
    }

    function send(method, params = {}) {
      return new Promise(function request(resolveCommand, rejectCommand) {
        const id = ++sequence
        pending.set(id, { resolveCommand, rejectCommand })
        socket.send(JSON.stringify({ id, method, params }))
      })
    }

    async function inject(callFrameId) {
      const evaluated = await send('Debugger.evaluateOnCallFrame', {
        callFrameId, expression: `(function () { ${source}\n; return true })()`, returnByValue: true,
      })
      if (evaluated.exceptionDetails) throw new Error(JSON.stringify(evaluated.exceptionDetails))
      await send('Debugger.resume')
      clearTimeout(timer)
      socket.close()
      resolve()
    }

    socket.on('error', fail)
    socket.on('open', async function startDebugger() {
      try {
        await send('Debugger.enable')
        await send('Runtime.runIfWaitingForDebugger')
      } catch (error) { fail(error) }
    })
    socket.on('message', function receive(bytes) {
      const message = JSON.parse(String(bytes))
      const command = pending.get(message.id)
      if (command) {
        pending.delete(message.id)
        if (message.error) command.rejectCommand(new Error(message.error.message))
        else command.resolveCommand(message.result)
      }
      if (message.method === 'Debugger.paused') inject(message.params.callFrames[0].callFrameId).catch(fail)
    })
  })
}
