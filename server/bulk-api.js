import fetch from "node-fetch";

const BULK_API = process.env.BULK_API_URL || "https://exchange-api.bulk.trade/api/v1";

export async function fetchFullAccount(pubkey) {
  try {
    const res = await fetch(`${BULK_API}/account`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "fullAccount", user: pubkey }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // Response is an array, first item has fullAccount key
    if (Array.isArray(data) && data.length > 0 && data[0].fullAccount) {
      return data[0].fullAccount;
    }
    // Some responses might be direct object
    if (data.fullAccount) return data.fullAccount;
    return data;
  } catch (err) {
    console.error(`[Bulk API] Error fetching account ${pubkey}:`, err.message);
    return null;
  }
}

export async function fetchExchangeInfo() {
  try {
    const res = await fetch(`${BULK_API}/exchangeInfo`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.error("[Bulk API] Error fetching exchange info:", err.message);
    return [];
  }
}

export async function fetchTicker(symbol) {
  try {
    const res = await fetch(`${BULK_API}/ticker/${symbol}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error(`[Bulk API] Error fetching ticker ${symbol}:`, err.message);
    return null;
  }
}
