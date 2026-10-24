import { useEffect, useState } from "react";
import { authAPI } from "@/services/api";
import {
  BackupCodesCard,
  DevicesCard,
  EmailVerificationCard,
  PasskeyCard,
  TrustedDevicesCard,
} from "./SecurityCards";

// Passkey, signed-in devices, email verification and backup codes — shown under Settings → Account.
export function AccountSecurityPanel() {
  const [email, setEmail] = useState("");
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    authAPI
      .getMe()
      .then((r: any) => {
        setEmail(r.data?.email || "");
        setVerified(!!r.data?.emailVerified);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="p-6">
      <div className="mb-5">
        <h3 className="text-lg font-bold text-black">Account Security</h3>
        <p className="text-sm text-gray-500 mt-1">
          More ways to sign in and recover your account, and control over where
          you are logged in.
        </p>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
        <PasskeyCard />
        <DevicesCard />
        <TrustedDevicesCard />
        <EmailVerificationCard
          email={email}
          verified={verified}
          onVerified={(e) => {
            setEmail(e);
            setVerified(true);
          }}
        />
        <BackupCodesCard />
      </div>
    </div>
  );
}
