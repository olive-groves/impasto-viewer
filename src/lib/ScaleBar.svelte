<script lang="ts">
  import { ScaleBarDisplay } from "./ScaleBarHelper.svelte";

  let {
    // How long do you want the scale bar to be in pixels, at its longest?
    scaleBarMaxPixels = 140,
    // How do you translate pixels to meters?
    // (If you're telling us how long it should be in pixels, you need to tell us how to determine meters from it.)
    metersPerPixel,
  } = $props();

  // Derived
  let scaleBarMaxLengthMeters = $derived(scaleBarMaxPixels * metersPerPixel);
  const scaleBarDisplay = new ScaleBarDisplay(() => scaleBarMaxLengthMeters)
  let scaleBarLengthPixels = $derived(scaleBarDisplay.length / metersPerPixel)
</script>

<div style:display=flex style:align-items=center>
  {#if !isNaN(scaleBarLengthPixels)}
    <div
      style={`width: ${scaleBarLengthPixels.toFixed(0)}px`}
      style:border-top={`2px solid #fff`}
      style:border-bottom={`2px solid #000`}>
    </div>
    <div
      style:text-align="end">
      <div
        style:color=white
        style:background-color=black
        style:margin-left=4px
        style:padding="0 2px"
        style:line-height=1rem
      >
        {scaleBarDisplay.displayLength.value} {scaleBarDisplay.displayLength.unit.symbol}m
      </div>
    </div>
  {:else}
    <div
      style:color=gray
      style:background-color=black
      style:line-height=1rem
    >
      Scale could not resolve (NaN/undefined)
    </div>
  {/if}
</div>
