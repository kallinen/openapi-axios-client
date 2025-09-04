import { AxiosResponse } from "axios"
import { AdaptedOperationMethods, ApiResponse } from "../src"

type Original = {
    fetchUser: (id: string) => Promise<AxiosResponse<{ name: string }>>
    fetchPosts: (userId: string) => Promise<{ title: string }[]>
    syncFn: (x: number) => string
}

type Adapted = AdaptedOperationMethods<Original>

// TESTS: type assertions

// Expect: Promise<ApiResponse<{ name: string }>>
type Test1 = Adapted['fetchUser'] extends (...args: any[]) => Promise<ApiResponse<{ name: string }>> ? true : false
const t1: Test1 = true

// Expect: Promise<ApiResponse<{ title: string }[]>>
type Test2 = Adapted['fetchPosts'] extends (...args: any[]) => Promise<ApiResponse<{ title: string }[]>> ? true : false
const t2: Test2 = true

// Expect: unchanged
type Test3 = Adapted['syncFn'] extends (x: number) => string ? true : false
const t3: Test3 = true

test('Placeholder for type tests', () => {
    expect(1).toBe(1)
})