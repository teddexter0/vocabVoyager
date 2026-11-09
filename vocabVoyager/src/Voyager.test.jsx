import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import Voyager, { modeFromLocation } from './Voyager';

jest.mock('./App', () => {
  const React = require('react');
  const ModeDestinations = require('./components/ModeDestinations').default;
  return function Classic({ onPersonal }) {
    return <><ModeDestinations onPersonal={onPersonal}/><h1>Master Vocabulary with AI</h1></>;
  };
});
jest.mock('./components/PersonalVocabulary', () => ({ onClassic }) => <><h1>My Vocabulary</h1><button onClick={onClassic}>Original learning mode</button></>);

let root, host;
beforeEach(() => {
  window.history.replaceState({}, '', '/');
  window.scrollTo = jest.fn();
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

test('the original homepage is the default, including an explicit /home link', () => {
  expect(modeFromLocation({ search: '', hash: '' })).toBe('classic');
  expect(modeFromLocation({ pathname: '/home', search: '', hash: '' })).toBe('classic');
  expect(modeFromLocation({ search: '?mode=classic', hash: '' })).toBe('classic');
  expect(modeFromLocation({ search: '?mode=personal', hash: '' })).toBe('personal');
});
test('auth and payment callbacks continue to use the original app', () => {
  expect(modeFromLocation({ search: '?mode=personal&code=callback', hash: '' })).toBe('classic');
  expect(modeFromLocation({ search: '?mode=personal&OrderTrackingId=123', hash: '' })).toBe('classic');
  expect(modeFromLocation({ search: '?mode=personal', hash: '#access_token=example' })).toBe('classic');
});
test('the homepage exposes both destinations above the title; switching preserves shareable URLs', async () => {
  await act(async () => root.render(<Voyager/>));
  expect(host.querySelector('h1').textContent).toBe('Master Vocabulary with AI');
  const links = host.querySelectorAll('nav a');
  expect(links[0].getAttribute('href')).toBe('?mode=personal');
  expect(links[1].getAttribute('href')).toBe('?mode=personal&studio=thesaurus');
  expect(links[2].href).toBe('https://aave-ebon.vercel.app/');
  expect(host.querySelector('nav').compareDocumentPosition(host.querySelector('h1')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  act(() => Simulate.click(links[0]));
  expect(window.location.search).toBe('?mode=personal');
  expect(host.querySelector('h1').textContent).toBe('My Vocabulary');
  act(() => Simulate.click(host.querySelector('button')));
  expect(window.location.search).toBe('');
  expect(host.querySelector('h1').textContent).toBe('Master Vocabulary with AI');
});
test('a direct personal-mode link opens the notebook and a popstate returns to classic', async () => {
  window.history.replaceState({}, '', '/?mode=personal');
  await act(async () => root.render(<Voyager/>));
  expect(host.querySelector('h1').textContent).toBe('My Vocabulary');
  act(() => { window.history.replaceState({}, '', '/'); window.dispatchEvent(new PopStateEvent('popstate')); });
  expect(host.querySelector('h1').textContent).toBe('Master Vocabulary with AI');
});
