/**
 * Host-side Chrome DevTools Protocol client for the playground.
 *
 * The iframe runs chobitsu (the CDP backend); this client runs in the host
 * page next to eruda's UI. It sends CDP commands, resolves their responses,
 * dispatches CDP events, and "materializes" CDP RemoteObjects into real
 * display values for eruda's console — walking object graphs over the wire
 * with Runtime.getProperties up to a depth limit.
 */
window.PlaygroundCDP = (function () {
  'use strict'

  var MAX_DEPTH = 3
  var MAX_PROPS = 100

  var nextId = 0
  var pending = new Map()
  var eventHandlers = {}
  var postPayload = null
  var nodeResolver = null

  function connect(post) {
    postPayload = post
  }

  // Same-origin escape hatch for DOM nodes: materialize() stashes the node
  // on the target realm's window via callFunctionOn, and this host-provided
  // resolver picks up the live reference so the console can render a real
  // element instead of an HTML string. Optional — without it, nodes
  // degrade to their outerHTML text.
  function setNodeResolver(fn) {
    nodeResolver = fn
  }

  function send(method, params) {
    return new Promise(function (resolve) {
      var id = ++nextId
      pending.set(id, resolve)
      postPayload(JSON.stringify({ id: id, method: method, params: params || {} }))
    })
  }

  function on(method, handler) {
    eventHandlers[method] = handler
  }

  // Feed every incoming cdp payload here.
  function receive(payload) {
    var msg
    try {
      msg = JSON.parse(payload)
    } catch {
      return
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      var resolve = pending.get(msg.id)
      pending.delete(msg.id)
      resolve(msg.error ? { error: msg.error } : msg.result || {})
    } else if (msg.method && eventHandlers[msg.method]) {
      eventHandlers[msg.method](msg.params || {})
    }
  }

  // The iframe reloaded: its chobitsu instance (and every objectId) is gone.
  // Commands still in flight can never be answered — fail them.
  function reset() {
    pending.forEach(function (resolve) {
      resolve({ error: { message: 'target reloaded' } })
    })
    pending.clear()
  }

  // ---- RemoteObject -> display value ----------------------------------

  var ctorCache = {}
  function namedObject(name) {
    if (!name || name === 'Object' || !/^[A-Za-z_$][\w$]*$/.test(name)) {
      return {}
    }
    var Ctor = ctorCache[name]
    if (!Ctor) {
      try {
        Ctor = ctorCache[name] = new Function('return function ' + name + '() {}')()
      } catch {
        return {}
      }
    }
    return Object.create(Ctor.prototype)
  }

  function fnShell(description, name) {
    var fn = function () {}
    try {
      Object.defineProperty(fn, 'name', { value: name || '' })
    } catch {
      /* ignore */
    }
    fn.toString = function () {
      return description || 'function () {}'
    }
    return fn
  }

  function errorFromDescription(description) {
    var desc = description || 'Error'
    var firstLine = desc.split('\n')[0]
    var colon = firstLine.indexOf(':')
    var name = colon > -1 ? firstLine.slice(0, colon) : 'Error'
    var message = colon > -1 ? firstLine.slice(colon + 1).trim() : firstLine
    var ErrCtor = window[name]
    var err
    try {
      err = new (typeof ErrCtor === 'function' ? ErrCtor : Error)(message)
    } catch {
      err = new Error(message)
    }
    try {
      err.name = name
      err.stack = desc
    } catch {
      /* ignore */
    }
    return err
  }

  async function getOwnProperties(objectId) {
    var res = await send('Runtime.getProperties', {
      objectId: objectId,
      ownProperties: true,
    })
    return res.error ? null : res
  }

  async function materializeEntries(ro, depth) {
    // chobitsu exposes Map/Set contents as an internal [[Entries]] array of
    // {key, value} wrappers (Map) / {value} wrappers (Set). Walk that
    // plumbing manually so it doesn't eat into the depth budget — only the
    // actual keys/values recurse.
    var props = await getOwnProperties(ro.objectId)
    var internal =
      props &&
      (props.internalProperties || []).filter(function (p) {
        return p.name === '[[Entries]]' && p.value && p.value.objectId
      })[0]
    if (!internal) return ro.description
    var arrProps = await getOwnProperties(internal.value.objectId)
    if (!arrProps) return ro.description
    var entryROs = (arrProps.result || []).filter(function (p) {
      return p.enumerable && p.value && p.value.objectId
    })
    try {
      var out = ro.subtype === 'map' ? new Map() : new Set()
      for (var i = 0; i < entryROs.length && i < MAX_PROPS; i++) {
        var entryProps = await getOwnProperties(entryROs[i].value.objectId)
        if (!entryProps) continue
        var key, value
        var fields = entryProps.result || []
        for (var j = 0; j < fields.length; j++) {
          // chobitsu stores the entry key under "name".
          if (fields[j].name === 'name' || fields[j].name === 'key') {
            key = await materialize(fields[j].value, depth)
          }
          if (fields[j].name === 'value') {
            value = await materialize(fields[j].value, depth)
          }
        }
        if (ro.subtype === 'map') out.set(key, value)
        else out.add(value)
      }
      return out
    } catch {
      return ro.description
    }
  }

  async function materialize(ro, depth) {
    if (depth === undefined) depth = MAX_DEPTH
    if (!ro || ro.type === 'undefined') return undefined
    if (ro.subtype === 'null') return null
    if (ro.type === 'string' || ro.type === 'boolean') return ro.value
    if (ro.type === 'number') {
      // NaN/Infinity/-0 don't survive JSON: recover them from description.
      if (typeof ro.value !== 'number' || ro.description === '-0') {
        return Number(ro.description)
      }
      return ro.value
    }
    if (ro.type === 'bigint') {
      try {
        return BigInt((ro.description || ro.unserializableValue || '0').replace(/n$/, ''))
      } catch {
        return ro.description
      }
    }
    if (ro.type === 'symbol') return ro.description
    if (ro.type === 'function') return fnShell(ro.description, ro.className)
    if (ro.subtype === 'error') return errorFromDescription(ro.description)
    if (ro.subtype === 'date') {
      var date = new Date(ro.description)
      if (!isNaN(date.getTime())) return date
      return ro.description
    }
    if (ro.subtype === 'regexp') {
      var match = /^\/([\s\S]*)\/(\w*)$/.exec(ro.description || '')
      if (match) {
        try {
          return new RegExp(match[1], match[2])
        } catch {
          /* fall through */
        }
      }
      return ro.description
    }
    if (ro.subtype === 'node') {
      if (ro.objectId) {
        if (nodeResolver) {
          var stash = await send('Runtime.callFunctionOn', {
            objectId: ro.objectId,
            functionDeclaration:
              'function () { window.__PG_INSPECTED_NODE__ = this }',
          })
          if (!stash.error) {
            var liveNode = nodeResolver()
            if (liveNode) return liveNode
          }
        }
        // Fallback: the markup as text. description alone is just the
        // constructor name (e.g. HTMLHeadingElement).
        var nodeRes = await send('Runtime.callFunctionOn', {
          objectId: ro.objectId,
          functionDeclaration:
            'function () { return this.outerHTML || this.nodeValue || ("" + this) }',
        })
        var html = nodeRes.result && nodeRes.result.value
        if (typeof html === 'string') {
          return html.length > 2000 ? html.slice(0, 2000) + '…' : html
        }
      }
      return ro.description
    }

    if (ro.type === 'object' && ro.objectId) {
      if (depth <= 0) return ro.description || '[Object]'
      if (ro.subtype === 'map' || ro.subtype === 'set') {
        return materializeEntries(ro, depth - 1)
      }
      var props = await getOwnProperties(ro.objectId)
      if (!props) return ro.description || '[Object]'
      var result = props.result || []
      var target = ro.subtype === 'array' ? [] : namedObject(ro.className)
      var count = 0
      for (var i = 0; i < result.length; i++) {
        var prop = result[i]
        if (!prop.enumerable || !prop.value) continue
        if (count++ >= MAX_PROPS) {
          target['…'] = 'truncated'
          break
        }
        target[prop.name] = await materialize(prop.value, depth - 1)
      }
      return target
    }

    return ro.description !== undefined ? ro.description : ro.value
  }

  function materializeAll(remoteObjects, depth) {
    return Promise.all(
      (remoteObjects || []).map(function (ro) {
        return materialize(ro, depth)
      })
    )
  }

  return {
    connect: connect,
    setNodeResolver: setNodeResolver,
    send: send,
    on: on,
    receive: receive,
    reset: reset,
    materialize: materialize,
    materializeAll: materializeAll,
  }
})()
