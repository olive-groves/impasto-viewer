<script lang="ts">
  import type {
    GeoJSONStoreFeatures,
    GeoJSONStoreGeometries,
  } from 'terra-draw';
  import AutogrowTextArea from './AutogrowTextArea.svelte';
  import ClickToRevealButton from './ClickToRevealButton.svelte';
  import { PROCESSES_AND_TECHNIQUES_AS_EFFECT, TAG_MAP, TAG_CHROMA_HUE } from './feature-utils.svelte';
  import { getFriendlyLocalDateTime } from './utils-ui';

  // TODO: Add tab capture; see Svelte tutorial example

  let {
    mode = "selected",
    properties = $bindable(),
    geometry,
    onEditClick,
    onZoomToFitClick,
    onSelectedCloseClick,
    onDoneClick,
    onDrawAnotherClick,
    onDeleteClick,
    onCaptureView,
    onEditingCloseClick,
  }: {
    mode: "selected" | "editing";
    properties?: GeoJSONStoreFeatures<GeoJSONStoreGeometries>["properties"];
    geometry?: GeoJSONStoreFeatures<GeoJSONStoreGeometries>["geometry"];
    onEditClick?: () => void;
    onZoomToFitClick?: () => void;
    onSelectedCloseClick?: () => void;
    onDoneClick?: () => void;
    onDrawAnotherClick?: () => void;
    onDeleteClick?: () => void;
    onCaptureView?: () => void;
    onEditingCloseClick?: () => void;
  } = $props();

</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class={["panel", mode]}
  // Prevent pointer-up propagating; for example, when quickly highlighting text with
  // click and drag, but the mouse release occurs outside the panel.
  onpointerdown={(e: PointerEvent) => (e.target as HTMLElement)?.setPointerCapture(e.pointerId)}
>

  {#if mode === "selected"}

    <div class="titlebar">
      <div class="phenomenon">
        <span class={{unfilled: !properties.phenomenon}}>
          {properties.phenomenon || "uncategorized"}
        </span>
      </div>
      <div style:margin-inline-start=auto>
        <button onclick={() => onZoomToFitClick?.()}>
          Zoom to fit
        </button>
        <button onclick={() => onSelectedCloseClick?.()}>
          ×
        </button>
      </div>
    </div>
    <div class="content">
      <div class="tags">
        {#each properties?.tags as tag}
          <div class="tag" style:--chroma={TAG_CHROMA_HUE.get(tag)?.chroma} style:--hue={TAG_CHROMA_HUE.get(tag)?.hue}>
            <div>
              {tag}
            </div>
          </div>
        {:else}
          <div class="unfilled">
            Untagged
          </div>
        {/each}
      </div>

      <div class="comment">
        <div class="authorship">
          <div class={["author", {unknown: !properties?.["created-by"]}]}>
            {properties?.["created-by"] || "Unknown author"}
          </div>
          <time datetime={properties?.created} title={properties?.created}>{getFriendlyLocalDateTime(properties?.created)}</time>
        </div>
        {#if properties?.comment?.text}
          <p>{properties?.comment.text}</p>
        {/if}
      </div>
      {#if properties?.comment?.comments.length}
        <div class="replies">
          {#each properties?.comment?.comments as reply, i (i)}
            {#if reply?.text}
              <div class="reply">
                <div class="authorship">
                  <div class={["author", {unknown: !properties?.["created-by"]}]}>
                    {reply?.["created-by"] ?? "Unknown author"}
                  </div>
                  <time datetime={reply?.created} title={reply?.created}>{getFriendlyLocalDateTime(reply?.created)}</time>
                </div>
                <p>{reply.text}</p>
              </div>
            {/if}
          {/each}
        </div>
      {/if}
    </div>
    <div class="actionbar">
      <button onclick={() => onEditClick?.()}>
        Edit
      </button>
    </div>

  {:else if mode === "editing"}

    <div class="titlebar">
      <label class="phenomenon">
        <div class="unselectable">Phenomenon</div>
        <select bind:value={properties.phenomenon}>
          <option value="">Select a phenomenon</option>
          {#each Object.values(PROCESSES_AND_TECHNIQUES_AS_EFFECT) as supervalue (supervalue)}
            {#each Object.entries(supervalue) as [key, value] (key)}
              {#if typeof value === "string"}
                <option value={key.toLowerCase()} title={value}>
                  {key}
                </option>
              {:else}
                <optgroup label={key}>
                  {#each Object.entries(value) as [key, subvalue] (key)}
                    {#if typeof subvalue === "string"}
                      <option value={key.toLowerCase()} title={subvalue}>
                        {key}
                      </option>
                    {/if}
                  {/each}
                </optgroup>
              {/if}
            {/each}
          {/each}
        </select>
      </label>
      <div style:margin-inline-start=auto>
        <button onclick={() => onCaptureView?.()}>
          Capture view
        </button>
        <button onclick={() => onEditingCloseClick?.()}>
          ×
        </button>
      </div>
    </div>
    <div class="content">
      <div class="tag-field">
        <div class="field-heading unselectable">
          Tags
        </div>
        <div class="tags">
          {#each properties?.tags as tag, i}
            <div class="tag" style:--chroma={TAG_CHROMA_HUE.get(tag)?.chroma} style:--hue={TAG_CHROMA_HUE.get(tag)?.hue}>
              <div>
                {tag}
              </div>
              <button onclick={() => properties?.tags.splice(i, 1)}>
                ×
              </button>
            </div>
          {/each}
          <ClickToRevealButton>
            {#snippet button(reveal)}
              <button onclick={() => reveal()}>
                + Tag
              </button>
            {/snippet}

            <select onchange={(e) => {
              const value = e.target?.value;
              if (value === undefined || value === "")
                return;
              if (properties?.tags?.includes(value))
                return;
              properties?.tags?.push(e.target.value);
              e.target.value = "";
            }}
            >
              <option value="">Select a tag</option>
              {#each [...TAG_MAP.keys()].filter((t) => !properties?.tags?.includes(t)) as tag}
                <option value={tag}>{tag}</option>
              {/each}
            </select>

          </ClickToRevealButton>
        </div>
      </div>
      <div class="comment">
        <ClickToRevealButton initiallyRevealed={properties?.comment?.text}>
          {#snippet button(reveal)}
            <button onclick={() => reveal()}>
              + Comment
            </button>
          {/snippet}

          <label>
            <div class="unselectable">Comment</div>
            <AutogrowTextArea
              placeholder="Start a comment"
              bind:value={properties.comment.text}
              rows={2}
            />
          </label>

        </ClickToRevealButton>
      </div>
      {#if properties?.comment?.text || properties?.comment?.comments.length}
        <div class="replies">
          <div class="unselectable field-heading">Replies</div>
          {#each properties?.comment?.comments as reply, i (i)}
            <AutogrowTextArea
              placeholder="Start a reply"
              bind:value={reply.text}
              rows={1}
            />
          {/each}
          {#if (properties?.comment?.comments?.length < 1 || properties?.comment?.comments.at(-1).text)}
            <div>
              <button onclick={() => properties?.comment?.comments?.push({created: new Date().toISOString()})}>+ Reply</button>
            </div>
          {/if}
        </div>
      {/if}
    </div>
    <div class="actionbar">
      <button class="primary" onclick={() => onDoneClick?.()}>
        Done
      </button>
      <button onclick={() => onDrawAnotherClick?.()}>
        Done & Draw Another
      </button>
      <button class="severe" onclick={() => onDeleteClick?.()}>
        Delete
      </button>
    </div>

  {/if}

</div>

<style>
  .panel {
    display: flex;
    flex-direction: column;
    gap: var(--gap);
    background: color-mix(in srgb, Canvas, CanvasText 8%);
    padding: var(--gap);
    border: 1px solid color-mix(in srgb, CanvasText, Canvas 80%);
    border-radius: var(--gap);
    overflow-x: auto;

    button {
      text-transform: capitalize;
      padding: 0 calc(2 * var(--gap));
      &.primary {
        color: Canvas;
        background: CanvasText;
        &:hover {
          background: color-mix(in srgb, CanvasText, Canvas 10%);
        }
      }

      &.severe {
        color: CanvasText;
        background-color: Canvas;
        &:hover {
          border-color: color-mix(in oklab, CanvasText, red 90%);
          background: color-mix(in oklab, Canvas, red 25%);
        }
      }
    }
    .phenomenon {
      span,
      select {
        font-size: 1.35rem;
      }
    }
    .phenomenon::first-letter {
      text-transform: capitalize;
    }
    .unfilled {
      color: color-mix(in srgb, CanvasText, Canvas 30%);
    }
    .authorship {
      display: flex;
      font-size: 0.85rem;
      color: color-mix(in srgb, CanvasText, Canvas 40%);
      gap: calc(2 * var(--gap));
    }
    time {
      font-size: 0.85rem;
      color: color-mix(in srgb, CanvasText, Canvas 40%);
    }

    .titlebar {
      display: flex;
    }
    .actionbar {
      display: flex;
      flex-wrap: wrap;
      padding-top: calc(2 * var(--gap));
      gap: var(--gap);
    }
    .comment,
    .reply {
      p {
        line-height: 0.85lh;
        color: color-mix(in srgb, CanvasText, Canvas 10%);
      }
    }
    .replies {
      padding: calc(2 * var(--gap)) 0;
      display: flex;
      flex-direction: column;
      gap: calc(2 * var(--gap));
      margin-inline-start: 1em;
    }
    .reply {
      display: flex;
      flex-direction: column;
    }
    label > div,
    .field-heading {
      font-size: 0.85rem;
      color: color-mix(in srgb, CanvasText, Canvas 25%);
    }
    .content {
      display: flex;
      flex-direction: column;
      gap: var(--gap);
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: calc(var(--gap));
      .tag {
        align-items: first baseline;

        --color: oklch(from CanvasText var(--lightness, 0.7) var(--chroma, 0.2) var(--hue, h));
        display: flex;
        font-size: 0.9rem;
        border: 1px solid var(--color);
        border-radius: var(--gap);
        color: color-mix(in oklab, var(--color), CanvasText 80%);
        background: color-mix(in oklab, var(--color), Canvas 85%);
        padding-inline: var(--gap);
        button {
          background: transparent;
          padding: 0 var(--gap);
        }
      }
    }
    &.editing {
      border: 1px solid color-mix(in srgb, CanvasText, Canvas 0%);
      .tag {
        font-size: inherit;
        padding-inline: 0;
        padding-inline-start: var(--gap);
      }
    }
  }
  .author.unknown {
    font-style: italic;
    color: #ff8000;
  }

</style>
