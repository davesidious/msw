/**
 * @jest-environment jsdom
 */
import { getRequestCookies } from './getRequestCookies'
import { createMockedRequest } from '../../../test/support/utils'

beforeAll(() => {
  // Emulate some `document.cookie` value.
  document.cookie = 'auth-token=abc-123;'
  document.cookie = 'custom-cookie=yes;'
})

afterAll(() => {
  // Clean up the `document.cookie` value.
  document.cookie = ''
})

test('returns all document cookies given "include" credentials', () => {
  const cookies = getRequestCookies(
    createMockedRequest({
      url: new URL(`${location.origin}/user`),
      credentials: 'include',
    }),
  )

  expect(cookies).toEqual({
    'auth-token': 'abc-123',
    'custom-cookie': 'yes',
  })
})

test('returns all document cookies given "same-origin" credentials and the same request origin', () => {
  const cookies = getRequestCookies(
    createMockedRequest({
      url: new URL(`${location.origin}/user`),
      credentials: 'same-origin',
    }),
  )

  expect(cookies).toEqual({
    'auth-token': 'abc-123',
    'custom-cookie': 'yes',
  })
})

test('returns an empty object given "same-origin" credentials and a different request origin', () => {
  const cookies = getRequestCookies(
    createMockedRequest({
      url: new URL(`https://test.mswjs.io/user`),
      credentials: 'same-origin',
    }),
  )

  expect(cookies).toEqual({})
})

test('returns an empty object given "omit" credentials', () => {
  const cookies = getRequestCookies(
    createMockedRequest({
      url: new URL(`${location.origin}/user`),
      credentials: 'omit',
    }),
  )

  expect(cookies).toEqual({})
})
