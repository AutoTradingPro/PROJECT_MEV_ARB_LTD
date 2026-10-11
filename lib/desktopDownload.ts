/** Nama file stabil yang dilayani webapp (Netlify `public/`). */
export const CORE_INSTALLER_NAME = "MEV-Core-Engine-Setup.exe";

export const CORE_INSTALLER_PATH = `/downloads/desktop/${CORE_INSTALLER_NAME}`;

/** Override ke GitHub Releases jika installer tidak di-commit ke repo. */
export function coreInstallerHref(): string {
  return process.env.NEXT_PUBLIC_CORE_INSTALLER_URL || CORE_INSTALLER_PATH;
}
