// P27 (judge pass 21 #2): a deliberate assertion failure, as opposed to an exception thrown while checking.
// Only an AssertionFailure counts as "the state did not hold" (and so as the expected rejection of a negative control).
// Anything else a check throws (TypeError, an invalid selector, a closed page, a Playwright timeout on an action) is
// infrastructure: the check could not decide, so a negative control whose check threw it is NOT HELD.
// hard.mjs and hard-states.mjs import this one module (same file URL, so instanceof works across both); the brand is a
// global symbol so an instance from another copy of the module is still recognised.
const BRAND = Symbol.for('hermes.ops-live.assertion-failure')

export class AssertionFailure extends Error {
  constructor(message) {
    super(message)
    this.name = 'AssertionFailure'
    this[BRAND] = true
  }
}

export const isAssertionFailure = e => Boolean(e && (e instanceof AssertionFailure || e[BRAND] === true))

/** Throw a deliberate assertion failure. */
export const fail = message => {
  throw new AssertionFailure(message)
}
