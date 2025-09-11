# OpenAPI Axios Client

[![npm module](https://badge.fury.io/js/@kallinen%2Fopenapi-axios-client.svg)](https://www.npmjs.org/package/@kallinen/openapi-axios-client)

This library leverages OpenAPI types to create a fully typed client API, providing a consistent interface with your backend services.

## Installation

This package can be installed in any JS/TS project.

```
npm install @kallinen/openapi-axios-client
```

## Basic usage

Types can be generated with following command

```
npx @kallinen/openapi-typings-gen spec.json > spec.ts
```

### Creating a new API

```
import spec from '<path to openapi json>' 

const config = {
  url: 'localhost:3000',
  timeout: 30000,
  headers: {}
}

const api = createTypedApi<OperationMethods, PathsDictionary>(spec, {
    url: config.url,
    timeout: config.timeout,
    headers: config.headers,
})

const anotherApi = await createTypedApi<OperationMethods, PathsDictionary>('path/to/json', {
    url: config.url,
    timeout: config.timeout,
    headers: config.headers,
})

const remoteApi = await createTypedApi<OperationMethods, PathsDictionary>('https://example.com/openapi.json', {
    url: config.url,
    timeout: config.timeout,
    headers: config.headers,
})
```

### Api calls

```
const response = await api.getTodos({ id: 1 })
if (response.ok) {
  // Handle successful api call
  handleSuccess(response.data)
} else {
  // Handle errors. Response contains originalError, statusCode and problem.
}
```
