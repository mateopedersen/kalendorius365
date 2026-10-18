export function normalizeToolSearchText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("lt-LT")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function filterToolInventory(items, { query = "", category = "all" } = {}) {
  const terms = normalizeToolSearchText(query).split(/\s+/).filter(Boolean);
  return items.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    const searchable = normalizeToolSearchText(item.search);
    return terms.every((term) => searchable.includes(term));
  });
}
