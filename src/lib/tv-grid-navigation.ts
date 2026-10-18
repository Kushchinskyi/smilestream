export function tvGridTarget(index: number, count: number, key: string, columns = 3) {
  if (!count || index < 0) return 0;
  const row = Math.floor(index / columns);
  const column = index % columns;
  if (key === "ArrowLeft") return column > 0 ? index - 1 : index;
  if (key === "ArrowRight") return Math.min(index + 1, row * columns + columns - 1, count - 1);
  if (key === "ArrowUp") return row > 0 ? index - columns : index;
  if (key === "ArrowDown") {
    return (row + 1) * columns < count ? Math.min(index + columns, count - 1) : index;
  }
  return index;
}
