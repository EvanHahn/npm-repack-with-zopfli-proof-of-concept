export default function crel(tagName, attributes, children) {
  const result = document.createElement(tagName);

  for (const [k, v] of Object.entries(attributes)) {
    result.setAttribute(k, v);
  }

  for (const child of children) {
    if (typeof child === "string") {
      result.appendChild(document.createTextNode(child));
    } else {
      result.appendChild(child);
    }
  }

  return result;
}
