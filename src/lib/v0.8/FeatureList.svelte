<!-- Given an array of GeoJSON features per Annotation schema, generate an overview list -->
<script lang="ts">
  import type {
    GeoJSONStoreFeatures,
    GeoJSONStoreGeometries,
  } from 'terra-draw';
  import { TAG_CHROMA_HUE, TAG_MAP } from './feature-utils.svelte';
  import { getFriendlyLocalDateTime } from './utils-ui';

  type FeatureId = string | number;

  let {
    features = [],
    selectedFeature,
    visibilities = {symbol: true, phenomenon: true, tags: true, "created-by": true, comment: true, edit: true},
    onFeatureHoverStart,  // A feature was hovered in the list
    onFeatureHoverEnd,  // A feature was no longer hovered in the list
    onFeatureClick,  // A feature was clicked in the list
    onFeatureDoubleClick,  // A feature was double-clicked in the list
    onFeatureEdit,  // A feature's "edit me" button was clicked in the list
  }: {
    features: GeoJSONStoreFeatures<GeoJSONStoreGeometries>[];
    selectedFeature?: FeatureId | null;
    visibilities: {symbol: boolean, phenomenon: boolean, tags: boolean, "created-by": boolean, comment: boolean, edit: boolean},
    onFeatureHoverStart?: (featureId: FeatureId) => void;
    onFeatureHoverEnd?: (featureId: FeatureId) => void;
    onFeatureClick?: (featureId: FeatureId) => void;
    onFeatureDoubleClick?: (featureId: FeatureId) => void;
    onFeatureEdit?: (featureId: FeatureId) => void;
  } = $props();
</script>

<div class="features unselectable">

  {#each features as feature (feature.id)}
    {@const featureId = feature.id ?? "undefined-feature-id"}
    {@const properties = feature.properties}
    <!-- FIXME: Accessibility -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class={["feature", {selected: featureId === selectedFeature}]}
      // TODO: Is this a sure-fire ID'ing approach for these list items?
      // If features without ids > 1, then we have duplicate id's.
      id={`feature-${featureId}`}
      role="application"
      onpointerenter={() => onFeatureHoverStart?.(featureId)}
      onpointerleave={() => onFeatureHoverEnd?.(featureId)}
      onclick={() => onFeatureClick?.(featureId)}
      ondblclick={() => onFeatureDoubleClick?.(featureId)}
    >
      <div class="markers">
        {#if visibilities.symbol}
          <div class="symbol">
            <span class={["material-symbols-sharp"]}>
              {feature.geometry.type === "LineString" ? "timeline" : feature.geometry.type === "Polygon" ? "pentagon" : feature.geometry.type === "Point" ? "south_west" : ""}
            </span>
          </div>
        {/if}
      </div>
      <div class="details">
        {#if visibilities.phenomenon}
          <div class="phenomenon">
            <span class={{unfilled: !properties.phenomenon}}>
              {properties.phenomenon || "uncategorized"}
            </span>
          </div>
        {/if}
        {#if visibilities.tags && properties?.tags?.length}
          <div class="tags">
            {#each properties?.tags as tag (tag)}
              <div title={TAG_MAP.get(tag)?.description} class="tag" style:--chroma={TAG_CHROMA_HUE.get(tag)?.chroma} style:--hue={TAG_CHROMA_HUE.get(tag)?.hue}>
                {tag}
              </div>
            {/each}
          </div>
        {/if}
        {#if visibilities["created-by"]}
          <div class="authorship">
            <div class={["author", {unknown: !properties?.["created-by"]}]}>
              {properties?.["created-by"] || "Unknown author"}
            </div>
            <time datetime={properties?.created} title={properties?.created}>{getFriendlyLocalDateTime(properties?.created)}</time>
          </div>
        {/if}
        {#if visibilities.comment && properties?.comment?.text}
          <div class="comment">
            <p>{properties?.comment.text}</p>
          </div>
        {/if}
      </div>
      <div class="actions">
        {#if visibilities.edit}
          <div class="edit">
            <button onclick={(e) => {onFeatureEdit?.(featureId); e.stopPropagation();} }>
              Edit
            </button>
          </div>
        {/if}
      </div>
    </div>
  {/each}

</div>

<style>
  .features {
    display: flex;
    flex-direction: column;
    overflow: auto;
    background-color: color-mix(in srgb, Canvas, transparent 5%);
    > * {
      border: 1px solid transparent;
      border-top-color: color-mix(in oklab, currentColor, transparent 75%);
      &:last-child {
        border-bottom-color: color-mix(in oklab, currentColor, transparent 75%);
      }
      &:hover {
        border: 1px solid color-mix(in oklab, currentColor, transparent 50%);
      }
      &.selected {
        border: 1px solid;
      }
    }

    .feature {
      display: grid;
      grid-template-areas:
        "markers details actions";
      grid-template-rows: 1fr;
      grid-template-columns: 0fr 1fr 0fr;
      gap: calc(0.5 * var(--gap));
      padding: var(--gap);
      padding-left: calc(var(--gap) / 2);
    }
  }
  .markers {
    grid-area: markers;
    display: flex;
    flex-direction: column;
  }
  .symbol {
    color: color-mix(in oklab, currentColor, transparent 25%);
    line-height: 1em;
  }
  .details {
    grid-area: details;
    display: flex;
    flex-direction: column;
    min-width: 0;
    & > *:not(:first-child) {
      padding-block-start: var(--gap);
    }
  }
  .phenomenon {
    min-width: 0;
    font-weight: 500;
    font-size: 1.2rem;
    line-height: 1em;
  }
  .tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap);
    .tag {
      white-space: nowrap;
      --color: oklch(from CanvasText var(--lightness, 0.7) var(--chroma, 0.2) var(--hue, h));
      font-size: 0.9rem;
      border: 1px solid var(--color);
      border-radius: var(--gap);
      color: color-mix(in oklab, var(--color), CanvasText 80%);
      background: color-mix(in oklab, var(--color), Canvas 85%);
      padding-inline: var(--gap);
    }
  }
  .authorship {
    display: flex;
    font-size: 0.85rem;
    color: color-mix(in srgb, CanvasText, Canvas 40%);
    gap: calc(2 * var(--gap));
    margin-top: -0.1lh;
    margin-bottom: -0.3lh;
    &:last-child {
      margin-bottom: unset;
    }
  }
  time {
    font-size: 0.85rem;
    color: color-mix(in srgb, CanvasText, Canvas 40%);
  }

  .comment {
    p {
      line-height: 0.85lh;
      color: color-mix(in srgb, CanvasText, Canvas 10%);
    }
  }
  .actions {
    grid-area: actions;
    display: flex;
    flex-direction: column;
  }
  .edit {
    align-self: start;
    font-size: 0.85rem;
    color: color-mix(in oklab, currentColor, transparent 20%);
    margin-inline-start: auto;
    button {
      padding: 0 var(--gap);
    }
  }
  .phenomenon::first-letter {
    text-transform: capitalize;
  }
  .unfilled {
    color: color-mix(in srgb, CanvasText, Canvas 50%);
  }
</style>
