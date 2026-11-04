<div align="center">

![MediaDL](square.and.arrow.down.fill.png)

# MediaDL — Instagram & X

[![Download Shortcut](https://img.shields.io/badge/download_Shortcut-7c3aed?style=flat-square)](https://cuuush.github.io/MediaDL/install/)
[![Release](https://img.shields.io/github/v/release/cuuush/MediaDL)](https://github.com/cuuush/MediaDL/releases)

</div>

Download photos and videos from **Instagram and X (Twitter)** using Apple's
Shortcuts app and Scriptable. Downloads run on your device and connect directly
to Instagram or X. No third-party download service, API key, or subscription is
required.

This fork of [plbstl/MediaDL](https://github.com/plbstl/MediaDL) adds X support.
The original project's installation link contains the older Instagram-only
version. **Install from this fork's releases to get X support.**

## Supported media

| Platform | What you can save | Sign-in |
| --- | --- | --- |
| Instagram | Post photos, videos, reels, carousels, stories, highlights, profile pictures | Required in Scriptable |
| X / Twitter | Photos, videos, and animated GIFs in public posts | Not required |

X GIFs are saved as MP4 videos. For videos with multiple MP4 variants, choose a
resolution and bitrate before downloading; photos use the original-size image. Other platforms are not supported.

## Install

Open the **[MediaDL install page](https://cuuush.github.io/MediaDL/install/)** on your iPhone or iPad:

1. **Install [Scriptable](https://apps.apple.com/app/scriptable/id1405459188)** from the App Store. You don't need to open it or create a script.
2. **Add MediaDL** using the button on the install page. Replace your old MediaDL shortcut if prompted. [Shortcuts](https://apps.apple.com/app/shortcuts/id915249334) is also required.
3. **Share a post** from Instagram or X and choose **MediaDL**. Allow the requested access.

If you see **“a required app is missing,” install Scriptable and run MediaDL again. You do not need to reinstall the shortcut.** Scriptable is required for both platforms. This shortcut runs on iPhone and iPad.

The signed Shortcut includes the updated script; no code editing is needed. You can also download **MediaDL.shortcut** directly from the [latest release](https://github.com/cuuush/MediaDL/releases/latest), then tap the file in Files to import it.

## Use

1. Share a post from Instagram, X, or your browser.
2. Choose **MediaDL** in the share sheet. If it is missing, use **Edit Actions**
   to add it.
3. For Instagram, sign in through the official Instagram page when Scriptable
   asks, close that page, and share the post again. X does not need a sign-in.
4. For X videos, choose a resolution and bitrate when multiple qualities are available. For a post with multiple attachments, choose the files you want to keep.
   MediaDL saves them to an **Instagram** or **X** album in Photos.

For X, use a full `https://x.com/<user>/status/<id>` or
`https://twitter.com/<user>/status/<id>` link. Query strings such as `?s=42` are
accepted. A link ending in `/video/2` or `/photo/2` selects the second attachment;
share the plain post URL to download all supported attachments.

## Limits and troubleshooting

- **Unsupported platform:** Make sure you installed this fork's release and
  selected **MediaDL**. The upstream shortcut only supports Instagram.
- **X post unavailable:** X's public embed endpoint may omit private, deleted,
  sensitive, or otherwise restricted posts. Signing in will not unlock those
  posts in this downloader.
- **X has no downloadable MP4:** Some videos are only exposed as streaming
  playlists. This version cannot convert those streams into a video file.
- Shortened `t.co` links, quoted-post attachments, external video cards, and live
  broadcasts are not supported.
- For Instagram, the signed-in account must have access to the media. On mobile
  data, allow network access for both Shortcuts and Scriptable.

MediaDL never asks you to provide a password to this project. Instagram sign-in
happens on Instagram's own page inside Scriptable. Only download and share media
you have permission to use, and credit its creators.

## Development

The platform handlers are in `helpers/scriptable/`. They return media URLs and
metadata to the Shortcut, which downloads the files and saves them to Photos.

Run the tests and generate the combined Scriptable source:

```sh
node --test tests/*.test.mjs
bash scripts/merge-scriptable
```

To update an existing installation manually, replace the JavaScript in its
**first Scriptable action** with `scriptable.js`. Keep the existing input
parameter and the separate Instagram login action.

To build an importable Shortcut, export the original MediaDL shortcut as a file,
then run these commands on a Mac:

```sh
python3 scripts/build-shortcut Original.shortcut --output build/MediaDL.unsigned.shortcut
shortcuts sign --mode anyone --input build/MediaDL.unsigned.shortcut --output build/MediaDL.shortcut
```

The builder replaces the embedded downloader and updates the introduction while
preserving the existing input bindings and download/save actions. Signing
requires Apple's service. See [CONTRIBUTING.md](CONTRIBUTING.md) for the original
project's contribution guide.

## License 🤝

<p xmlns:cc="http://creativecommons.org/ns#" xmlns:dct="http://purl.org/dc/terms/"><a property="dct:title" rel="cc:attributionURL" href="https://mediadl.plbstl.io">MediaDL</a> is licensed under <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/?ref=chooser-v1" target="_blank" rel="license noopener noreferrer" style="display:inline-block;">CC BY-NC-SA 4.0<img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/cc.svg?ref=chooser-v1" alt=""><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/by.svg?ref=chooser-v1" alt=""><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/nc.svg?ref=chooser-v1" alt=""><img style="height:22px!important;margin-left:3px;vertical-align:text-bottom;" src="https://mirrors.creativecommons.org/presskit/icons/sa.svg?ref=chooser-v1" alt=""></a></p>

**You are free to:**

- **Share** — copy and redistribute the material in any medium or format.

- **Adapt** — remix, transform, and build upon the material.

**Under the following terms:**

- **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made. You may do so in any reasonable manner, but not in any way that suggests the licensor endorses you or your use.

- **NonCommercial** — You may not use the material for commercial purposes.

- **ShareAlike** — If you remix, transform, or build upon the material, you must distribute your contributions under the same license as the original.

- **No additional restrictions** — You may not apply legal terms or technological measures that legally restrict others from doing anything the license permits.
