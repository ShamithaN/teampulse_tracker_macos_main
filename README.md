# teampulse_tracker_macos_main
macOS build of TeamPulse Tracker. Addresses compatibility issues in the original release that prevented the app from running correctly on macOS.

## macOS build

For local testing, run:

```bash
npm run dist:mac
```

This creates an unsigned DMG in `dist/`. The build log will say macOS code signing was skipped because `CSC_IDENTITY_AUTO_DISCOVERY=false`; that is expected for local builds.

For a production build with Apple Developer signing, configure your Apple certificate and notarization credentials, then run:

```bash
npm run dist:mac:signed
```

The signed build must be notarized by Apple. If the build says `skipped macOS notarization`, the DMG was built but Apple notarization credentials were not provided.

Recommended App Store Connect API key setup:

```bash
export APPLE_API_KEY="/path/to/AuthKey_XXXXXXXXXX.p8"
export APPLE_API_KEY_ID="XXXXXXXXXX"
export APPLE_API_ISSUER="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
npm run dist:mac:signed
```

Alternative Apple ID setup:

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
npm run dist:mac:signed
```

The macOS build is configured with Team ID `C94PA5YM57` for notarization.
