import { createApi, ApiInstance } from '../src'
import { MockServer } from 'jest-mock-server'

const server = new MockServer()
let api: ApiInstance

beforeAll(async () => {
    await server.start()
    api = createApi({ url: server.getURL().toString(), headers: {}, timeout: 30000 })
})
afterAll(async () => await server.stop())
beforeEach(() => server.reset())

describe('Test api', () => {
    it('Should work with basic GET', async () => {
        const route = server.get('/').mockImplementationOnce((ctx) => {
            ctx.status = 200
            ctx.body = { hello: 'world' }
        })
        const response = await api.get('/')
        expect(route).toHaveBeenCalledTimes(1)
        expect(response.data).toMatchObject({ hello: 'world' })
    })
    it('Should work with GET parameters', async () => {
        const route = server.get('/').mockImplementationOnce((ctx) => {
            ctx.status = 200
            ctx.body = { hello: ctx.request.query['hello'] }
        })
        const response = await api.get('/', { params: { hello: 'everybody' } })
        expect(route).toHaveBeenCalledTimes(1)
        expect(response.data).toMatchObject({ hello: 'everybody' })
    })
    it('Should work with POST', async () => {
        const route = server.post('/').mockImplementationOnce((ctx) => {
            ctx.status = 200
            ctx.body = ctx.request.body
        })
        const response = await api.post('/', { hello: 'you' })
        expect(route).toHaveBeenCalledTimes(1)
        expect(response.data).toMatchObject({ hello: 'you' })
    })
    it('Should work with PUT', async () => {
        const route = server.put('/').mockImplementationOnce((ctx) => {
            ctx.status = 200
            ctx.body = ctx.request.body
        })
        const response = await api.put('/', { hello: 'you' })
        expect(route).toHaveBeenCalledTimes(1)
        expect(response.data).toMatchObject({ hello: 'you' })
    })
    it('Should work with Authorization', async () => {
        const route = server.post('/').mockImplementationOnce((ctx) => {
            ctx.status = 200
            ctx.body = ctx.headers.authorization
        })
        const response = await api.post('/', { hello: 'you' }, { headers: { Authorization: 'Hello' } })
        expect(route).toHaveBeenCalledTimes(1)
        expect(response.data).toMatch('Hello')
    })
})
