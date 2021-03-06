import { headersToList } from 'headers-utils'
import {
  StartOptions,
  ResponseWithSerializedHeaders,
  SetupWorkerInternalContext,
  ServiceWorkerIncomingEventsMap,
} from '../../setupWorker/glossary'
import {
  ServiceWorkerMessage,
  createBroadcastChannel,
} from '../createBroadcastChannel'
import { getResponse } from '../getResponse'
import { onUnhandledRequest } from '../request/onUnhandledRequest'
import { NetworkError } from '../NetworkError'
import { parseWorkerRequest } from '../request/parseWorkerRequest'
import { readResponseCookies } from '../request/readResponseCookies'
import { setRequestCookies } from '../request/setRequestCookies'

export const createRequestListener = (
  context: SetupWorkerInternalContext,
  options: StartOptions,
) => {
  return async (
    event: MessageEvent,
    message: ServiceWorkerMessage<
      'REQUEST',
      ServiceWorkerIncomingEventsMap['REQUEST']
    >,
  ) => {
    const channel = createBroadcastChannel(event)

    try {
      const request = parseWorkerRequest(message.payload)
      context.emitter.emit('request:start', request)

      // Set document cookies on the request.
      setRequestCookies(request)

      const {
        response,
        handler,
        publicRequest,
        parsedRequest,
      } = await getResponse(request, context.requestHandlers)

      // Handle a scenario when there is no request handler
      // found for a given request.
      if (!handler) {
        onUnhandledRequest(
          request,
          context.requestHandlers,
          options.onUnhandledRequest,
        )
        context.emitter.emit('request:unhandled', request)
        context.emitter.emit('request:end', request)

        return channel.send({ type: 'MOCK_NOT_FOUND' })
      }

      context.emitter.emit('request:match', request)

      // Handle a scenario when there is a request handler,
      // but it doesn't return any mocked response.
      if (!response) {
        console.warn(
          '[MSW] Expected a mocking resolver function to return a mocked response Object, but got: %s. Original response is going to be used instead.',
          response,
        )

        context.emitter.emit('request:end', request)

        return channel.send({ type: 'MOCK_NOT_FOUND' })
      }

      readResponseCookies(request, response)

      const responseWithSerializedHeaders: ResponseWithSerializedHeaders = {
        ...response,
        headers: headersToList(response.headers),
      }

      if (!options.quiet) {
        setTimeout(() => {
          handler.log(
            publicRequest,
            responseWithSerializedHeaders,
            handler,
            parsedRequest,
          )
        }, response.delay)
      }

      context.emitter.emit('request:end', request)

      channel.send({
        type: 'MOCK_SUCCESS',
        payload: responseWithSerializedHeaders,
      })
    } catch (error) {
      if (error instanceof NetworkError) {
        // Treat emulated network error differently,
        // as it is an intended exception in a request handler.
        return channel.send({
          type: 'NETWORK_ERROR',
          payload: {
            name: error.name,
            message: error.message,
          },
        })
      }

      // Treat all the other exceptions in a request handler
      // as unintended, alerting that there is a problem needs fixing.
      channel.send({
        type: 'INTERNAL_ERROR',
        payload: {
          status: 500,
          body: JSON.stringify({
            errorType: error.constructor.name,
            message: error.message,
            location: error.stack,
          }),
        },
      })
    }
  }
}
