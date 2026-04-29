"use client";

import { useEffect, useMemo, useRef } from "react";

type OtpInputProps = {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
};

export default function OtpInput({
  length = 4,
  value,
  onChange,
  disabled = false,
  autoFocus = false,
}: OtpInputProps) {
  const inputs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = useMemo(() => {
    const current = value.replace(/\D/g, "").slice(0, length).split("");
    return Array.from({ length }, (_, index) => current[index] ?? "");
  }, [length, value]);

  useEffect(() => {
    if (autoFocus) {
      inputs.current[0]?.focus();
    }
  }, [autoFocus]);

  const updateValue = (index: number, nextDigit: string) => {
    const next = [...digits];
    next[index] = nextDigit;
    onChange(next.join(""));
  };

  return (
    <div style={{ display: "flex", gap: 12, justifyContent: "space-between" }}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputs.current[index] = el;
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={`OTP digit ${index + 1}`}
          value={digit}
          disabled={disabled}
          onChange={(event) => {
            const nextDigit = event.target.value.replace(/\D/g, "").slice(-1);
            updateValue(index, nextDigit);
            if (nextDigit && index < length - 1) {
              inputs.current[index + 1]?.focus();
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digit && index > 0) {
              inputs.current[index - 1]?.focus();
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
            if (!pasted) {
              return;
            }
            onChange(pasted.padEnd(length, ""));
            const focusIndex = Math.min(pasted.length, length - 1);
            inputs.current[focusIndex]?.focus();
          }}
          maxLength={1}
          style={{
            width: "100%",
            height: 58,
            textAlign: "center",
            borderRadius: 16,
            border: "1px solid #cbd5e1",
            background: disabled ? "#f8fafc" : "white",
            fontSize: 24,
            fontWeight: 700,
            color: "#0f172a",
            boxShadow: "inset 0 1px 2px rgba(15,23,42,0.05)",
          }}
        />
      ))}
    </div>
  );
}

