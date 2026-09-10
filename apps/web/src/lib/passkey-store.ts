/** Password Manager / Credential Management helpers (Bitwarden, 1Password, Google). */

export async function storeInPasswordManager(username: string, password: string): Promise<void> {
  try {
    if (!("PasswordCredential" in window) || !navigator.credentials?.store) return
    const Ctor = window.PasswordCredential as unknown as {
      new (init: { id: string; password: string; name?: string }): Credential
    }
    await navigator.credentials.store(new Ctor({ id: username, password, name: "Chiflame" }))
  } catch {
    /* user dismissed or unsupported */
  }
}

export async function getFromPasswordManager(): Promise<{ username: string; password: string } | null> {
  try {
    if (!navigator.credentials?.get) return null
    const cred = (await navigator.credentials.get({
      password: true,
      mediation: "required",
    } as CredentialRequestOptions)) as (Credential & { id: string; password?: string }) | null
    if (cred?.password) return { username: cred.id, password: cred.password }
  } catch {
    /* dismissed */
  }
  return null
}
