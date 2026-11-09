import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import VocabScreenGuide from './VocabScreenGuide';

test('opens the current screen guide, restores focus on close and updates with the screen', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const button = () => document.querySelector('button[aria-label="Help for this screen"]');

  try {
    act(() => root.render(<VocabScreenGuide screen="landing" />));
    const dialog = document.querySelector('dialog.screen-guide-panel');
    dialog.showModal = jest.fn();
    expect(dialog.querySelector('h2').textContent).toBe('Start with VocabVoyager');
    act(() => button().click());
    expect(dialog.showModal).toHaveBeenCalledTimes(1);
    act(() => dialog.dispatchEvent(new Event('close')));
    expect(document.activeElement).toBe(button());

    act(() => root.render(<VocabScreenGuide screen="review" />));
    expect(document.querySelector('dialog h2').textContent).toBe('Review your words');
    act(() => root.render(<VocabScreenGuide screen="privacy" />));
    expect(button()).toBeNull();
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
