// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

const gradientStub = {
  addColorStop: jest.fn(),
};

const contextStub = {
  setTransform: jest.fn(),
  clearRect: jest.fn(),
  fillRect: jest.fn(),
  strokeRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  bezierCurveTo: jest.fn(),
  arc: jest.fn(),
  stroke: jest.fn(),
  save: jest.fn(),
  restore: jest.fn(),
  createLinearGradient: jest.fn(() => gradientStub),
  createRadialGradient: jest.fn(() => gradientStub),
};

Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
  writable: true,
  value: jest.fn(() => contextStub),
});

Object.defineProperty(window, "requestAnimationFrame", {
  writable: true,
  value: jest.fn(() => 1),
});

Object.defineProperty(window, "cancelAnimationFrame", {
  writable: true,
  value: jest.fn(),
});
