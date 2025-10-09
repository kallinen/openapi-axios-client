import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { ApiConfig, ApiErrorResponse, ApiInstance, ApiResponse, createApi, Methods, PROBLEM_CODE } from './wrapper'
import axios from 'axios'
import { z } from 'zod'

export type AdaptedOperationMethods<OperationMethods> = {
    [K in keyof OperationMethods]: OperationMethods[K] extends (...args: infer A) => Promise<AxiosResponse<infer R>>
        ? (...args: A) => Promise<ApiResponse<R>>
        : OperationMethods[K] extends (...args: infer A) => Promise<infer R>
        ? (...args: A) => Promise<ApiResponse<R>>
        : OperationMethods[K]
}

interface OpenAPIOperation {
    operationId?: string
}

type OpenAPIPathItem = {
    [method in Methods]?: OpenAPIOperation
}

export interface OpenAPISpec {
    paths: Record<string, OpenAPIPathItem>
}

export interface SplitParamsResult {
    url: string
    pathParams: Record<string, any>
    queryParams: Record<string, any>
}

export const loadSpec = async (path: string): Promise<OpenAPISpec> => {
    const res = await axios.get(path, { responseType: 'json' })
    try {
        return res.data
    } catch (e) {
        throw new Error(`Failed to load OpenAPI spec: ${res.status}`)
    }
}

/**
 * Splits a flat parameters object into path parameters and query parameters.
 * Replaces placeholders in the URL with the values from `parameters`.
 */
export const splitParams = (
    urlTemplate: string,
    parameters: Record<string, any> | string | number,
): SplitParamsResult => {
    let url = urlTemplate
    const pathParams: Record<string, any> = {}

    const isSingleParam = typeof parameters === 'string' || typeof parameters === 'number'
    const paramKeys = urlTemplate.match(/\{([^}]+)\}/g)?.map((key) => key.slice(1, -1)) || []
    if (isSingleParam && !paramKeys.length) {
        throw new Error('Primitives are only supported as path params')
    }
    const paramsObj: Record<string, any> =
        isSingleParam && paramKeys.length === 1
            ? { [paramKeys[0]]: parameters }
            : typeof parameters === 'object'
            ? parameters
            : {}

    url.replace(/\{([^}]+)\}/g, (_, key) => {
        if (key in paramsObj) {
            pathParams[key] = paramsObj[key]
            url = url.replace(`{${key}}`, encodeURIComponent(String(paramsObj[key])))
        } else {
            throw new Error(`Missing path parameter: ${key}`)
        }
        return ''
    })

    const queryParams: Record<string, any> = { ...paramsObj }
    Object.keys(pathParams).forEach((k) => delete queryParams[k])

    return { url, pathParams, queryParams }
}

const createMethod =
    (path: string, method: string, operationId: string, api: ApiInstance) =>
    async (parameters: any = {}, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<any>> => {
        const { queryParams, url } = splitParams(path, parameters)
        const axiosConfig: AxiosRequestConfig & { operationId: string } = {
            method,
            url,
            params: queryParams,
            data,
            operationId,
            ...config,
        }

        return api.request(axiosConfig)
    }

const toSafeName = (name: string): string => {
    return name.replace(/[^a-zA-Z0-9_]/g, '_')
}

function camelCase(input: string = ''): string {
    const reUnicodeWord = /[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g

    const words = (input.match(reUnicodeWord) || []).map((w) => w.toLowerCase())

    if (words.length === 0) return ''

    return (
        words[0] +
        words
            .slice(1)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
            .join('')
    )
}

export const buildClientFromSpec = <OperationMethods, PathsDictionary>(
    spec: OpenAPISpec,
    api: ApiInstance,
    validators: Record<string, z.ZodType> = {},
): ApiInstance & OperationMethods & { paths: PathsDictionary } => {
    const methods: Record<string, Function> = {}
    const paths: Record<string, Record<string, Function>> = {}

    for (const [path, methodsObj] of Object.entries(spec.paths)) {
        paths[path] = {}
        for (const [method, operation] of Object.entries(methodsObj)) {
            const operationId = operation.operationId
                ? toSafeName(operation.operationId)
                : toSafeName(camelCase(`${method} ${path.replace(/[\/{}]/g, ' ')}`))
            const fn = createMethod(path, method, operationId, api)
            methods[operationId] = fn
            paths[path][method] = fn
        }
    }

    if (Object.keys(validators).length) {
        api.interceptors.response.use((res) => {
            if (res.ok) {
                const operationId = (res.config as any).operationId
                const validator = validators[operationId]
                if (validator) {
                    try {
                        validator.parse(res.data)
                    } catch (e) {
                        return {
                            ok: false,
                            problem: PROBLEM_CODE.VALIDATION_ERROR,
                            originalError: e as any,
                            data: res.data,
                            status: res.status,
                            headers: res.headers,
                            config: res.config,
                        } as ApiErrorResponse<any>
                    }
                }
            }
            return res
        })
    }

    Object.assign(api, methods, { paths })

    return api as OperationMethods & { paths: PathsDictionary } & ApiInstance
}

type TypedApiConfig = ApiConfig & {
    validators?: Record<string, z.ZodType>
}

export function createTypedApi<OperationMethods, PathsDictionary>(
    specOrPath: string,
    config: TypedApiConfig,
): Promise<AdaptedOperationMethods<OperationMethods> & { paths: PathsDictionary } & ApiInstance>
export function createTypedApi<OperationMethods, PathsDictionary>(
    specOrPath: OpenAPISpec,
    config: TypedApiConfig,
): AdaptedOperationMethods<OperationMethods> & { paths: PathsDictionary } & ApiInstance
export function createTypedApi<OperationMethods, PathsDictionary>(
    specOrPath: string | OpenAPISpec,
    config: TypedApiConfig,
) {
    if (typeof specOrPath === 'string') {
        return (async () => {
            const spec = await loadSpec(specOrPath)
            const apiInstance = createApi(config)
            return buildClientFromSpec<AdaptedOperationMethods<OperationMethods>, PathsDictionary>(
                spec,
                apiInstance,
                config.validators,
            )
        })()
    } else {
        const apiInstance = createApi(config)
        return buildClientFromSpec<AdaptedOperationMethods<OperationMethods>, PathsDictionary>(
            specOrPath,
            apiInstance,
            config.validators,
        )
    }
}
