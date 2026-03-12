"use client";

import { signIn } from "next-auth/react";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5]">
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E5E5] p-8 max-w-sm w-full text-center">
        <h1 className="text-2xl font-semibold mb-2">Email Manager</h1>
        <p className="text-sm text-[#525252] mb-8">
          Sign in with your @wisc.edu Microsoft account
        </p>
        <button
          onClick={() => signIn("microsoft-entra-id", { callbackUrl: "/" })}
          className="w-full bg-black text-white rounded-md px-4 py-2.5 font-medium hover:bg-[#171717] transition-colors cursor-pointer"
        >
          Sign in with Microsoft
        </button>
        <p className="text-xs text-[#A3A3A3] mt-4">
          Only @wisc.edu accounts are authorized
        </p>
      </div>
    </div>
  );
}
