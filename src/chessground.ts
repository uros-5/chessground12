import { type Api, start } from './api.js';
import { type Config, configure } from './config.js';
import { type HeadlessState, type State, defaults } from './state.js';

import { renderWrap } from './wrap.js';
import { render, renderResized, updateBounds } from './render.js';
import { renderPockets, renderPocketsInitial } from './pocket.js';
import { bindBoard, bindDocument } from './events.js';
import { renderSvg } from './svg.js';
import { memo } from './util.js';

export function Chessground(
  element: HTMLElement,
  config?: Config,
  _height?: number,
  pocketTop?: HTMLElement,
  pocketBottom?: HTMLElement,
): Api {
  const maybeState: State | HeadlessState = defaults();
  configure(maybeState, config || {});

  function redrawAll(): State {
    const prevUnbind = 'dom' in maybeState ? maybeState.dom.unbind : undefined;
    // compute bounds from existing board element if possible
    // this allows non-square boards from CSS to be handled (for 3D)
    const elements = renderWrap(element, maybeState),
      bounds = memo(() => elements.board.getBoundingClientRect()),
      redrawNow = (skipSvg?: boolean): void => {
        render(state);
        renderPockets(state);
        if (!skipSvg && elements.svg) renderSvg(state, elements.svg, elements.customSvg!);
      },
      onResize = (): void => {
        updateBounds(state);
        renderResized(state);
      };
    if (elements.pocketTop) pocketTop = elements.pocketTop;
    if (elements.pocketBottom) pocketBottom = elements.pocketBottom;
    renderPocketsInitial(maybeState, elements, pocketTop, pocketBottom);
    const state = maybeState as State;
    state.dom = {
      elements,
      bounds,
      redraw: debounceRedraw(redrawNow),
      redrawNow,
      unbind: prevUnbind,
    };
    state.drawable.prevSvgHash = '';
    updateBounds(state);
    redrawNow(false);
    bindBoard(state, onResize);
    if (!prevUnbind) state.dom.unbind = bindDocument(state, onResize);
    state.events.insert && state.events.insert(elements);
    return state;
  }

  return start(redrawAll(), redrawAll);
}

function debounceRedraw(redrawNow: (skipSvg?: boolean) => void): () => void {
  let redrawing = false;
  return () => {
    if (redrawing) return;
    redrawing = true;
    requestAnimationFrame(() => {
      redrawNow();
      redrawing = false;
    });
  };
}
