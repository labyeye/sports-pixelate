export const validators = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  phone: (phone: string): boolean => {
    const digitsOnly = phone.replace(/\D/g, "");
    return digitsOnly.length >= 10 && digitsOnly.length <= 15;
  },

  gst: (gst: string): boolean => {
    const gstRegex =
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstRegex.test(gst);
  },

  pan: (pan: string): boolean => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan);
  },

  url: (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  upi: (upiId: string): boolean => {
    const upiRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z]{3,}$/;
    return upiRegex.test(upiId);
  },

  creditCard: (cardNumber: string): boolean => {
    const digitsOnly = cardNumber.replace(/\D/g, "");
    if (digitsOnly.length < 13 || digitsOnly.length > 19) return false;

    let sum = 0;
    let isEven = false;

    for (let i = digitsOnly.length - 1; i >= 0; i--) {
      let digit = parseInt(digitsOnly.charAt(i), 10);

      if (isEven) {
        digit *= 2;
        if (digit > 9) {
          digit -= 9;
        }
      }

      sum += digit;
      isEven = !isEven;
    }

    return sum % 10 === 0;
  },

  ifsc: (ifsc: string): boolean => {
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    return ifscRegex.test(ifsc);
  },

  pincode: (pincode: string): boolean => {
    return /^[1-9][0-9]{5}$/.test(pincode.trim());
  },

  accountNumber: (accountNumber: string): boolean => {
    const digitsOnly = accountNumber.replace(/\D/g, "");
    return digitsOnly.length >= 9 && digitsOnly.length <= 18;
  },

  name: (name: string): { valid: boolean; error?: string } => {
    const trimmed = name.trim();
    if (!trimmed) return { valid: false, error: "Name is required" };
    if (trimmed.length < 2)
      return { valid: false, error: "Name must be at least 2 characters" };
    if (trimmed.length > 100)
      return { valid: false, error: "Name cannot exceed 100 characters" };
    return { valid: true };
  },
};

export const formatters = {
  phone: (value: string): string => {
    const digitsOnly = value.replace(/\D/g, "");
    if (digitsOnly.length <= 3) return digitsOnly;
    if (digitsOnly.length <= 6)
      return `${digitsOnly.slice(0, 3)} ${digitsOnly.slice(3)}`;
    if (digitsOnly.length <= 10)
      return `${digitsOnly.slice(0, 3)} ${digitsOnly.slice(3, 6)} ${digitsOnly.slice(6)}`;
    return `+${digitsOnly.slice(0, 2)} ${digitsOnly.slice(2, 5)} ${digitsOnly.slice(5, 8)} ${digitsOnly.slice(8, 11)} ${digitsOnly.slice(11, 15)}`.substring(
      0,
      20,
    );
  },

  cardNumber: (value: string): string => {
    const digitsOnly = value.replace(/\D/g, "");
    const groups = digitsOnly.match(/.{1,4}/g) || [];
    return groups.join(" ").substring(0, 23);
  },

  gst: (value: string): string => {
    return value
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, "")
      .substring(0, 15);
  },

  pan: (value: string): string => {
    return value
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, "")
      .substring(0, 10);
  },

  ifsc: (value: string): string => {
    return value
      .toUpperCase()
      .replace(/[^0-9A-Z]/g, "")
      .substring(0, 11);
  },

  accountNumber: (value: string): string => {
    return value.replace(/\D/g, "").substring(0, 18);
  },

  companyName: (value: string): string => {
    return value
      .trim()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  },
};
