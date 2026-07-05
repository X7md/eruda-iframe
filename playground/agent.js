/**
 * Playground agent — the only devtools code inside the iframe.
 *
 * All capture, serialization and evaluation is done by chobitsu (a Chrome
 * DevTools Protocol implementation running in this page). This file is just
 * the transport: CDP JSON strings in/out over the "eruda-playground"
 * BroadcastChannel. The host page (index.html) is the CDP client.
 *
 * chobitsu patches console at load and buffers events until Runtime.enable
 * arrives, so logs fired before the host attaches are not lost.
 */
/* global chobitsu */
;(function () {
  'use strict'
  if (typeof BroadcastChannel === 'undefined' || typeof chobitsu === 'undefined') {
    return
  }

  var channel = new BroadcastChannel('eruda-playground')

  chobitsu.setOnMessage(function (message) {
    try {
      channel.postMessage({ type: 'cdp', payload: message })
    } catch {
      /* never let devtools plumbing break the app */
    }
  })

  channel.onmessage = function (e) {
    var msg = e.data || {}
    if (msg.type === 'cdp') chobitsu.sendRawMessage(msg.payload)
  }

  // Out-of-band handshake so the host knows when to (re)send Runtime.enable
  // — chobitsu's state resets on every page load.
  channel.postMessage({ type: 'ready', url: location.pathname })
})()
