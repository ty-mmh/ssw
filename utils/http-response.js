function jsonResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type',
      ...headers,
    },
    body: JSON.stringify(body),
  }
}

function parseJsonBody(event) {
  if (!event.body) return {}
  const body = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body
  return JSON.parse(body)
}

function getPathParameter(event, name) {
  return event.pathParameters?.[name]
}

module.exports = {
  jsonResponse,
  parseJsonBody,
  getPathParameter,
}
