// Holds the document/window eruda's UI is mounted into. When eruda runs
// inside an iframe but renders its UI into the host page (playground mode),
// this differs from the bundle realm's globals.
let uiDoc = document

export function setUiRoot(el) {
  uiDoc = (el && el.ownerDocument) || document
}

export function getUiDoc() {
  return uiDoc
}

export function getUiWin() {
  return uiDoc.defaultView || window
}
