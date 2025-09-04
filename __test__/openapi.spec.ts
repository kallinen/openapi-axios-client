import * as openapi from '../src/openapi'
import { AxiosRequestConfig, AxiosResponse } from 'axios'
import {
    buildClientFromSpec,
    ApiInstance,
    AdaptedOperationMethods,
    splitParams,
    createTypedApi,
    OpenAPISpec,
} from '../src'

type RawAxiosResponse<Response> = Promise<AxiosResponse<Response>>

const spec = {
    paths: {
        '/user/{id}': {
            get: {
                operationId: 'getUser',
            },
            post: {
                operationId: 'createUser',
            },
        },
    },
} as const

const mockRequest: ApiInstance['request'] = jest.fn(
    async <T = any, R = AxiosResponse<T, any>, D = any>(config: AxiosRequestConfig<D>): Promise<R> => {
        return {
            data: { id: 1, name: 'Alice' },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
        } as unknown as R
    },
) as unknown as ApiInstance['request']

const api = {
    request: mockRequest,
} as ApiInstance

interface OperationMethods {
    'getUser'(
        parameters: { id: number; expand?: string },
        data?: any,
        config?: AxiosRequestConfig,
    ): RawAxiosResponse<{ id: number; name: string }>

    'createUser'(
        parameters: { id: number },
        data?: { name: string },
        config?: AxiosRequestConfig,
    ): RawAxiosResponse<{ id: number; name: string }>
}

interface PathsDictionary {
    '/user/{id}': {
        get(
            parameters: { id: number; expand?: string },
            data?: any,
            config?: AxiosRequestConfig,
        ): RawAxiosResponse<{ id: number; name: string }>

        post(
            parameters?: {},
            data?: { name: string },
            config?: AxiosRequestConfig,
        ): RawAxiosResponse<{ id: number; name: string }>
    }
}

const client = buildClientFromSpec<AdaptedOperationMethods<OperationMethods>, PathsDictionary>(spec, api)

const jestMockRequest = mockRequest as jest.Mock

describe('Test typed api client', () => {
    beforeEach(() => jestMockRequest.mockReset())

    it('should call GET method with path and query params', async () => {
        jestMockRequest.mockResolvedValue({ ok: true, data: { id: 1, name: 'Alice' } })

        const response = await client.getUser({ id: 1, expand: 'details' })
        expect(jestMockRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'get',
                url: '/user/1',
                params: { expand: 'details' },
            }),
        )
        expect(response.data).toEqual({ id: 1, name: 'Alice' })
    })

    it('should call POST method with body', async () => {
        jestMockRequest.mockResolvedValue({ ok: true, data: { id: 2, name: 'Bob' } })

        const response = await client.createUser({ id: 10 }, { name: 'Bob' })

        expect(jestMockRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                method: 'post',
                url: '/user/10',
                data: { name: 'Bob' },
            }),
        )

        expect(response.data).toEqual({ id: 2, name: 'Bob' })
    })
})

describe('splitParams', () => {
    it('should replace path parameters and leave remaining as query', () => {
        const { url, pathParams, queryParams } = splitParams('/user/{id}/items/{itemId}', {
            id: 123,
            itemId: 'abc',
            expand: 'full',
            sort: 'desc',
        })

        expect(url).toBe('/user/123/items/abc')
        expect(pathParams).toEqual({ id: 123, itemId: 'abc' })
        expect(queryParams).toEqual({ expand: 'full', sort: 'desc' })
    })

    it('should throw if a path parameter is missing', () => {
        expect(() => splitParams('/user/{id}/items/{itemId}', { id: 1 })).toThrow('Missing path parameter: itemId')
    })

    it('should handle URLs with no placeholders', () => {
        const { url, pathParams, queryParams } = splitParams('/users', { page: 1, pageSize: 10 })
        expect(url).toBe('/users')
        expect(pathParams).toEqual({})
        expect(queryParams).toEqual({ page: 1, pageSize: 10 })
    })

    it('should encode path parameters', () => {
        const { url } = splitParams('/search/{term}', { term: 'hello world' })
        expect(url).toBe('/search/hello%20world')
    })

    it('should work with single string param', () => {
        const { url } = splitParams('/search/{term}', 'hello world')
        expect(url).toBe('/search/hello%20world')
    })

    it('should work with single integer param', () => {
        const { url } = splitParams('/fetch/{id}', 2)
        expect(url).toBe('/fetch/2')
    })

    it('should throw if multiple path params exist but only a single primitive is passed', () => {
        expect(() => splitParams('/user/{id}/items/{itemId}', 123)).toThrow('Missing path parameter: id')
    })

    it('should ignore extra parameters not in path or query', () => {
        const { url, pathParams, queryParams } = splitParams('/user/{id}', {
            id: 5,
            foo: 'bar',
        })
        expect(url).toBe('/user/5')
        expect(pathParams).toEqual({ id: 5 })
        expect(queryParams).toEqual({ foo: 'bar' })
    })

    it('should handle empty parameters object with no path placeholders', () => {
        const { url, pathParams, queryParams } = splitParams('/status', {})
        expect(url).toBe('/status')
        expect(pathParams).toEqual({})
        expect(queryParams).toEqual({})
    })

    it('should throw if primitive passed but URL has no placeholders', () => {
        expect(() => splitParams('/static', 'oops')).toThrow('Primitives are only supported as path params')
    })

    it('should support numeric string substitution', () => {
        const { url, pathParams } = splitParams('/order/{orderId}', { orderId: '42' })
        expect(url).toBe('/order/42')
        expect(pathParams).toEqual({ orderId: '42' })
    })
})

describe('createTypedApi', () => {
    it('should be sync method overload when providing spec as object', () => {
        const spy = jest.spyOn(openapi, 'loadSpec').mockResolvedValue({ paths: {} } as any)
        const api = createTypedApi<OperationMethods, PathsDictionary>(spec as OpenAPISpec, {
            url: '',
            headers: {},
            timeout: 1000,
        })
        expect(spy).not.toHaveBeenCalled()
        expect(api.createUser).toBeDefined()
    })

    it('should be async sync method overload when providing spec as string', () => {
        const spy = jest.spyOn(openapi, 'loadSpec').mockResolvedValue({ paths: {} } as any)
        const api = createTypedApi<OperationMethods, PathsDictionary>('path', {
            url: '',
            headers: {},
            timeout: 1000,
        })
        expect(spy).toHaveBeenCalled()
        expect((api as any).createUser).not.toBeDefined()
    })
})
