import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import test from 'node:test'

const directory = new URL('../helpers/scriptable/', import.meta.url)
const source = readdirSync(directory).filter((file) => file.endsWith('.js')).sort()
  .map((file) => readFileSync(new URL(file, directory), 'utf8')).join('')
const execute = new (Object.getPrototypeOf(async function () {}).constructor)('args', 'Request', 'Script', source)
const shortcode = 'DeDHAEWSF6k'
const mediaId = '4000071685029519012'
const post = () => ({
  media_type: 2, taken_at: 1729252800, user: { username: 'example' },
  video_versions: [{ url: 'https://instagram.example/video.mp4' }]
})

async function run(input, options = {}) {
  const requests = []
  class Request {
    constructor(url) {
      this.url = url
      this.response = { cookies: options.cookies ?? [{ name: 'sessionid' }], url: options.resolvedUrl || url }
      requests.push(this)
    }
    async load() { if (options.loginError) throw new Error(options.loginError) }
    async loadString() { return options.html ?? '<html>No embedded media ID</html>' }
    async loadJSON() {
      assert.equal(this.url, `https://i.instagram.com/api/v1/media/${options.mediaId || mediaId}/info/`)
      return options.mediaInfo ?? { status: 'ok', items: [post()] }
    }
  }
  const output = await execute({ shortcutParameter: input }, Request, { complete() {} })
  return { output, requests }
}

for (const path of ['reel', 'reels', 'p', 'tv']) {
  test(`/${path}/ derives the exact numeric ID without scraping HTML`, async () => {
    const { output, requests } = await run(`https://www.instagram.com/${path}/${shortcode}/`)
    assert.equal(output.platform, 'Instagram')
    assert.equal(output.postId, shortcode)
    assert.equal(output.requiresUserLogin, false)
    assert.deepEqual(output.downloadLinks, [{ url: post().video_versions[0].url, timestamp: post().taken_at }])
    assert.deepEqual(requests.map((r) => r.url), ['https://www.instagram.com/', `https://i.instagram.com/api/v1/media/${mediaId}/info/`])
  })
}

test('share query strings and uppercase domains do not change the media ID', async () => {
  const { output } = await run(`https://WWW.INSTAGRAM.COM/reels/${shortcode}/?igsh=example`)
  assert.equal(output.postId, shortcode)
})

test('share links follow their resolved canonical reel URL', async () => {
  const { output } = await run('https://www.instagram.com/share/reel/example/', {
    resolvedUrl: `https://www.instagram.com/reel/${shortcode}/`
  })
  assert.equal(output.postId, shortcode)
  assert.equal(output.downloadLinks.length, 1)
})

test('missing media IDs produce an explanation rather than destructuring null', async () => {
  const { output } = await run('https://www.instagram.com/s/example/')
  assert.equal(output.hasError, true)
  assert.match(output.errorMessage, /did not expose a media ID/)
  assert.doesNotMatch(output.errorMessage, /null|iterable/)
})

test('missing user IDs produce an explanation rather than destructuring null', async () => {
  assert.equal((await run('https://www.instagram.com/example/')).output.errorMessage, 'Missing user ID')
})

test('a final story_media_id query parameter works without a trailing ampersand', async () => {
  const { output } = await run('https://www.instagram.com/s/example/?story_media_id=123', { mediaId: '123' })
  assert.equal(output.downloadLinks.length, 1)
})

test('story URLs use their numeric media ID directly', async () => {
  const { output } = await run('https://www.instagram.com/stories/example/123/', { mediaId: '123' })
  assert.equal(output.downloadLinks.length, 1)
})

test('signed-out sessions still request Instagram login', async () => {
  assert.equal((await run(`https://www.instagram.com/reels/${shortcode}/`, { cookies: [] })).output.requiresUserLogin, true)
})

test('API login-required responses request login rather than crashing', async () => {
  assert.equal((await run(`https://www.instagram.com/reels/${shortcode}/`, {
    mediaInfo: { status: 'fail', message: 'login_required' }
  })).output.requiresUserLogin, true)
})

test('network errors during the session check become Shortcut errors', async () => {
  assert.equal((await run(`https://www.instagram.com/reels/${shortcode}/`, { loginError: 'Timed out' })).output.errorMessage, 'Timed out')
})

test('empty API media lists are reported clearly', async () => {
  assert.equal((await run(`https://www.instagram.com/reels/${shortcode}/`, { mediaInfo: { status: 'ok', items: [] } })).output.errorMessage, 'Instagram returned no media for this post')
})
