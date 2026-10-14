// @vitest-environment jsdom
// The crop dialog must show the photo even under React StrictMode (which the app uses):
// its double mount used to revoke the photo's object URL before the cropper could load it.
import '@testing-library/jest-dom/vitest';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ImageCropModal } from '../src/components/admin/ImageCropModal';

let live: Set<string>;
let counter: number;

// jsdom has no object URLs — stand-ins that track which URLs are still valid
const realCreate = URL.createObjectURL, realRevoke = URL.revokeObjectURL;
beforeEach(() => {
  live = new Set(); counter = 0;
  URL.createObjectURL = () => { const u = `blob:test/${++counter}`; live.add(u); return u; };
  URL.revokeObjectURL = (u: string) => { live.delete(u); };
});
afterEach(() => { cleanup(); URL.createObjectURL = realCreate; URL.revokeObjectURL = realRevoke; });

const photo = new File([new Uint8Array([1, 2, 3])], 'cactus.jpg', { type: 'image/jpeg' });
const renderModal = () => render(
  <StrictMode>
    <ImageCropModal file={photo} onApply={vi.fn()} onUseOriginal={vi.fn()} onDiscard={vi.fn()} />
  </StrictMode>,
);

describe('ImageCropModal', () => {
  it('gives the cropper a photo URL that is still valid under StrictMode', () => {
    const { container } = renderModal();
    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(live.has(img!.getAttribute('src')!)).toBe(true);
  });

  it('crops to a fixed 4:3 frame with no shape choices', () => {
    const { queryByText, queryByRole } = renderModal();
    for (const label of ['Original', 'Square', 'Portrait']) expect(queryByText(label)).not.toBeInTheDocument();
    expect(queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('releases the photo URL when closed', () => {
    const { unmount } = renderModal();
    unmount();
    expect(live.size).toBe(0);
  });
});
