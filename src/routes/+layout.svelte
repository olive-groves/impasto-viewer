<script lang="ts">
  import '$lib/maplibre-gl.css'
  import '$lib/css/index.css'

  // import { base } from "$app/paths";
  let { children } = $props()
</script>

<nav class="unselectable">
  <h1>Impasto Viewer</h1>
  <a href="/" target="_blank">Latest (v0.9.1-alpha)</a>
  <a style:margin-inline-start=auto href="/v/0.7" target="_blank">Previous (v0.7.0)</a>
  <a href="/almond-blossom" target="_blank">Harm Belt's <cite>Almond Blossom</cite></a>
</nav>

<style>
  nav {
    font-size: 1rem;
    display: flex;
    align-items: first baseline;
    gap: calc(2 * var(--gap));
    padding: 0 var(--gap);
    button {
      padding: 0 var(--gap);
      border: 1px solid color-mix(in srgb, currentColor, transparent 75%);
    }
    * {
      font-size: 1rem;
    }
  }
</style>

{@render children()}
