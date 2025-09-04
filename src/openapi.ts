import type { AxiosRequestConfig, AxiosResponse } from 'axios'
import { dereference } from '@apidevtools/json-schema-ref-parser'
import { ApiConfig, ApiInstance, ApiResponse, createApi, Methods } from './wrapper'

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
    const raw = await import(path)
    const { Validator } = await import('@seriousme/openapi-schema-validator')

    const validator = new Validator()
    const result = await validator.validate(raw)
    if (!result.valid) {
        throw new Error(`OpenAPI validation errors: ${JSON.stringify(result.errors, null, 2)}`)
    }

    return await dereference(raw)
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
    (path: string, method: string, api: ApiInstance) =>
    async (parameters: any = {}, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<any>> => {
        const { queryParams, url } = splitParams(path, parameters)
        const axiosConfig: AxiosRequestConfig = {
            method,
            url,
            params: queryParams,
            data,
            ...config,
        }

        return api.request(axiosConfig)
    }

export const buildClientFromSpec = <OperationMethods, PathsDictionary>(
    spec: OpenAPISpec,
    api: ApiInstance,
): ApiInstance & OperationMethods & { paths: PathsDictionary } => {
    const methods: Record<string, Function> = {}
    const paths: Record<string, Record<string, Function>> = {}

    for (const [path, methodsObj] of Object.entries(spec.paths)) {
        paths[path] = {}
        for (const [method, operation] of Object.entries(methodsObj)) {
            const fn = createMethod(path, method, api)
            if (operation.operationId) methods[operation.operationId] = fn
            paths[path][method] = fn
        }
    }
    Object.assign(api, methods, { paths })

    return api as OperationMethods & { paths: PathsDictionary } & ApiInstance
}

export function createTypedApi<OperationMethods, PathsDictionary>(
    specOrPath: string,
    config: ApiConfig,
): Promise<AdaptedOperationMethods<OperationMethods> & { paths: PathsDictionary } & ApiInstance>
export function createTypedApi<OperationMethods, PathsDictionary>(
    specOrPath: OpenAPISpec,
    config: ApiConfig,
): AdaptedOperationMethods<OperationMethods> & { paths: PathsDictionary } & ApiInstance
export function createTypedApi<OperationMethods, PathsDictionary>(specOrPath: string | OpenAPISpec, config: ApiConfig) {
    if (typeof specOrPath === 'string') {
        return (async () => {
            const spec = await loadSpec(specOrPath)
            const apiInstance = createApi(config)
            return buildClientFromSpec<AdaptedOperationMethods<OperationMethods>, PathsDictionary>(spec, apiInstance)
        })()
    } else {
        const apiInstance = createApi(config)
        return buildClientFromSpec<AdaptedOperationMethods<OperationMethods>, PathsDictionary>(specOrPath, apiInstance)
    }
}
