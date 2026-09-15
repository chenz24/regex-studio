// jsdom implements the DOM, but not layout — `scrollIntoView` and friends are
// missing entirely, and components that call them would throw in tests for a
// reason that has nothing to do with what is being tested.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
