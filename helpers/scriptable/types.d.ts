export interface DownloadLink {
  /** Direct link to raw file */
  url: string
  /** Creation date of post */
  timestamp: number
  /** Available MP4 qualities, highest bitrate first; omitted for a single choice. */
  qualityOptions?: string[]
  qualityUrls?: Record<string, string>
}

export interface ScriptableOutput {
  platform: 'Instagram' | 'X'
  postId: string
  authorUsername: string
  downloadLinks: DownloadLink[]
}

export interface InstagramOutput extends ScriptableOutput {
  requiresUserLogin: boolean
  platform: 'Instagram'
}

export interface XOutput extends ScriptableOutput {
  requiresUserLogin: false
  platform: 'X'
}
