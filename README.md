<div align="center">
  <a href="https://eruda.liriliri.io/" target="_blank">
    <img src="https://eruda.liriliri.io/icon.png" width="400">
  </a>
</div>

<h1 align="center">Eruda</h1>

<div align="center">

Console for Mobile Browsers.

[![NPM version][npm-image]][npm-url]
[![Build status][ci-image]][ci-url]
[![Test coverage][codecov-image]][codecov-url]
[![Downloads][jsdelivr-image]][jsdelivr-url]
[![License][license-image]][npm-url]

</div>

[npm-image]: https://img.shields.io/npm/v/eruda?style=flat-square
[npm-url]: https://npmjs.org/package/eruda
[jsdelivr-image]: https://img.shields.io/jsdelivr/npm/hm/eruda?style=flat-square
[jsdelivr-url]: https://www.jsdelivr.com/package/npm/eruda
[ci-image]: https://img.shields.io/github/actions/workflow/status/liriliri/eruda/main.yml?branch=master&style=flat-square
[ci-url]: https://github.com/liriliri/eruda/actions/workflows/main.yml 
[codecov-image]: https://img.shields.io/codecov/c/github/liriliri/eruda?style=flat-square
[codecov-url]: https://codecov.io/github/liriliri/eruda?branch=master
[license-image]: https://img.shields.io/npm/l/eruda?style=flat-square
[donate-image]: https://img.shields.io/badge/$-donate-0070ba.svg?style=flat-square

<img src="https://eruda.liriliri.io/screenshot.jpg" style="width:100%">

## About this fork (eruda-iframe)

This fork wires eruda to an **iframe**: the devtools UI lives in a host page
while everything it inspects — console logs, errors, JS evaluation, the DOM
tree, and network requests — targets the page inside the iframe.

### How it works

eruda's capture layer is realm-bound: `console` overriding, error listeners,
`document` access, and chobitsu's XHR/fetch patching all act on the realm the
bundle runs in. So instead of reaching into the iframe from the parent, the
bundle is loaded **inside the iframe** and its UI is projected into a container
element in the host page (same-origin):

```html
<!-- inside the iframe page, first script in <head> -->
<script src="/assets/eruda.js"></script>
<script>
  eruda.init({
    container: window.parent.document.getElementById('my-devtools-container'),
    inline: true,
    autoScale: false,
  })
</script>
```

All panels then work against the iframe natively — typing
`document.body.style.background = 'tomato'` in the console repaints the
iframe, Elements edits the iframe DOM, and Network captures the iframe's
requests.

### Playground

```bash
npm install
npm run dev
```

Then open http://localhost:8080/playground/index.html — a host page with a
demo app in an iframe, the devtools pane below (toggle it with the toolbar
button; its height follows the Display Size setting), and buttons that
exercise console/network/DOM capture. See `playground/`.

### Fork changes

- `src/lib/uiRealm.js` (new): tracks the host document/window the UI is
  mounted into; `eruda.js`, `evalCss.js`, `DevTools.js` and `EntryBtn.js` use
  it instead of the bundle realm's globals for UI mounting and metrics.
- `DevTools.hide()` works in inline mode, so `eruda.show()/hide()/toggle()`
  can drive an embedded panel (show/hide events let the embedder collapse it).
- `$0`–`$4` are seeded at startup, so evaluating them before selecting a node
  in Elements yields `null` instead of a `ReferenceError`.
- Build migrated from webpack to **rspack** (`build/rspack.*.js`,
  `npm run dev` / `npm run build`; the old webpack configs remain and
  `npm run dev:webpack` still works).

## Demo

![Demo](https://eruda.liriliri.io/qrcode.png)

Browse it on your phone: [eruda.liriliri.io](https://eruda.liriliri.io/)

## Install

You can get it on npm.

```bash
npm install eruda --save-dev
```

Add this script to your page.

```html
<script src="node_modules/eruda/eruda.js"></script>
<script>eruda.init();</script>
```

It's also available on [jsDelivr](http://www.jsdelivr.com/projects/eruda) and [cdnjs](https://cdnjs.com/libraries/eruda).

```html
<script src="https://cdn.jsdelivr.net/npm/eruda"></script>
<script>eruda.init();</script>
```

For more detailed usage instructions, please read the documentation at [eruda.liriliri.io](https://eruda.liriliri.io/docs/)!

## Related Projects

* [eruda-android](https://github.com/liriliri/eruda-android): Simple webview with eruda loaded automatically.
* [chii](https://github.com/liriliri/chii): Remote debugging tool.
* [chobitsu](https://github.com/liriliri/chobitsu): Chrome devtools protocol JavaScript implementation.
* [licia](https://github.com/liriliri/licia): Utility library used by eruda.
* [luna](https://github.com/liriliri/luna): UI components used by eruda.
* [vivy](https://github.com/liriliri/vivy-docs): Icon image generation.

## Third Party

* [eruda-pixel](https://github.com/Faithree/eruda-pixel): UI pixel restoration tool.
* [eruda-webpack-plugin](https://github.com/huruji/eruda-webpack-plugin): Eruda webpack plugin.
* [eruda-vue-devtools](https://github.com/Zippowxk/vue-devtools-plugin): Eruda Vue-devtools plugin.

## Backers

<a rel="noreferrer noopener" href="https://opencollective.com/eruda" target="_blank"><img src="https://opencollective.com/eruda/backers.svg?width=890"></a>

## Contribution

Read [Contributing Guide](https://eruda.liriliri.io/docs/contributing.html) for development setup instructions.
