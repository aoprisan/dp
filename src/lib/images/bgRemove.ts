/** On-device background removal, lazy-loaded (WASM is heavy — §1). */
export async function removeBg(blob: Blob): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal');
  return removeBackground(blob, { output: { format: 'image/png', quality: 0.9 } });
}
