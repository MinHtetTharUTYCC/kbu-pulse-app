export function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

export function formatCategory(str) {
  if (!str) return "";
  return str.split('_').map(capitalize).join(' ');
}