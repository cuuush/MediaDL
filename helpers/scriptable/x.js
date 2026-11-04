// MediaDL - X (Twitter)
// Uses X's public embed endpoint; requests stay on-device.

/**
 * Retrieve photos, videos and animated GIFs from a public X post.
 * GIFs are returned as MP4 files, as served by X.
 * @returns {Promise<import('./types').XOutput | {hasError: boolean, errorMessage: string}>}
 */
async function x() {
  // Keep the ID as a string: X snowflakes exceed JavaScript's safe integer range.
  const match = /^https?:\/\/(?:(?:www|mobile|m)\.)?(?:x|twitter)\.com\/(?:[a-z0-9_]+\/status|i\/(?:web\/)?status)\/([0-9]+)(?:\/(video|photo)\/([1-9][0-9]*))?\/?(?:[?#].*)?$/i.exec(inputUrl)
  if (!match) {
    return scriptError('Share an X post link containing /status/<id>')
  }

  const [, postId, selectedType, selectedIndex] = match
  // Token used by X's embed widget. Only this calculation intentionally uses Number.
  const token = ((Number(postId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '')

  try {
    const req = new Request(`https://cdn.syndication.twimg.com/tweet-result?id=${postId}&token=${token}`)
    req.headers = { 'User-Agent': 'Googlebot' }
    req.timeoutInterval = 30
    const body = await req.loadString()
    const status = req.response.statusCode

    if (status === 429) {
      return scriptError('X is rate limiting requests. Try again later')
    }
    if (status !== 200) {
      return scriptError(`X could not load this post (HTTP ${status})`)
    }
    const post = JSON.parse(body)
    if (!post || post.id_str !== postId) {
      return scriptError('X did not return this post. It may be private, deleted, or unavailable through public embeds')
    }

    const timestamp = Math.floor(Date.parse(post.created_at) / 1000)
    if (!Number.isFinite(timestamp)) {
      return scriptError('X returned an invalid post date')
    }

    const media = Array.isArray(post.mediaDetails) ? post.mediaDetails : []
    // A /video/N or /photo/N link refers to the Nth attachment, including photos.
    const items = selectedIndex ? [media[Number(selectedIndex) - 1]] : media
    if (selectedIndex && !items[0]) {
      return scriptError(`X attachment #${selectedIndex} is unavailable`)
    }

    const downloadLinks = []
    for (const item of items) {
      if (selectedType && (selectedType.toLowerCase() === 'photo') !== (item.type === 'photo')) {
        return scriptError(`X attachment #${selectedIndex} is not a ${selectedType.toLowerCase()}`)
      }

      if (item.type === 'photo' && /^https:\/\/pbs\.twimg\.com\//i.test(item.media_url_https || '')) {
        const photoUrl = item.media_url_https
        const url = /[?&]name=/.test(photoUrl)
          ? photoUrl.replace(/([?&]name=)[^&]*/, '$1orig')
          : photoUrl + (photoUrl.includes('?') ? '&' : '?') + 'name=orig'
        downloadLinks.push({ url, timestamp })
      } else if (item.type === 'video' || item.type === 'animated_gif') {
        const variants = (item.video_info?.variants || [])
          .filter((variant) => variant.content_type === 'video/mp4' && /^https:\/\/video\.twimg\.com\//i.test(variant.url || ''))
          .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
        if (!variants.length) {
          return scriptError('X did not provide a downloadable MP4 for this attachment')
        }
        const download = { url: variants[0].url, timestamp }
        const qualityUrls = {}
        const seen = new Set()
        for (const variant of variants) {
          if (seen.has(variant.url)) continue
          seen.add(variant.url)
          const dimensions = /\/(\d+)x(\d+)\//.exec(variant.url)
          // Use the shorter side for familiar labels in either orientation.
          const label = dimensions
            ? `${Math.min(Number(dimensions[1]), Number(dimensions[2]))}p`
            : 'Best available'
          // Variants are sorted by bitrate; keep the best file at each resolution.
          if (!Object.prototype.hasOwnProperty.call(qualityUrls, label)) {
            qualityUrls[label] = variant.url
          }
        }
        if (Object.keys(qualityUrls).length > 1) {
          download.qualityOptions = Object.keys(qualityUrls)
          download.qualityUrls = qualityUrls
        }
        downloadLinks.push(download)
      }
    }

    if (!downloadLinks.length) {
      return scriptError('No downloadable photos or videos found in this X post. Public embeds may omit some media')
    }

    return {
      platform: 'X',
      postId,
      authorUsername: post.user?.screen_name || 'x_user',
      downloadLinks,
      requiresUserLogin: false
    }
  } catch (error) {
    return scriptError(`Could not load X media: ${error.message || 'Connectivity error'}`)
  }
}
