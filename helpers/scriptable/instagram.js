// SAVE TO PHOTOS - Instagram
// Author: @plbstl

// This script is executed using Apple's JavaScriptCore engine and APIs provided by Scriptable.
// See: https://docs.webkit.org/Deep%20Dive/JSC/JavaScriptCore.html
// See: https://docs.scriptable.app/

/**
 * @returns {Promise<import('./types').InstagramOutput>}
 */
async function instagram() {
  /******************************************************************************
   * Constants
   *****************************************************************************/

  /**
   * If the passed-in URL does NOT contain `/p/`, `/reel/`, `/s/`, `/stories/`,
   * or `/tv/` right after the domain name, it is most likely a user profile.
   */
  const profilePageRegex = /instagram\.com\/(?!(p\/|reels?\/|s\/|stories\/|tv\/|share\/))/i

  /**
   * Check for `"media_id":"<id>"` or `"initial_media_id":"<id>"`,
   * and match only the `<id>`, against the webpage HTML
   */
  const mediaIdRegex = /"(?:initial_media_id|media_id)"\s*:\s*"?([0-9]+)/

  /** Check for `"user_id":"<id>"`, and match only the `<id>`, against the webpage HTML */
  const userIdRegex = /"user_id"\s*:\s*"?([0-9]+)/

  /** Check for `story_media_id=<id>&`, and match only the `<id>`, against the input URL */
  const storyMediaIdRegex = /[?&]story_media_id=([0-9]+)(?:&|$)/i

  /** Check for `instagram.com/route/<id>`, and match only the `<id>`, against the input URL */
  const postIdRegex = /^https?:\/\/(?:(?:www|m)\.)?instagram\.com\/(?:p|reels?|tv)\/([a-z0-9_-]+)(?:\/|[?#]|$)/i

  /******************************************************************************
   * Main
   *****************************************************************************/

  let postId = postIdRegex.exec(inputUrl)?.[1] || 'story'

  try {
    if (!(await loggedIn())) {
      return instagramOutput({ requiresUserLogin: true })
    }

    // A post's shortcode encodes its media ID. Do not rely on the page exposing
    // media_id: current reel pages frequently omit that field entirely.
    let directMediaId = postId === 'story' ? null : shortcodeToMediaId(postId)
    directMediaId ||= storyMediaIdRegex.exec(inputUrl)?.[1]
      || /^https?:\/\/(?:www\.)?instagram\.com\/stories\/(?!highlights\/)[^/]+\/([0-9]+)(?:\/|[?#]|$)/i.exec(inputUrl)?.[1]
    let html = ''
    if (!directMediaId) {
      const pageRequest = new Request(inputUrl)
      pageRequest.headers = { 'x-ig-app-id': '936619743392459' }
      html = await pageRequest.loadString()
      // Instagram's /share/reel/... links can redirect to a canonical reel URL.
      const resolvedPostId = postIdRegex.exec(pageRequest.response?.url || '')?.[1]
      if (resolvedPostId) {
        postId = resolvedPostId
        directMediaId = shortcodeToMediaId(postId)
      }
    }

    // Check if the inputted URL is a profile page
    if (!directMediaId && profilePageRegex.test(inputUrl)) {
      // We download the profile's stories (if any) and profile picture.

      // Extract the ID of the inputted user profile
      const userId = userIdRegex.exec(html)?.[1]
      if (!userId) {
        return scriptError('Missing user ID')
      }

      // Fetch the inputted user profile's display picture and stories
      const [reelsMedia, userInfo] = await Promise.all([
        fetchit(`https://i.instagram.com/api/v1/feed/reels_media/?reel_ids=${userId}`),
        fetchit(`https://i.instagram.com/api/v1/users/${userId}/info/`)
      ])

      if (reelsMedia.status !== 'ok' || userInfo.status !== 'ok') {
        const errorMessage = reelsMedia.message || userInfo.message
        return scriptError(errorMessage || 'Instagram API status is not ok')
      }

      // Download links
      const downloadLinks = []

      // Check if there are stories available
      if (reelsMedia.reels_media.length > 0) {
        // Extract all the download links to the stories
        for (const item of reelsMedia.reels_media.at(0).items) {
          const link = extractDownloadLinks(item)
          downloadLinks.push(link)
        }
      }

      // We are always returning the profile picture, this can be changed if need be.
      // Collate an output and exit
      return instagramOutput({
        postId,
        downloadLinks: [...downloadLinks.flat(), {
          url: userInfo.user.hd_profile_pic_url_info.url,
          timestamp: 0
        }],
        authorUsername: userInfo.user.username
      })
    } else {
      // This block indicates that this is an image, reel, album (carousel) or story highlight

      // Extract the media ID of the post or story highlight
      const mediaId = directMediaId || mediaIdRegex.exec(html)?.[1]
      if (!mediaId) {
        return scriptError('Instagram did not expose a media ID. Share the direct post or reel link instead')
      }

      // Fetch information about the post using its media ID
      const mediaInfo = await fetchit(`https://i.instagram.com/api/v1/media/${mediaId}/info/`)
      if (mediaInfo.status !== 'ok') {
        if (mediaInfo.message === 'login_required') {
          return instagramOutput({ requiresUserLogin: true })
        }
        return scriptError(mediaInfo.message || 'Instagram API status is not ok')
      }

      // Extract the relevant download link(s)
      const post = mediaInfo.items?.at(0)
      if (!post) return scriptError('Instagram returned no media for this post')
      const downloadLinks = extractDownloadLinks(post)
      const postAuthor = post.user || post.carousel_media?.at(0)?.user

      // Collate an output and exit
      return instagramOutput({
        postId,
        downloadLinks: downloadLinks,
        authorUsername: postAuthor?.username || 'instagram_user'
      })
    }
  } catch (error) {
    return scriptError(error.message || 'Connectivity')
  }

  /******************************************************************************
   * Helpers
   *****************************************************************************/

  /**
   * Checks if the user is logged in to Instagram.
   * @returns {Promise<boolean>} `true` if the user is logged in, otherwise `false`
   */
  async function loggedIn() {
    const req = new Request('https://www.instagram.com/')
    await req.load()
    return (req.response.cookies || []).some((cookie) => cookie.name === 'sessionid')
  }

  function shortcodeToMediaId(shortcode) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
    // Instagram sometimes appends a 28-character share suffix to the shortcode.
    if (shortcode.length > 28) shortcode = shortcode.slice(0, -28)
    let id = BigInt(0)
    for (const character of shortcode) {
      id = id * BigInt(64) + BigInt(alphabet.indexOf(character))
    }
    return id.toString()
  }

  /**
   * Exit this script and return the passed in arg as output.
   * @param {Partial<import('./types').InstagramOutput>} output Result to send back to Siri Shortcuts
   * @returns {import('./types').InstagramOutput}
   */
  function instagramOutput(output) {
    /** @type {import('./types').InstagramOutput} */
    const defaultOutput = {
      platform: 'Instagram',
      postId: '',
      authorUsername: 'instagram_user',
      downloadLinks: [],
      requiresUserLogin: false
    }
    return { ...defaultOutput, ...output }
  }

  /**
   * Extract relevant download URLs from an Instagram post or story.
   *
   * We are retrieving the highest quality available for every post or story.
   * This is usually the first item in the URLs list.
   * @param {object} post Instagram post or story to retrieve links from
   * @returns {import('./types').DownloadLink[]} An array of download URLs
   */
  function extractDownloadLinks(post) {
    const IMAGE = 1
    const VIDEO = 2
    const CAROUSEL = 8

    switch (post.media_type) {
      case IMAGE:
        return [
          {
            url: post.image_versions2.candidates.at(0).url,
            timestamp: post.taken_at
          }
        ]

      case VIDEO:
        return [
          {
            url: post.video_versions.at(0).url,
            timestamp: post.taken_at
          }
        ]

      case CAROUSEL:
        const links = []
        for (const carouselPostItem of post.carousel_media) {
          const link = extractDownloadLinks(carouselPostItem)
          links.push(link)
        }
        return links.flat()

      default:
        return []
    }
  }
}
