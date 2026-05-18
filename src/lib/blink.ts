const ENDPOINT = "https://api.blink.sv/graphql";

async function gql<T>(apiKey: string, query: string, variables: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
      body: JSON.stringify({ query, variables }),
    });
  } catch (e) {
    throw new Error("API unreachable — check your key and network");
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok || contentType.includes("text/html")) {
    if (res.status === 401 || res.status === 403) {
      throw new Error("Unauthorized — check your Blink API key");
    }
    throw new Error(`API unreachable — check your key and network (status ${res.status})`);
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error("API returned an invalid response — check your key and network");
  }
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data as T;
}

export interface MeWallet {
  id: string;
  walletCurrency: string;
  balance: number;
}

export async function fetchMe(apiKey: string) {
  const data = await gql<{ me: { defaultAccount: { wallets: MeWallet[] } } }>(
    apiKey,
    `query Me { me { defaultAccount { wallets { id walletCurrency balance } } } }`,
    {}
  );
  return data.me.defaultAccount.wallets;
}

export interface LnInvoice {
  paymentRequest: string;
  paymentHash: string;
  satoshis: number;
  expiresAt?: number | null;
}

export async function createLnUsdInvoice(apiKey: string, walletId: string, cents: number, memo: string) {
  const data = await gql<{
    lnUsdInvoiceCreate: { invoice: LnInvoice | null; errors: { message: string }[] };
  }>(
    apiKey,
    `mutation LnUsdInvoiceCreate($input: LnUsdInvoiceCreateInput!) {
      lnUsdInvoiceCreate(input: $input) {
        errors { message }
        invoice { paymentRequest paymentHash satoshis }
      }
    }`,
    { input: { walletId, amount: cents, memo } }
  );
  const r = data.lnUsdInvoiceCreate;
  if (r.errors?.length) throw new Error(r.errors[0].message);
  if (!r.invoice) throw new Error("No invoice returned");
  return r.invoice;
}

export async function createLnBtcInvoice(apiKey: string, walletId: string, sats: number, memo: string) {
  const data = await gql<{
    lnInvoiceCreate: { invoice: LnInvoice | null; errors: { message: string }[] };
  }>(
    apiKey,
    `mutation LnInvoiceCreate($input: LnInvoiceCreateInput!) {
      lnInvoiceCreate(input: $input) {
        errors { message }
        invoice { paymentRequest paymentHash satoshis }
      }
    }`,
    { input: { walletId, amount: sats, memo } }
  );
  const r = data.lnInvoiceCreate;
  if (r.errors?.length) throw new Error(r.errors[0].message);
  if (!r.invoice) throw new Error("No invoice returned");
  return r.invoice;
}
