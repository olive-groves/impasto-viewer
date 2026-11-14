<script>
    import { Plot, LineY, Line } from 'svelteplot';
    let datay = [4, 4, 4.5, null, 5, 8.5, 9];
    let data = [
      [1, 20],
      [2, 50],
      [3, null],
      [4, 40],
      [5, 30],
      [6, 60],
    ]
</script>

<Plot
  x={{
    interval: 1,
  }}
  y={{
    grid: true,
  }}
>
    <!-- <LineY {datay} /> -->
     <Line {data} x={(d) => d[0]} y={(d) => d[1]} />
</Plot>
