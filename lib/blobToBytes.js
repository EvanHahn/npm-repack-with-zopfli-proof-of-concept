export default function blobToBytes(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error("Could not read file"));
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(blob);
  });
}
