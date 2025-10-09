import axios, {
    AxiosError,
    AxiosInstance,
    AxiosInterceptorManager,
    AxiosInterceptorOptions,
    AxiosResponse,
    InternalAxiosRequestConfig,
} from 'axios'
import { isCancel as _isCancel } from 'axios'

export enum PROBLEM_CODE {
    CLIENT_ERROR = 'CLIENT_ERROR',
    SERVER_ERROR = 'SERVER_ERROR',
    CONNECTION_ERROR = 'CONNECTION_ERROR',
    NETWORK_ERROR = 'NETWORK_ERROR',
    UNKNOWN_ERROR = 'UNKNOWN_ERROR',
    CANCEL_ERROR = 'CANCEL_ERROR',
    TIMEOUT_ERROR = 'TIMEOUT_ERROR',
    VALIDATION_ERROR = 'VALIDATION_ERROR',
}

export interface ApiErrorResponse<T> {
    ok: false
    problem: PROBLEM_CODE
    originalError: AxiosError
    data?: T
    status: number
    headers?: any
    config?: InternalAxiosRequestConfig
    duration?: number
}

export interface ApiOkResponse<T> extends AxiosResponse<T> {
    ok: true
    problem: null
    originalError: null
    statusText: string
    data: T
    status: number
    headers: AxiosResponse<any>['headers']
    config: InternalAxiosRequestConfig
    duration?: number
}

export interface ApiConfig {
    url: string
    timeout?: number
    headers?: Record<string, any>
}

export type ApiResponse<ResponseBody = any, ErrorBody = any> = ApiErrorResponse<ErrorBody> | ApiOkResponse<ResponseBody>

export type Methods = 'get' | 'post' | 'put' | 'delete' | 'patch' | 'options' | 'head'

type ApiRequestFunction<M extends Methods> = <T = unknown, E = any>(
    ...params: Parameters<AxiosInstance[M]>
) => Promise<ApiResponse<T, E>>

type ApiRequestInterceptorUse<T> = (
    callback?: ((value: T) => T | Promise<T>) | null,
) => number

type ApiResponseInterceptorUse = <T>(
    callback: (res: ApiResponse<T>) => ApiResponse<T> | Promise<ApiResponse<T>>
) => number

interface ApiInterceptorManager {
    use: ApiResponseInterceptorUse
    eject(id: number): void
    clear(): void
}

export interface ApiInstanceBeforeInterceptor extends Omit<AxiosInstance, Methods> {
    get: ApiRequestFunction<'get'>
    post: ApiRequestFunction<'post'>
    put: ApiRequestFunction<'put'>
    delete: ApiRequestFunction<'delete'>
    patch: ApiRequestFunction<'patch'>
    options: ApiRequestFunction<'options'>
    head: ApiRequestFunction<'head'>
}

export interface ApiInstance extends Omit<ApiInstanceBeforeInterceptor, 'interceptors'> {
    interceptors: {
        request: ApiInterceptorManager
        response: ApiInterceptorManager
    }
}

export const createApi = (config: ApiConfig): ApiInstance => {
    const api = axios.create({
        baseURL: config.url,
        timeout: config.timeout,
        headers: config.headers,
    }) as ApiInstanceBeforeInterceptor
    api.interceptors.response.use(interceptor, responseError)
    return api as unknown as ApiInstance
}

export const getProblemFromStatus = (status: number | undefined): PROBLEM_CODE | null | undefined => {
    if (!status) return PROBLEM_CODE.UNKNOWN_ERROR
    if (status >= 200 && status < 300) return null
    if (status >= 400 && status < 500) return PROBLEM_CODE.CLIENT_ERROR
    if (status >= 500) return PROBLEM_CODE.SERVER_ERROR
    return PROBLEM_CODE.UNKNOWN_ERROR
}

// Type issue: https://github.com/axios/axios/issues/5153
function isCancel(error: AxiosError): boolean {
    return _isCancel(error)
}

export const getProblemFromError = <T, D>(error: AxiosError<T, D>) => {
    if (error.message === 'Network Error') return PROBLEM_CODE.NETWORK_ERROR
    if (isCancel(error)) return PROBLEM_CODE.CANCEL_ERROR
    if (!error.code) return getProblemFromStatus(error.response?.status)
    if (error.code === 'ECONNABORTED') return PROBLEM_CODE.TIMEOUT_ERROR
    return PROBLEM_CODE.UNKNOWN_ERROR
}

const interceptor = <T>(response: AxiosResponse<T>): ApiOkResponse<T> => {
    // Any status code that lie within the range of 2xx cause this function to trigger
    return {
        ...response,
        data: response.data ?? ({} as T),
        ok: true,
        problem: null,
        originalError: null,
    }
}

/* Typescript hint */
const isAxiosError = (error: any): error is AxiosError => {
    if ((error as AxiosError).isAxiosError) return true
    return false
}

const responseError = <T>(e: T): Partial<ApiErrorResponse<T>> => {
    if (isAxiosError(e)) {
        return {
            ...e.response,
            data: {} as T,
            ok: false,
            status: e.response?.status,
            config: e.config as any,
            originalError: e as any,
            problem: getProblemFromStatus(e.response?.status) ?? undefined,
        }
    }
    throw e
}
