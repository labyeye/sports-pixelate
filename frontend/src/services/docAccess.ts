// Confidential documents need a WhatsApp OTP. This module owns the short-lived
// access token and asks the <DocOtpHost /> dialog to collect the OTP when needed.
type Prompt = () => Promise<string | null>;

let prompt: Prompt | null = null;
let token: string | null = null;
let expiresAt = 0;

export const registerDocOtpPrompt = (p: Prompt | null) => {
  prompt = p;
};

export const setDocAccessToken = (t: string, expiresInSec: number) => {
  token = t;
  expiresAt = Date.now() + expiresInSec * 1000 - 5000;
};

export const clearDocAccessToken = () => {
  token = null;
  expiresAt = 0;
};

export const currentDocAccessToken = () =>
  token && Date.now() < expiresAt ? token : null;

// Runs `fn(token)`, asking for the OTP first when there is no live token, and
// once more if the server says the token is no longer valid.
export async function withDocAccess<T>(
  fn: (token: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    let t = currentDocAccessToken();
    if (!t) {
      if (!prompt) throw new Error("OTP prompt is not available");
      t = await prompt();
      if (!t) throw new Error("Document access cancelled");
    }
    try {
      return await fn(t);
    } catch (err: any) {
      if (err?.code !== "DOC_OTP_REQUIRED" || attempt === 1) throw err;
      clearDocAccessToken();
    }
  }
  throw new Error("Document access failed");
}
