import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

const directory = new URL('../helpers/scriptable/', import.meta.url)
const source = readdirSync(directory).filter((file) => file.endsWith('.js')).sort()
  .map((file) => readFileSync(new URL(file, directory), 'utf8')).join('')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const execute = new AsyncFunction('args', 'Request', 'Script', source)
const id = '1234567890123456789'
const url = `https://x.com/example/status/${id}`
const mp4 = (quality, bitrate) => ({
  content_type: 'video/mp4', bitrate,
  url: `https://video.twimg.com/example/${({ high: '1280x720', medium: '854x480', low: '640x360' })[quality] || '320x180'}/${quality}.mp4`
})
const video = () => ({
  type: 'video',
  video_info: { variants: [
    mp4('low', 256000),
    { content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/example/stream.m3u8' },
    mp4('high', 2176000), mp4('medium', 832000)
  ] }
})
const photo = () => ({ type: 'photo', media_url_https: 'https://pbs.twimg.com/media/example.jpg' })
const fixture = () => ({
  id_str: id, created_at: '2024-10-18T12:00:00.000Z',
  user: { screen_name: 'example' }, mediaDetails: [video()]
})

async function run(input = url, options = {}) {
  const requests = []
  class Request {
    constructor(requestUrl) {
      this.url = requestUrl
      this.response = { statusCode: options.status ?? 200, cookies: [] }
      requests.push(this)
    }
    async loadString() {
      if (options.error) throw new Error(options.error)
      return options.body ?? JSON.stringify(options.post ?? fixture())
    }
    async load() { return null }
  }
  const output = await execute({ shortcutParameter: input }, Request, { complete() {} })
  return { output, requests }
}

test('returns the highest-bitrate MP4 in the Shortcut output format', async () => {
  const { output, requests } = await run()
  assert.deepEqual(output, {
    platform: 'X', postId: id, authorUsername: 'example', requiresUserLogin: false,
    downloadLinks: [{
      url: mp4('high', 0).url, timestamp: 1729252800,
      qualityOptions: ['720p', '480p', '360p'],
      qualityUrls: {
        '720p': mp4('high').url,
        '480p': mp4('medium').url,
        '360p': mp4('low').url
      }
    }]
  })
  assert.equal(requests.length, 1)
  const request = requests[0]
  const endpoint = new URL(request.url)
  assert.equal(endpoint.origin, 'https://cdn.syndication.twimg.com')
  assert.equal(endpoint.pathname, '/tweet-result')
  assert.equal(endpoint.searchParams.get('id'), id)
  assert.equal(endpoint.searchParams.get('token'), '2zqic77uqyk')
  assert.deepEqual(request.headers, { 'User-Agent': 'Googlebot' })
  assert.equal(request.timeoutInterval, 30)
})

for (const input of [
  `${url}/video/1?s=42`, ` ${url} `,
  `https://www.x.com/example/status/${id}/`,
  `https://mobile.twitter.com/example/status/${id}?s=20`,
  `https://m.twitter.com/example/status/${id}`,
  `https://TWITTER.COM/example/status/${id}/VIDEO/1#fragment`,
  `https://x.com/i/status/${id}`, `https://x.com/i/web/status/${id}`
]) {
  test(`accepts post URL ${input}`, async () => {
    assert.equal((await run(input)).output.platform, 'X')
  })
}

test('plain posts return mixed attachments; numbered links select the original media index', async () => {
  const post = fixture()
  post.mediaDetails = [photo(), video(), { type: 'animated_gif', video_info: { variants: [mp4('gif')] } }]
  const { output } = await run(url, { post })
  assert.equal(output.downloadLinks.length, 3)
  assert.equal(output.downloadLinks[0].url, photo().media_url_https + '?name=orig')
  assert.equal(output.downloadLinks[2].url, mp4('gif').url)
  assert.equal((await run(url + '/video/2', { post })).output.downloadLinks[0].url, mp4('high').url)
  assert.equal((await run(url + '/photo/1', { post })).output.downloadLinks[0].url, photo().media_url_https + '?name=orig')
  assert.match((await run(url + '/video/1', { post })).output.errorMessage, /not a video/)
  assert.match((await run(url + '/photo/2', { post })).output.errorMessage, /not a photo/)
  assert.match((await run(url + '/video/4', { post })).output.errorMessage, /unavailable/)
})

test('original photo size preserves the image format and replaces an existing size', async () => {
  for (const suffix of ['?format=png', '?format=png&name=small', '?name=small&format=png']) {
    const post = fixture()
    post.mediaDetails = [{ type: 'photo', media_url_https: 'https://pbs.twimg.com/media/example' + suffix }]
    const resultUrl = new URL((await run(url, { post })).output.downloadLinks[0].url)
    assert.equal(resultUrl.searchParams.get('format'), 'png')
    assert.deepEqual(resultUrl.searchParams.getAll('name'), ['orig'])
  }
})

for (const input of [
  'https://x.com/example', `${url}/video/0`, `${url}/video/1/unexpected`,
  'https://twitter.com/home', 'https://x.com/search?q=example'
]) {
  test(`rejects non-post or malformed X URL ${input} without a request`, async () => {
    const { output, requests } = await run(input)
    assert.match(output.errorMessage, /Share an X post link/)
    assert.equal(requests.length, 0)
  })
}

for (const input of [
  'https://x.com.evil.test/example/status/123', 'https://evil.test/x.com/example/status/123',
  'https://x.com@evil.test/example/status/123', 'https://t.co/example', 'https://youtube.com/watch?v=example'
]) {
  test(`does not route unsupported hosts to X: ${input}`, async () => {
    const { output, requests } = await run(input)
    assert.equal(output.errorMessage, 'Unsupported platform')
    assert.equal(requests.length, 0)
  })
}

test('empty and non-string input return an error without requesting media', async () => {
  assert.equal((await run('   ')).output.errorMessage, 'An empty URL was passed in')
  assert.equal((await run({ url })).output.errorMessage, 'Share a post URL as text')
})

test('Instagram still reaches its existing login flow', async () => {
  const { output, requests } = await run('https://www.instagram.com/reel/EXAMPLE/')
  assert.equal(output.platform, 'Instagram')
  assert.equal(output.requiresUserLogin, true)
  assert.equal(requests[0].url, 'https://www.instagram.com/')
})

for (const status of [403, 404, 429, 500]) {
  test(`handles HTTP ${status}, including non-JSON error pages`, async () => {
    const { output } = await run(url, { status, body: '<html>Error</html>' })
    assert.equal(output.hasError, true)
    assert.match(output.errorMessage, status === 429 ? /rate limiting/ : new RegExp(`HTTP ${status}`))
  })
}

test('handles empty, mismatched, or inaccessible post data', async () => {
  for (const post of [{}, { id_str: '123' }, null]) {
    const { output } = await run(url, { body: JSON.stringify(post) })
    assert.equal(output.hasError, true)
    assert.match(output.errorMessage, /private, deleted, or unavailable/)
  }
})

test('handles posts with missing media, HLS-only videos, and invalid dates', async () => {
  const post = fixture()
  delete post.mediaDetails
  assert.match((await run(url, { post })).output.errorMessage, /No downloadable/)
  post.mediaDetails = [{ type: 'video', video_info: { variants: [{ content_type: 'application/x-mpegURL', url: 'https://video.twimg.com/stream.m3u8' }] } }]
  assert.match((await run(url, { post })).output.errorMessage, /downloadable MP4/)
  post.created_at = 'invalid'
  assert.match((await run(url, { post })).output.errorMessage, /invalid post date/)
})

test('does not download media from unexpected hosts', async () => {
  const post = fixture()
  post.mediaDetails[0].video_info.variants = [{ content_type: 'video/mp4', url: 'https://video.twimg.com.evil.test/video.mp4' }]
  assert.equal((await run(url, { post })).output.hasError, true)
  post.mediaDetails = [{ type: 'photo', media_url_https: 'https://pbs.twimg.com.evil.test/photo.jpg' }]
  assert.equal((await run(url, { post })).output.hasError, true)
})

test('network failures and malformed JSON return Shortcut errors', async () => {
  assert.match((await run(url, { error: 'Timed out' })).output.errorMessage, /Could not load X media: Timed out/)
  assert.equal((await run(url, { body: 'invalid JSON' })).output.hasError, true)
})

test('quality labels show only the resolution and map to the correct file', async () => {
  const post = fixture()
  post.mediaDetails[0].video_info.variants = [
    { ...mp4('low', 256000), url: 'https://video.twimg.com/example/vid/avc1/338x270/low.mp4' },
    { ...mp4('high', 2176000), url: 'https://video.twimg.com/example/vid/avc1/720x574/high.mp4' }
  ]
  const { output } = await run(url, { post })
  const download = output.downloadLinks[0]
  assert.deepEqual(download.qualityOptions, ['574p', '270p'])
  assert.equal(download.qualityUrls[download.qualityOptions[1]], post.mediaDetails[0].video_info.variants[0].url)
})

test('single-quality files need no picker and duplicate URLs are removed', async () => {
  const post = fixture()
  post.mediaDetails[0].video_info.variants = [mp4('only', 256000), mp4('only', 256000)]
  const download = (await run(url, { post })).output.downloadLinks[0]
  assert.equal(download.url, mp4('only').url)
  assert.equal(download.qualityOptions, undefined)
})

test('one choice per resolution keeps the highest-bitrate file', async () => {
  const post = fixture()
  post.mediaDetails[0].video_info.variants = [mp4('a', 256000), mp4('b', 832000)]
  const download = (await run(url, { post })).output.downloadLinks[0]
  assert.equal(download.qualityOptions, undefined)
  assert.equal(download.url, mp4('b').url)
})

test('portrait videos use familiar labels rather than their long edge', async () => {
  const post = fixture()
  post.mediaDetails[0].video_info.variants = [
    { ...mp4('high', 2176000), url: 'https://video.twimg.com/example/720x1280/high.mp4' },
    { ...mp4('low', 256000), url: 'https://video.twimg.com/example/360x640/low.mp4' }
  ]
  assert.deepEqual((await run(url, { post })).output.downloadLinks[0].qualityOptions, ['720p', '360p'])
})

test('unknown dimensions do not expose bitrate or invent a resolution', async () => {
  const post = fixture()
  post.mediaDetails[0].video_info.variants = [
    { ...mp4('high', 2176000), url: 'https://video.twimg.com/example/high.mp4' },
    mp4('low', 256000)
  ]
  assert.deepEqual((await run(url, { post })).output.downloadLinks[0].qualityOptions, ['Best available', '360p'])
})
