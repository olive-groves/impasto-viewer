<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    enabled = $bindable(true),
    preferInner = $bindable(true),
    ondragenter,
    ondragleave,
    ondragover,
    ondrop,
    ondragenterInner,
    ondragleaveInner,
    ondragoverInner,
    ondropInner,
    ondragenterOuter,
    ondragleaveOuter,
    ondragoverOuter,
    ondropOuter,
    draggingChanged,
    draggingInnerChanged,
    draggingOuterChanged,
    children,
  }: {
    enabled?: boolean;
    preferInner?: boolean;
    ondragenter?: (event: DragEvent) => void;
    ondragleave?: (event: DragEvent) => void;
    ondragover?: (event: DragEvent) => void;
    ondrop?: (event: DragEvent) => void;
    ondragenterInner?: (event: DragEvent) => void;
    ondragleaveInner?: (event: DragEvent) => void;
    ondragoverInner?: (event: DragEvent) => void;
    ondropInner?: (event: DragEvent) => void;
    ondragenterOuter?: (event: DragEvent) => void;
    ondragleaveOuter?: (event: DragEvent) => void;
    ondragoverOuter?: (event: DragEvent) => void;
    ondropOuter?: (event: DragEvent) => void;
    draggingChanged?: (dragging: boolean, draggingInner: boolean) => void;
    draggingInnerChanged?: (dragging: boolean) => void;
    draggingOuterChanged?: (dragging: boolean) => void;
    children?: Snippet;
  } = $props();

	function handleDragenter(e: DragEvent) {
    if (draggingOuter) ondragenterOuter?.(e);
    ondragenter?.(e);
	}
	function handleDragleave(e: DragEvent) {
    if (draggingOuter) ondragleaveOuter?.(e);
    ondragleave?.(e);
	}
	function handleDragover(e: DragEvent) {
    if (draggingOuter) ondragoverOuter?.(e);
    ondragover?.(e);
	}
	function handleDrop(e: DragEvent) {
    if (draggingOuter) ondropOuter?.(e);
    ondrop?.(e);
	}
  let drags = $state(0);
  let innerDrags = $state(0);
  let dragging = $derived(drags > 0);
  let draggingInner = $derived(innerDrags > 0);
  let draggingOuter = $derived(dragging && !draggingInner);
  $effect(() => {
    draggingChanged?.(dragging, draggingInner);
  })
  $effect(() => {
    draggingInnerChanged?.(draggingInner);
  })
  $effect(() => {
    draggingOuterChanged?.(draggingOuter);
  })
</script>

<div
  // WARNING: Children removed during ondrag- do not consistently propagate ondrag-.
  // Recommend hiding, not removing (if'ing) children that appear/disappear during drag.
  class={["dropzone", {dragging, draggingInner, draggingOuter, enabled, preferOuter: !preferInner}]}
  // Do not allow drags to exceed 2: Patch for adding/removing child flex elements.
  ondragenter={(e) => {if (drags < 2) drags += 1; handleDragenter(e);}}
  ondragleave={(e) => {drags -= 1; handleDragleave(e);}}
  ondragover={handleDragover}
  ondrop={(e) => {handleDrop(e); drags = 0;}}
  role=region
  aria-dropeffect=link
>
  <div
    class=inner
    ondragenter={(e) => {if (innerDrags < 2) innerDrags += 1; ondragenterInner?.(e);}}
    ondragleave={(e) => {innerDrags -= 1; ondragleaveInner?.(e);}}
    ondragover={(e) => ondragoverInner?.(e)}
    ondrop={(e) => {ondropInner?.(e); innerDrags = 0; drags = 0;}}
    role=region
    aria-dropeffect=link
  >
    {@render children?.()}
  </div>
</div>


<style>
	.dropzone {
    --sc-2-5-5: 44px;
    display: flex;
    flex: 1 1;
    > .inner {
      gap: var(--inner-gap);
      display: flex;
      flex-direction: var(--flex-direction);
      flex: 1 1;
      transition: margin 100ms ease-out;
    }
    &.dragging.enabled {
      > .inner {
        --_dragging-margin: var(--dragging-margin, calc(1 * var(--sc-2-5-5)));
        --margin-left-right: min(var(--_dragging-margin), calc(0.5 * 50cqw));
        --margin-top-bottom: min(var(--_dragging-margin), calc(0.5 * 50cqh));
        margin: var(--margin-top-bottom) var(--margin-left-right);
      }
      &.preferOuter > .inner {
        --_dragging-margin: var(--dragging-margin, calc(5 * var(--sc-2-5-5)));
        --margin-left-right: max(calc(50cqw - var(--_dragging-margin)), calc(0.5 * 50cqw));
        --margin-top-bottom: max(calc(50cqh - var(--_dragging-margin)), calc(0.5 * 50cqh));
        margin: var(--margin-top-bottom) var(--margin-left-right);
      }
    }
    &.draggingInner.enabled {
      > .inner {
        /* outline: 1px solid oklch(1 0 0 / 50%); */
        outline-offset: -1px;
        box-shadow: 0 0 0 1px oklch(0 0 0 / 50%);
      }
    }
    &.draggingOuter.enabled {
      /* outline: 1px solid oklch(1 0 0 / 50%); */
      outline-offset: -1px;
      box-shadow: 0 0 0 1px oklch(0 0 0 / 50%);
    }
	}
</style>
