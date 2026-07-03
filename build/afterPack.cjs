// electron-builder afterPack hook: harden the packaged Electron binary with
// Electron Fuses (https://www.electronjs.org/docs/latest/tutorial/fuses).
// Fuses flip security bits in the binary at package time — disabling ways the
// shipped executable could be repurposed as a generic Node.js runtime or have
// debug/inspect flags injected.
const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')
const path = require('path')

exports.default = async function afterPack(context) {
  const { appOutDir, packager, electronPlatformName } = context
  const exe = packager.appInfo.productFilename // e.g. "Monit"

  let binary
  if (electronPlatformName === 'win32') binary = path.join(appOutDir, `${exe}.exe`)
  else if (electronPlatformName === 'darwin')
    binary = path.join(appOutDir, `${exe}.app`, 'Contents', 'MacOS', exe)
  else binary = path.join(appOutDir, exe)

  await flipFuses(binary, {
    version: FuseVersion.V1,
    // Block "living off the land" abuse of the shipped binary.
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    // Encrypt any cookies with OS-level crypto.
    [FuseV1Options.EnableCookieEncryption]: true,
    // Only ever load the app from app.asar (unpacked native modules still load).
    [FuseV1Options.OnlyLoadAppFromAsar]: true
    // NOTE: EnableEmbeddedAsarIntegrityValidation is intentionally left off — it
    // needs the build to embed an asar hash and has rough edges on Windows; it
    // can be enabled later alongside electron-builder asar-integrity support.
  })

  console.log(`[afterPack] Electron fuses applied to ${binary}`)
}
