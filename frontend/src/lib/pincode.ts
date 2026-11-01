/** Free India Post API: 6-digit pincode -> { city, state } (null when not found / offline). */
export async function lookupPincode(
  pin: string,
): Promise<{ city: string; state: string } | null> {
  if (!/^\d{6}$/.test(pin)) return null;
  try {
    const r = await fetch(`https://api.postalpincode.in/pincode/${pin}`);
    const d = (await r.json())?.[0];
    const o = d?.Status === "Success" ? d.PostOffice?.[0] : null;
    return o ? { city: o.District, state: o.State } : null;
  } catch {
    return null;
  }
}
